module Events::Notify::ByEmail
  def trigger!
    super
    email_users!
  end

  # send event emails
  def email_users!
    email_recipients.active.no_spam_complaints.uniq.pluck(:id).each do |recipient_id|
      EventMailer.event(recipient_id, self.id).deliver_later
    end
  end

  def wait_time
    1.minute
  end
end
