from collections import Counter

from .clinical_data import load_disease_catalog


def rank_conditions(extracted_data, top_k=3):
    detected_symptoms = set(extracted_data.get("symptoms_detected", []))
    catalog = load_disease_catalog()

    if not detected_symptoms:
        return []

    ranked_matches = []

    for disease_name, symptom_combinations in catalog["disease_rows"].items():
        symptom_counts = Counter()
        for combination in symptom_combinations:
            symptom_counts.update(combination)

        matched = sorted(detected_symptoms & set(symptom_counts))
        if not matched:
            continue

        row_count = len(symptom_combinations)
        average_combination_size = sum(len(combination) for combination in symptom_combinations) / row_count
        support = sum(symptom_counts[symptom] / row_count for symptom in matched) / len(matched)
        coverage = len(matched) / len(detected_symptoms)
        specificity = len(matched) / average_combination_size
        confidence = round((coverage * 0.45) + (support * 0.25) + (specificity * 0.30), 2)
        confidence = min(confidence, 1.0)

        if len(matched) == 1:
            confidence = min(confidence, 0.35)

        ranked_matches.append(
            {
                "condition": disease_name,
                "confidence": confidence,
                "matched_symptoms": matched,
                "precautions": catalog["precautions"].get(disease_name, []),
                "alert_reason": f"Symptoms most closely match {disease_name}"
            }
        )

    ranked_matches.sort(
        key=lambda match: (-match["confidence"], -len(match["matched_symptoms"]), match["condition"])
    )

    return ranked_matches[:top_k]


def match_condition(extracted_data):
    ranked_matches = rank_conditions(extracted_data, top_k=1)
    if ranked_matches:
        return ranked_matches[0]

    return {
        "condition": None,
        "confidence": 0.0,
        "matched_symptoms": [],
        "precautions": [],
        "alert_reason": "No disease pattern matched"
    }
