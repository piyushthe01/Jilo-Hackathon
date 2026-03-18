def detect_risk(extracted_data, condition_match=None, patient_age=None):
    """
    Enhanced risk assessment considering multiple factors including age, symptoms, and condition confidence
    Returns: 'HIGH', 'MEDIUM', 'LOW'
    """
    pain_level = extracted_data.get("pain_level", 0)
    fever = extracted_data.get("fever", False)
    symptoms = set(extracted_data.get("symptoms_detected", []))
    confidence = (condition_match or {}).get("confidence", 0)
    matched_symptoms = (condition_match or {}).get("matched_symptoms", [])
    probable_condition = (condition_match or {}).get("condition")
    
    # High-risk conditions that require immediate attention
    high_risk_conditions = {
        "Heart attack", "Myocardial infarction", "Cardiac arrest",
        "Pneumonia", "Severe pneumonia",
        "Tuberculosis", "Active TB",
        "Typhoid", "Typhoid fever",
        "Dengue", "Dengue hemorrhagic fever",
        "Malaria", "Falciparum malaria",
        "Hepatitis E", "Acute hepatitis",
        "Sepsis", "Septic shock",
        "Stroke", "Cerebrovascular accident"
    }
    
    # Critical symptom combinations that indicate emergency
    critical_combinations = [
        {"chest pain", "breathlessness"},
        {"chest pain", "sweating"},
        {"chest pain", "dizziness"},
        {"breathlessness", "high fever"},
        {"confusion", "high fever"},
        {"severe headache", "fever"},
        {"stiff neck", "fever"}
    ]
    
    # Age-based risk factors
    age_risk_factor = 1.0
    if patient_age:
        if patient_age >= 65:
            age_risk_factor = 1.5  # Elderly patients at higher risk
        elif patient_age <= 12:
            age_risk_factor = 1.3  # Pediatric patients at higher risk
        elif patient_age >= 50:
            age_risk_factor = 1.2  # Middle-aged and older adults

    # HIGH RISK CONDITIONS
    # 1. Critical symptom combinations
    for combo in critical_combinations:
        if combo <= symptoms:
            return "HIGH"
    
    # 2. Severe pain (adjusted for age)
    severe_pain_threshold = 8 if patient_age and patient_age < 50 else 7
    if pain_level >= severe_pain_threshold:
        return "HIGH"
    
    # 3. Critical individual symptoms
    critical_symptoms = {"chest pain", "breathlessness", "confusion", "seizure", "unconsciousness"}
    if critical_symptoms & symptoms:
        return "HIGH"
    
    # 4. High-risk conditions with good confidence
    if probable_condition in high_risk_conditions and confidence >= 0.7 * age_risk_factor:
        return "HIGH"
    
    # 5. Multiple symptoms with high confidence
    if confidence >= 0.6 and len(matched_symptoms) >= 3:
        return "HIGH"
    
    # 6. Fever with concerning symptoms (adjusted for age)
    fever_concerning_symptoms = {"breathlessness", "chest pain", "confusion", "stiff neck"}
    if fever and (fever_concerning_symptoms & symptoms):
        return "HIGH"
    
    # MEDIUM RISK CONDITIONS
    # 1. Moderate pain with fever
    if fever and pain_level >= 5:
        return "MEDIUM"
    
    # 2. Moderate confidence with multiple symptoms
    if confidence >= 0.5 and len(matched_symptoms) >= 2:
        return "MEDIUM"
    
    # 3. Single concerning symptom
    concerning_symptoms = {"persistent cough", "vomiting", "diarrhoea", "dizziness"}
    if concerning_symptoms & symptoms:
        return "MEDIUM"
    
    # 4. Any fever in elderly or very young patients
    if fever and patient_age and (patient_age >= 65 or patient_age <= 5):
        return "MEDIUM"
    
    # 5. Moderate pain level
    if pain_level >= 6:
        return "MEDIUM"
    
    # 6. Medicine non-adherence with symptoms
    if not extracted_data.get("medicine_taken", True) and symptoms:
        return "MEDIUM"
    
    # LOW RISK CONDITIONS
    # 1. Mild symptoms only
    if symptoms and len(symptoms) <= 2 and pain_level < 4:
        return "LOW"
    
    # 2. Low confidence condition matches
    if confidence >= 0.3 and confidence < 0.5:
        return "LOW"
    
    # 3. Mild pain only
    if pain_level >= 2 and pain_level < 5 and not fever and not symptoms:
        return "LOW"
    
    # Default to LOW if no concerning factors
    return "LOW"
