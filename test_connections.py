import os
import sys
import requests
from pathlib import Path

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent / "app"))

def test_environment_variables():
    """Test if all required environment variables are set"""
    print("🔍 Testing Environment Variables...")
    
    required_vars = [
        "OPENAI_API_KEY",
        "DATABASE_URL"
    ]
    
    optional_vars = [
        "ELEVENLABS_API_KEY",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN"
    ]
    
    missing_required = []
    missing_optional = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_required.append(var)
    
    for var in optional_vars:
        if not os.getenv(var):
            missing_optional.append(var)
    
    if missing_required:
        print(f"❌ Missing required environment variables: {missing_required}")
        return False
    
    if missing_optional:
        print(f"⚠️  Missing optional environment variables: {missing_optional}")
    
    print("✅ Environment variables check passed")
    return True

def test_openai_connection():
    """Test OpenAI API connection"""
    print("\n🤖 Testing OpenAI Connection...")
    
    try:
        from openai import OpenAI
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("❌ OpenAI API key not found")
            return False
        
        client = OpenAI(api_key=api_key)
        
        # Test chat completions
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'test'"}],
            max_tokens=5
        )
        
        if response.choices[0].message.content:
            print("✅ OpenAI Chat Completions working")
        else:
            print("❌ OpenAI Chat Completions failed")
            return False
        
        # Test TTS
        speech_response = client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice="nova",
            input="Test connection"
        )
        
        if speech_response.content:
            print("✅ OpenAI TTS working")
        else:
            print("❌ OpenAI TTS failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ OpenAI connection failed: {e}")
        return False

def test_elevenlabs_connection():
    """Test ElevenLabs API connection"""
    print("\n🎙️  Testing ElevenLabs Connection...")
    
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("⚠️  ElevenLabs API key not found (optional)")
        return True
    
    try:
        url = "https://api.elevenlabs.io/v1/voices"
        headers = {"xi-api-key": api_key}
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            voices = response.json()
            print(f"✅ ElevenLabs working - Found {len(voices.get('voices', []))} voices")
            return True
        else:
            print(f"❌ ElevenLabs failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ElevenLabs connection failed: {e}")
        return False

def test_database_connection():
    """Test database connection"""
    print("\n🗄️  Testing Database Connection...")
    
    try:
        from app.database import engine, SessionLocal
        from sqlalchemy import text
        
        # Test engine connection
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            if result.fetchone():
                print("✅ Database engine connection working")
        
        # Test session creation
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            print("✅ Database session working")
            return True
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_smtp_connection():
    """Test SMTP connection"""
    print("\n📧 Testing SMTP Connection...")
    
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    
    if not username or not password:
        print("⚠️  SMTP credentials not found (optional)")
        return True
    
    try:
        import smtplib
        from email.mime.text import MIMEText
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        
        # Test login (without actually sending)
        server.login(username, password)
        server.quit()
        
        print("✅ SMTP connection working")
        return True
        
    except Exception as e:
        print(f"❌ SMTP connection failed: {e}")
        return False

def test_twilio_connection():
    """Test Twilio connection"""
    print("\n📱 Testing Twilio Connection...")
    
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if not account_sid or not auth_token:
        print("⚠️  Twilio credentials not found (optional)")
        return True
    
    try:
        from twilio.rest import Client
        
        client = Client(account_sid, auth_token)
        
        # Test account info
        account = client.api.accounts(account_sid).fetch()
        
        if account.sid:
            print("✅ Twilio connection working")
            return True
        else:
            print("❌ Twilio connection failed")
            return False
            
    except Exception as e:
        print(f"❌ Twilio connection failed: {e}")
        return False

def test_internal_modules():
    """Test internal module imports and basic functionality"""
    print("\n🔧 Testing Internal Modules...")
    
    try:
        # Test AI agent
        from app.ai_agent import extract_health_data
        test_data = extract_health_data("I have chest pain and fever, pain level 7")
        if test_data:
            print("✅ AI Agent working")
        else:
            print("❌ AI Agent failed")
            return False
        
        # Test risk engine
        from app.risk_engine import detect_risk
        risk = detect_risk(test_data, patient_age=45)
        if risk in ["HIGH", "MEDIUM", "LOW"]:
            print("✅ Risk Engine working")
        else:
            print("❌ Risk Engine failed")
            return False
        
        # Test disease matcher
        from app.disease_matcher import match_condition
        condition = match_condition(test_data)
        if condition:
            print("✅ Disease Matcher working")
        else:
            print("❌ Disease Matcher failed")
            return False
        
        # Test clinical data
        from app.clinical_data import load_disease_catalog
        catalog = load_disease_catalog()
        if catalog and "disease_rows" in catalog:
            print("✅ Clinical Data loading working")
        else:
            print("❌ Clinical Data loading failed")
            return False
        
        # Test voice automation
        from app.openai_followup_automation import _get_language_tts_instructions
        instructions = _get_language_tts_instructions("english")
        if instructions:
            print("✅ Voice Automation working")
        else:
            print("❌ Voice Automation failed")
            return False
        
        # Test logging
        from app.logging_config import logger
        logger.info("Test log message")
        print("✅ Logging system working")
        
        return True
        
    except Exception as e:
        print(f"❌ Internal modules test failed: {e}")
        return False

def main():
    """Run all connection tests"""
    print("🚀 Starting Comprehensive Backend Connection Tests\n")
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Database", test_database_connection),
        ("Internal Modules", test_internal_modules),
        ("OpenAI", test_openai_connection),
        ("ElevenLabs", test_elevenlabs_connection),
        ("SMTP", test_smtp_connection),
        ("Twilio", test_twilio_connection),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*50)
    print("📊 TEST SUMMARY")
    print("="*50)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\n📈 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n🎉 ALL BACKEND CONNECTIONS WORKING! System is ready for production.")
        return True
    else:
        print(f"\n⚠️  {failed} connection(s) need attention before production use.")
        return False

if __name__ == "__main__":
    main()
