import re
from .clinical_data import get_symptom_alias_map, normalize_text

NEGATION_TERMS = ("no", "not", "without", "denies")


def is_negated(text: str, start_index: int):
    window_start = max(0, start_index - 25)
    prefix = text[window_start:start_index]
    return any(re.search(rf"\b{term}\b", prefix) for term in NEGATION_TERMS)


def extract_dataset_symptoms(text: str):
    detected_symptoms = set()
    symptom_aliases = get_symptom_alias_map()

    for alias, canonical_symptom in sorted(
        symptom_aliases.items(),
        key=lambda item: len(item[0]),
        reverse=True
    ):
        pattern = rf"(?<!\w){re.escape(alias)}(?!\w)"

        for match in re.finditer(pattern, text):
            if is_negated(text, match.start()):
                continue

            detected_symptoms.add(canonical_symptom)
            break

    return sorted(detected_symptoms)

def extract_health_data(patient_message: str):
    text = normalize_text(patient_message)

    pain_level = 0
    detected_symptoms = extract_dataset_symptoms(text)

    # Improved pain level extraction - more specific patterns
    pain_patterns = [
        r"pain\s*(?:level|score)?\s*(?:of|is)?\s*(\d+)",
        r"(\d+)\s*(?:out of\s*)?10\s*pain",
        r"pain.*?(\d+)",
        r"rate\s*(?:my\s*)?pain\s*(?:as\s*)?(\d+)",
        r"pain\s*(?:is\s*)?(\d+)"
    ]
    
    for pattern in pain_patterns:
        pain_match = re.search(pattern, text)
        if pain_match:
            pain_level = int(pain_match.group(1))
            # Validate pain level is within 0-10 range
            pain_level = max(0, min(10, pain_level))
            break

    # Enhanced medicine taken detection
    medicine_taken = False
    positive_patterns = [
        r"\b(took|taken|taking)\s+(my\s+)?(medicine|medicines|meds)\b",
        r"\b(medicine|medicines|meds)\s+(taken|took)\b",
        r"\bcompleted\s+(my\s+)?(medicine|medicines|meds)\b"
    ]
    
    negative_patterns = [
        r"\b(did not|didn't|not)\s+(take|taking)\s+(my\s+)?(medicine|medicines|meds)\b",
        r"\b(missed|skipped)\s+(my\s+)?(medicine|medicines|meds)\b",
        r"\b(forgot)\s+to\s+take\s+(my\s+)?(medicine|medicines|meds)\b"
    ]
    
    for pattern in positive_patterns:
        if re.search(pattern, text):
            medicine_taken = True
            break
    
    for pattern in negative_patterns:
        if re.search(pattern, text):
            medicine_taken = False
            break

    # Enhanced fever detection
    fever_indicators = [
        "fever", "high fever", "temperature", "high temperature", 
        "febrile", "pyrexia", "running temperature", "hot", "burning up"
    ]
    
    fever = any(indicator in text for indicator in fever_indicators)
    
    # Check for specific temperature values
    temp_patterns = [
        r"temperature\s*(?:of|is)?\s*(\d+(?:\.\d+)?)\s*(?:degrees?|°|f|c)",
        r"(\d+(?:\.\d+)?)\s*(?:degrees?|°|f|c)\s*temperature"
    ]
    
    for pattern in temp_patterns:
        temp_match = re.search(pattern, text)
        if temp_match:
            temp_value = float(temp_match.group(1))
            # Convert to Fahrenheit if needed and check for fever
            if "c" in text.lower() or "°c" in text.lower():
                temp_f = temp_value * 9/5 + 32
            else:
                temp_f = temp_value
            if temp_f >= 100.4:  # Standard fever threshold
                fever = True
                break

    return {
        "pain_level": pain_level,
        "fever": fever,
        "medicine_taken": medicine_taken,
        "symptoms_detected": detected_symptoms
    }
