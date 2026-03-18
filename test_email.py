from dotenv import load_dotenv
load_dotenv()

from app.notifications import send_email_alert

recipient = "piyushmishra27j@gmail.com"
subject = "Test Alert from AI Medical Assistant"
body = """Hello,

This is a test email from your AI Medical Assistant backend.

If you received this, your SMTP email alerts are configured and working correctly!

- Medical Assistant System"""

print("Sending test email to " + recipient + "...")
success = send_email_alert(recipient, subject, body)

if success:
    print("SUCCESS: Email sent to " + recipient)
else:
    print("FAILED: Could not send email. Check logs above.")
