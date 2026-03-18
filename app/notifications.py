import os
import smtplib
from email.message import EmailMessage
from datetime import datetime

# Initialize Twilio only if configured
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME or "noreply@hospital.local")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")

def send_email_alert(recipient_email: str, subject: str, message: str):
    """Sends an email alert using standard SMTP."""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"[MOCK EMAIL] To: {recipient_email} | Subject: {subject}\n{message}")
        print("Note: Configure SMTP_USERNAME and SMTP_PASSWORD in .env to send real emails.")
        return False
        
    try:
        msg = EmailMessage()
        msg.set_content(message)
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = recipient_email

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email alert: {e}")
        return False


def send_whatsapp_alert(recipient_phone: str, message: str):
    """Sends a WhatsApp alert using Twilio."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print(f"[MOCK WHATSAPP] To: whatsapp:{recipient_phone} | Msg: {message}")
        print("Note: Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env to send real WhatsApps.")
        return False

    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        # Twilio expects 'whatsapp:+1234567890' format
        if not recipient_phone.startswith("whatsapp:"):
            # Ensure proper string formatting for testing
            formatted_phone = f"whatsapp:{recipient_phone}" if "+" in recipient_phone else f"whatsapp:+{recipient_phone}"
        else:
            formatted_phone = recipient_phone

        sent_msg = client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            body=message,
            to=formatted_phone
        )
        return bool(sent_msg.sid)
    except TwilioRestException as e:
        print(f"Twilio error sending WhatsApp alert: {e}")
        return False
    except Exception as e:
        print(f"Failed to send WhatsApp alert: {e}")
        return False
