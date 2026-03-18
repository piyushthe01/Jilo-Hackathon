"""
Enhanced data validation and medical safety checks
"""
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime

class PatientCreate(BaseModel):
    """Validated patient creation schema"""
    name: str = Field(..., min_length=2, max_length=100, description="Patient full name")
    phone: str = Field(..., description="Patient phone number with country code")
    language: str = Field(default="English", description="Preferred language")
    age: Optional[int] = Field(None, ge=0, le=120, description="Patient age in years")
    gender: Optional[str] = Field(None, pattern="^(Male|Female|Other)$", description="Patient gender")
    emergency_contact: Optional[str] = Field(None, description="Emergency contact phone")
    
    @validator('phone')
    def validate_phone(cls, v):
        """Validate phone number format"""
        if not v:
            raise ValueError('Phone number is required')
        # Basic international phone validation
        cleaned = re.sub(r'[\s\-\(\)\.]', '', v)
        if not re.match(r'^\+?[1-9]\d{9,14}$', cleaned):
            raise ValueError('Invalid phone number format. Use international format: +1234567890')
        return cleaned
    
    @validator('emergency_contact')
    def validate_emergency_contact(cls, v):
        """Validate emergency contact if provided"""
        if v:
            cleaned = re.sub(r'[\s\-\(\)\.]', '', v)
            if not re.match(r'^\+?[1-9]\d{9,14}$', cleaned):
                raise ValueError('Invalid emergency contact format')
        return v
    
    @validator('age')
    def validate_age(cls, v):
        """Validate age is reasonable for medical context"""
        if v is not None:
            if v < 0 or v > 120:
                raise ValueError('Age must be between 0 and 120')
            if v < 18:
                # Flag pediatric patients for special handling
                pass  # Age is valid, just noted
        return v

class FollowUpCreate(BaseModel):
    """Validated follow-up creation schema"""
    patient_id: int = Field(..., gt=0, description="Patient ID")
    pain_level: int = Field(default=0, ge=0, le=10, description="Pain level 0-10")
    fever: bool = Field(default=False, description="Fever present")
    medicine_taken: bool = Field(default=False, description="Medicine adherence")
    input_source: str = Field(default="text", pattern="^(text|audio)$")
    transcript: Optional[str] = Field(None, max_length=5000)
    normalized_message: Optional[str] = Field(None, max_length=5000)
    language_hint: Optional[str] = Field(None, max_length=50)
    
    @validator('pain_level')
    def validate_pain_level(cls, v):
        """Ensure pain level is within medical scale"""
        if v < 0 or v > 10:
            raise ValueError('Pain level must be between 0 and 10')
        return v
    
    @validator('transcript', 'normalized_message')
    def validate_message_content(cls, v):
        """Sanitize message content"""
        if v:
            # Remove potentially harmful characters
            v = re.sub(r'[<>]', '', v)
            # Check for reasonable length
            if len(v) > 5000:
                raise ValueError('Message too long (max 5000 characters)')
        return v

class MedicalSafetyValidator:
    """Medical safety validation and alerts"""
    
    CRITICAL_SYMPTOMS = {
        'chest_pain': ['chest pain', 'chest tightness', 'chest pressure'],
        'breathlessness': ['breathlessness', 'shortness of breath', 'difficulty breathing'],
        'severe_pain': ['severe pain', 'excruciating pain', 'unbearable pain'],
        'consciousness': ['unconscious', 'unresponsive', 'passed out', 'fainted'],
        'bleeding': ['severe bleeding', 'uncontrolled bleeding', 'hemorrhage']
    }
    
    PEDIATRIC_THRESHOLDS = {
        'min_age': 0,
        'max_age': 18,
        'fever_temp_c': 38.0,  # 100.4°F
        'high_fever_temp_c': 39.0  # 102.2°F
    }
    
    GERIATRIC_THRESHOLDS = {
        'min_age': 65,
        'pain_severe_threshold': 6,  # Lower threshold for elderly
        'fever_temp_c': 37.5  # 99.5°F - elderly have lower baseline
    }
    
    @classmethod
    def validate_critical_symptoms(cls, symptoms: List[str], pain_level: int, 
                                 age: Optional[int] = None) -> Dict[str, Any]:
        """Check for critical symptoms requiring immediate attention"""
        alerts = []
        risk_level = "LOW"
        
        symptom_text = ' '.join(symptoms).lower()
        
        # Check critical symptom combinations
        if any(term in symptom_text for term in cls.CRITICAL_SYMPTOMS['chest_pain']) and \
           any(term in symptom_text for term in cls.CRITICAL_SYMPTOMS['breathlessness']):
            alerts.append("CRITICAL: Chest pain with breathlessness - possible cardiac emergency")
            risk_level = "HIGH"
        
        # Check severe pain
        if pain_level >= 9:
            alerts.append(f"CRITICAL: Severe pain level {pain_level}/10")
            risk_level = "HIGH"
        elif pain_level >= 7:
            alerts.append(f"HIGH: Significant pain level {pain_level}/10")
            if risk_level == "LOW":
                risk_level = "MEDIUM"
        
        # Age-specific validations
        if age is not None:
            # Pediatric checks
            if age <= cls.PEDIATRIC_THRESHOLDS['max_age']:
                if pain_level >= 7:
                    alerts.append(f"PEDIATRIC ALERT: High pain in {age} year old patient")
                    risk_level = "HIGH"
            
            # Geriatric checks
            if age >= cls.GERIATRIC_THRESHOLDS['min_age']:
                if pain_level >= cls.GERIATRIC_THRESHOLDS['pain_severe_threshold']:
                    alerts.append(f"GERIATRIC ALERT: Significant pain in {age} year old patient")
                    if risk_level == "LOW":
                        risk_level = "MEDIUM"
        
        # Check consciousness issues
        if any(term in symptom_text for term in cls.CRITICAL_SYMPTOMS['consciousness']):
            alerts.append("CRITICAL: Altered consciousness - immediate evaluation required")
            risk_level = "HIGH"
        
        return {
            "risk_level": risk_level,
            "alerts": alerts,
            "requires_immediate_attention": risk_level == "HIGH"
        }
    
    @classmethod
    def validate_medicine_safety(cls, medicine_taken: bool, symptoms: List[str], 
                                age: Optional[int] = None) -> List[str]:
        """Validate medicine adherence safety"""
        warnings = []
        
        if not medicine_taken and symptoms:
            symptom_text = ' '.join(symptoms).lower()
            
            # Check for conditions where missing medicine is dangerous
            dangerous_without_meds = [
                'diabetes', 'hypertension', 'heart disease', 'asthma',
                'epilepsy', 'transplant', 'blood thinner', 'insulin'
            ]
            
            for condition in dangerous_without_meds:
                if condition in symptom_text:
                    warnings.append(f"MEDICINE ALERT: Patient not taking medication with {condition}")
        
        # Pediatric medicine adherence
        if age and age < 12 and not medicine_taken and symptoms:
            warnings.append("PEDIATRIC MEDICINE ALERT: Child not taking prescribed medication")
        
        return warnings
    
    @classmethod
    def get_safety_recommendations(cls, risk_level: str, age: Optional[int] = None) -> List[str]:
        """Get safety recommendations based on risk level"""
        recommendations = []
        
        if risk_level == "HIGH":
            recommendations.extend([
                "URGENT: Contact patient immediately",
                "URGENT: Alert medical team for immediate evaluation",
                "URGENT: Consider emergency services if patient unresponsive",
                "Document all actions taken in patient record"
            ])
        elif risk_level == "MEDIUM":
            recommendations.extend([
                "Schedule follow-up call within 2-4 hours",
                "Alert care coordinator for monitoring",
                "Verify patient has access to emergency contacts"
            ])
            
            if age and age >= 65:
                recommendations.append("GERIATRIC: Consider home health visit")
        
        # Age-specific recommendations
        if age and age < 18:
            recommendations.append("PEDIATRIC: Notify parents/guardians")
        
        return recommendations

def sanitize_patient_input(text: str) -> str:
    """Sanitize patient input to prevent injection attacks"""
    if not text:
        return ""
    
    # Remove potential SQL injection patterns
    sql_patterns = [
        r'(--|#|/\*|\*/|;)',  # SQL comments and terminators
        r'(union|select|insert|update|delete|drop|create|alter|exec|execute)',
        r'(script|javascript|onerror|onload)',  # XSS patterns
    ]
    
    cleaned = text
    for pattern in sql_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Remove excessive whitespace
    cleaned = ' '.join(cleaned.split())
    
    # Limit length
    if len(cleaned) > 5000:
        cleaned = cleaned[:5000]
    
    return cleaned.strip()

def validate_phone_international(phone: str) -> tuple[bool, str]:
    """
    Validate international phone number format
    Returns: (is_valid, formatted_number)
    """
    if not phone:
        return False, ""
    
    # Remove all non-numeric characters except +
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    # Check if it starts with +
    if not cleaned.startswith('+'):
        # Assume it's a local number, add default country code
        cleaned = '+1' + cleaned  # Default to US/Canada
    
    # Validate length (should be + followed by 10-15 digits)
    if not re.match(r'^\+\d{10,15}$', cleaned):
        return False, cleaned
    
    return True, cleaned
