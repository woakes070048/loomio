module Events::Notify::InApp
  include PrettyUrlHelper

  def trigger!
    super
    notify_users!
  end

  # send event notifications
  def notify_users!
    notifications.import(built_notifications)
    built_notifications.each { |n| MessageChannelService.publish_models(Array(n), user_id: n.user_id) }
  end

  private

  def built_notifications
    @built ||= notification_recipients.active.map { |recipient| notification_for(recipient) }
  end

  def notification_for(recipient)
    I18n.with_locale(recipient.locale) do
      notifications.build(
        user: recipient,
        actor: notification_actor,
        url: notification_url,
        translation_values: notification_translation_values
      )
    end
  end

  # defines the avatar which appears next to the notification
  def notification_actor
    user.presence
  end

  # defines the link that clicking on the notification takes you to
  def notification_url
    polymorphic_path(eventable)
  end

  # defines the values that are passed to the translation for notification text
  # by default we infer the values needed from the eventable class,
  # but this method can be overridden with any translation values for a particular event
  def notification_translation_values
    {
      name: notification_translation_name,
      title: notification_translation_title,
      poll_type: (I18n.t(:"poll_types.#{notification_poll_type}") if notification_poll_type)
    }.compact
  end

  def notification_translation_name
    notification_actor&.name
  end

  def notification_translation_title
    polymorphic_title(eventable)
  end

  def notification_poll_type
    eventable.poll_type if eventable.respond_to?(:poll_type)
  end
end
