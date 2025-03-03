require 'rails_helper'

describe MembershipService do
  let(:group) { create :group, discussion_privacy_options: :public_only, is_visible_to_public: true, membership_granted_upon: :request }
  let(:user)  { create :user }
  let(:admin) { create :user }
  let(:unverified_user) { create :user, email_verified: false }
  let(:unverified_user_membership) { create :membership, group: group, user: unverified_user, accepted_at: nil }

  before { group.add_admin! admin }

  describe 'revoke' do
    let!(:subgroup) { create :group, parent: group }
    let!(:subgroup_discussion) { create :discussion, group: subgroup, private: false }
    let!(:discussion) { create :discussion, group: group, private: false }
    let!(:poll) { create :poll, group: group }
    let!(:membership) { create :membership, user: user, group: group }

    it 'cascade deletes memberships' do
      subgroup.add_member! user
      subgroup_discussion.add_guest! user, subgroup_discussion.author
      reader = discussion.add_guest! user, discussion.author
      stance = poll.add_guest!(user, discussion.author)
      expect(stance.inviter_id).to eq discussion.author_id
      expect(reader.inviter_id).to eq discussion.author_id
      expect(stance.guest).to eq true
      expect(reader.guest).to eq true
      MembershipService.revoke(membership: membership, actor: user)
      expect(subgroup.members).to_not include user
      expect(subgroup_discussion.members).to_not include user
      expect(discussion.members).to_not include user
      expect(poll.members).to_not include user
      expect(reader.reload.guest).to eq false
      expect(stance.reload.guest).to eq false
    end

    it 'marks discussion readers as revoked' do
      discussion_reader = DiscussionReader.create(discussion: discussion, user: user)
      expect(discussion_reader.revoked_at).to be nil
      MembershipService.revoke(membership: membership, actor: user)
      discussion_reader.reload
      expect(discussion_reader.revoked_at).to be_present
    end
  end

  describe 'redeem' do
    let!(:another_subgroup) { create :group, parent: group }
    let!(:discussion) { create :discussion, group: group, private: false }
    let!(:poll) { create :poll, group: group }
    let(:first_inviter) { create :user }
    let(:second_inviter) { create :user }
    let(:yesterday) { 1.day.ago }
    let(:today) { DateTime.now }

    before do
      group.add_admin! first_inviter
      group.add_admin! second_inviter
    end

    # verified user claims unverified users invitiation
    it 'sets accepted_at' do
      MembershipService.redeem(membership: unverified_user_membership, actor: user)
      unverified_user_membership.reload.accepted_at.should be_present
    end

    it "handles simple case" do
      new_membership = Membership.create!(user_id: user.id, group_id: group.id, inviter_id: first_inviter.id)
      MembershipService.redeem(membership: new_membership, actor: user)
      expect(new_membership.reload.user_id).to eq user.id
      expect(new_membership.reload.accepted_at).to be_present
      expect(new_membership.reload.inviter_id).to eq first_inviter.id
      expect(new_membership.reload.revoked_at).to_not be_present
    end

    it "handles existing memberships" do
      existing_membership = Membership.create!(user_id: user.id, group_id: group.id, accepted_at: yesterday, inviter_id: first_inviter.id)
      new_membership = Membership.create!(user_id: unverified_user.id, group_id: group.id, inviter_id: second_inviter.id)
      MembershipService.redeem(membership: new_membership, actor: user)
      expect(existing_membership.reload.user_id).to eq user.id
      expect(existing_membership.reload.accepted_at).to_not be yesterday
      expect(existing_membership.reload.accepted_at).to be_present
      expect(existing_membership.reload.inviter_id).to eq first_inviter.id
      expect(existing_membership.reload.revoked_at).to_not be_present
    end

    it "handles revoked memberships" do
      existing_membership = Membership.create!(user_id: user.id, group_id: group.id, accepted_at: DateTime.now, revoked_at: DateTime.now, inviter_id: first_inviter.id, revoker_id: first_inviter.id)
      new_membership = Membership.create!(user_id: unverified_user.id, group_id: group.id, inviter_id: second_inviter.id)
      MembershipService.redeem(membership: new_membership, actor: user)
      expect(existing_membership.reload.user_id).to eq user.id
      expect(existing_membership.reload.inviter_id).to eq second_inviter.id
      expect(existing_membership.reload.accepted_at).to be_present
      expect(existing_membership.reload.revoked_at).to_not be_present
    end

    it 'unrevokes discussion readers and stances' do
      reader = discussion.add_guest! user, discussion.author
      stance = poll.add_guest!(user, discussion.author)
      reader.update(revoked_at: DateTime.now)
      stance.update(revoked_at: DateTime.now)
      expect(stance.revoked_at).to_not eq nil
      expect(reader.revoked_at).to_not eq nil
      expect(stance.guest).to eq true
      expect(reader.guest).to eq true
      MembershipService.redeem(membership: unverified_user_membership, actor: user)
      expect(stance.reload.guest).to eq false
      expect(reader.reload.guest).to eq false
      expect(stance.reload.revoked_at).to eq nil
      expect(reader.reload.revoked_at).to eq nil
    end

    it 'notifies the invitor of acceptance' do
      MembershipService.redeem(membership: unverified_user_membership, actor: user)
      expect(Event.last.kind).to eq 'invitation_accepted'
    end
  end

  describe 'with alien group' do
    let!(:alien_group) { create :group }
    let(:membership) { create :membership, group: group, inviter: admin, user: user, experiences: { invited_group_ids: [alien_group.id] }, accepted_at: nil  }

    before do
      MembershipService.redeem(membership: membership, actor: user)
    end

    it 'cannot invite user to alien group' do
      expect(alien_group.members).to_not include user
    end
  end
end
