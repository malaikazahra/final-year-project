import smtplib
from datetime import datetime
from email.message import EmailMessage

from flask import current_app


def send_password_reset_email(to_email, reset_link):
    sent_at = datetime.now().strftime("%I:%M %p")
    subject = f"PostureGuard reset code - {sent_at}"
    body = (
        "Hello,\n\n"
        "We received a request to reset your PostureGuard password.\n\n"
        f"Reset your password using this link:\n{reset_link}\n\n"
        "This link expires in 15 minutes. If you did not request this, you can ignore this email.\n\n"
        "PostureGuard Team"
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>Reset your PostureGuard password</h2>
      <p>We received a request to reset your PostureGuard password.</p>
      <p>
        <a href="{reset_link}" style="display:inline-block;background:#0891b2;color:#ffffff;
        padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">
          Reset password
        </a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;"><a href="{reset_link}">{reset_link}</a></p>
      <p>This link expires in 60 minutes. If you did not request this, you can ignore this email.</p>
      <p>PostureGuard Team</p>
    </div>
    """

    server = current_app.config.get("MAIL_SERVER")
    username = current_app.config.get("MAIL_USERNAME")
    password = (current_app.config.get("MAIL_PASSWORD") or "").replace(" ", "")
    sender = current_app.config.get("MAIL_DEFAULT_SENDER")

    if not server or not username or not password:
        current_app.logger.warning(
            "Password reset email not sent because SMTP is not configured. Reset link: %s",
            reset_link,
        )
        print(f"\n[PostureGuard password reset link]\n{reset_link}\n")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"PostureGuard <{sender}>"
    message["Reply-To"] = sender
    message["To"] = to_email
    message.set_content(body)
    message.add_alternative(html_body, subtype="html")

    port = current_app.config.get("MAIL_PORT", 587)
    smtp_class = smtplib.SMTP_SSL if current_app.config.get("MAIL_USE_SSL", False) else smtplib.SMTP

    with smtp_class(server, port, timeout=15) as smtp:
        if current_app.config.get("MAIL_USE_TLS", True) and not current_app.config.get("MAIL_USE_SSL", False):
            smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(message)

    return True
