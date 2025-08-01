module GroupService
  DEFAULT_COVER_PHOTO_FILENAMES = %w[
    cover1.jpg
    cover2.jpg
    cover3.jpg
    cover4.jpg
    cover5.jpg
    cover6.jpg
    cover7.jpg
    cover8.jpg
    cover9.jpg
    cover10.jpg
    cover11.jpg
    cover12.jpg
    cover13.jpg
    cover14.jpg
  ]
  def self.remote_cover_photo
    Rails.root.join("public/theme/group_cover_photos/#{DEFAULT_COVER_PHOTO_FILENAMES.sample}")
  end

  def self.invite(group:, params:, actor:)
    group_ids = if params[:invited_group_ids]
      Array(params[:invited_group_ids]).map(&:to_i)
    else
      Array(group.id)
    end

    # restrict group_ids to a single organization
    parent_group = Group.where(id: group_ids).first.parent_or_self
    group_ids = parent_group.id_and_subgroup_ids & group_ids

    UserInviter.authorize_add_members!(
      parent_group: parent_group,
      group_ids: group_ids,
      emails: Array(params[:recipient_emails]),
      user_ids: Array(params[:recipient_user_ids]),
      actor: actor
    )

    users = UserInviter.where_or_create!(
      actor: actor,
      model: group,
      emails: params[:recipient_emails],
      user_ids: params[:recipient_user_ids]
    )

    Group.where(id: group_ids).each do |g|
      revoked_memberships = Membership.revoked.where(group_id: g.id, user_id: users.map(&:id))
      revoked_memberships.update_all(
        inviter_id: actor.id,
        accepted_at: nil,
        revoked_at: nil,
        revoker_id: nil,
        admin: false,
      )

      new_memberships = users.map do |user|
        Membership.new(inviter: actor, user: user, group: g, volume: user.default_membership_volume)
      end

      Membership.import(new_memberships, on_duplicate_key_ignore: true)

      # mark as accepted all invitiations to people who are already part of the org.
      other_group_ids = Group.published.where(id: g.parent_or_self.id_and_subgroup_ids).pluck(:id) - Array(g.id)
      existing_member_ids = Membership.accepted.where(group_id: other_group_ids, user_id: users.verified.pluck(:id)).pluck(:user_id)
      Membership.pending.where(group_id: g.id, user_id: existing_member_ids).update_all(accepted_at: Time.now)

      g.update_pending_memberships_count
      g.update_memberships_count
      GenericWorker.perform_async('PollService', 'group_members_added', g.id)
    end

    Events::MembershipCreated.publish!(
      group: group,
      actor: actor,
      recipient_user_ids: users.pluck(:id),
      recipient_message: params[:recipient_message]
    )

    Membership.active.where(group_id: group.id, user_id: users.pluck(:id))
  end

  def self.create(group:, actor: , skip_authorize: false)
    actor.ability.authorize!(:create, group) unless skip_authorize

    return false unless group.valid?

    group.is_referral = actor.groups.size > 0

    if group.is_parent?
      url = remote_cover_photo
      group.cover_photo.attach(io: URI.open(url), filename: File.basename(url))
      group.creator = actor if actor.is_logged_in?
      group.subscription = Subscription.new
    end

    group.save!
    group.add_admin!(actor)

    EventBus.broadcast('group_create', group, actor)
  end

  def self.update(group:, params:, actor:)
    actor.ability.authorize! :update, group

    group.assign_attributes_and_files(params)
    group.group_privacy = params[:group_privacy] if params.has_key?(:group_privacy)
    privacy_change = PrivacyChange.new(group)

    return false unless group.valid?
    group.save!
    privacy_change.commit!

    EventBus.broadcast('group_update', group, params, actor)
  end

  def self.destroy(group:, actor:)
    actor.ability.authorize! :destroy, group

    group.admins.each do |admin|
      GroupMailer.destroy_warning(group.id, admin.id, actor.id).deliver_later
    end

    group.archive!

    DestroyGroupWorker.perform_in(2.weeks, group.id)
    EventBus.broadcast('group_destroy', group, actor)
  end

  def self.destroy_without_warning!(group_id)
    Group.find(group_id).archive!
    DestroyGroupWorker.perform_async(group_id)
  end

  def self.move(group:, parent:, actor:)
    actor.ability.authorize! :move, group
    group.update(handle: "#{parent.handle}-#{group.handle}") if group.handle?
    group.update(parent: parent, subscription_id: nil)
    EventBus.broadcast('group_move', group, parent, actor)
  end

  def self.export(group: , actor: )
    actor.ability.authorize! :show, group
    group_ids = actor.groups.where(id: group.all_groups).pluck(:id)
    GroupExportWorker.perform_async(group_ids, group.name, actor.id)
  end

  def self.merge(source:, target:, actor:)
    actor.ability.authorize! :merge, source
    actor.ability.authorize! :merge, target

    Group.transaction do
      source.subgroups.update_all(parent_id: target.id)
      source.discussions.update_all(group_id: target.id)
      source.polls.update_all(group_id: target.id)
      source.membership_requests.update_all(group_id: target.id)
      source.group_identities.update_all(group_id: target.id)
      source.memberships.where.not(user_id: target.member_ids).update_all(group_id: target.id)
      source.destroy
    end
  end

  def self.suggest_handle(name:, parent_handle:)
    attempt = 0
    while(Group.where(handle: generate_handle(name, parent_handle, attempt)).exists?) do
      attempt += 1
    end
    generate_handle(name, parent_handle, attempt)
  end

  private

  def self.generate_handle(name, parent_handle, attempt)
    [parent_handle,
     name,
     (attempt == 0) ? nil : attempt].compact.map{|t| t.to_s.strip.parameterize}.join('-')
  end
end
