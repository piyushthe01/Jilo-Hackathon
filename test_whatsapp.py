import os
from dotenv import load_dotenv

load_dotenv()

from app.notifications import send_whatsapp_alert

phone = "+918176946388"
message = "Hello from your AI Medical Assistant! Your Twilio WhatsApp integration was just configured successfully."

print("Sending WhatsApp alert...")
success = send_whatsapp_alert(phone, message)

if success:
    print("SUCCESS: Message sent to " + phone)
else:
    print("FAILED: Could not send to " + phone)
