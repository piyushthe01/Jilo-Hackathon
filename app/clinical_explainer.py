def _humanize_symptom(symptom):
    return symptom.replace("_", " ")


def build_grounded_note(match, extracted_data):
    matched_symptoms = [_humanize_symptom(symptom) for symptom in match.get("matched_symptoms", [])]
    detected_symptoms = [_humanize_symptom(symptom) for symptom in extracted_data.get("symptoms_detected", [])]
    condition = match.get("condition") or "an unspecified condition"
    confidence = match.get("confidence", 0)

    if matched_symptoms:
        if len(matched_symptoms) == 1:
            symptom_summary = matched_symptoms[0]
        elif len(matched_symptoms) == 2:
            symptom_summary = f"{matched_symptoms[0]} and {matched_symptoms[1]}"
        else:
            symptom_summary = ", ".join(matched_symptoms[:-1]) + f", and {matched_symptoms[-1]}"
    elif detected_symptoms:
        symptom_summary = ", ".join(detected_symptoms)
    else:
        symptom_summary = "the available symptom pattern"

    if confidence >= 0.8:
        strength = "strongly aligns"
    elif confidence >= 0.6:
        strength = "reasonably aligns"
    else:
        strength = "partially aligns"

    note = f"This symptom pattern {strength} with {condition}, especially around {symptom_summary}."

    if condition in {"Heart attack", "Pneumonia", "Tuberculosis", "Typhoid", "Dengue", "Malaria", "Hepatitis E"}:
        note += " This match should be reviewed quickly because it may indicate a clinically significant condition."
    elif extracted_data.get("fever") or extracted_data.get("pain_level", 0) >= 5:
        note += " The pattern still deserves follow-up because fever or notable pain is present."
    else:
        note += " The match is lower urgency, but it can still guide follow-up and triage."

    return note
