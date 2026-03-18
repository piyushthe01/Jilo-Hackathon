import csv
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent / "data"
SYMPTOM_DATASET = DATA_DIR / "DiseaseAndSymptoms.csv"
PRECAUTION_DATASET = DATA_DIR / "Disease precaution.csv"

MANUAL_SYMPTOM_ALIASES = {
    "fever": "high fever",
    "high temperature": "high fever",
    "temperature": "high fever",
    "febrile": "high fever",
    "pyrexia": "high fever",
    "running temperature": "high fever",
    "hot": "high fever",
    "burning up": "high fever",
    "shortness of breath": "breathlessness",
    "difficulty breathing": "breathlessness",
    "trouble breathing": "breathlessness",
    "breathless": "breathlessness",
    "can't breathe": "breathlessness",
    "wheezing": "breathlessness",
    "chest tightness": "chest pain",
    "chest discomfort": "chest pain",
    "chest pressure": "chest pain",
    "sore throat": "throat irritation",
    "throat pain": "throat irritation",
    "throat scratchy": "throat irritation",
    "throwing up": "vomiting",
    "nauseous": "nausea",
    "queasy": "nausea",
    "loose motions": "diarrhoea",
    "diarrhea": "diarrhoea",
    "upset stomach": "stomach pain",
    "belly pain": "stomach pain",
    "abdominal pain": "stomach pain",
    "tummy pain": "stomach pain",
    "tired": "fatigue",
    "weakness": "fatigue",
    "exhausted": "fatigue",
    "coughing": "cough",
    "head pain": "headache",
    "migraine": "headache",
    "dizzy": "dizziness",
    "lightheaded": "dizziness",
    "chills": "chills",
    "shivering": "chills",
    "sweating": "sweating",
    "night sweats": "sweating",
    "loss of appetite": "loss of appetite",
    "no appetite": "loss of appetite",
    "body aches": "fatigue",
    "muscle pain": "fatigue",
    "joint pain": "fatigue"
}


def normalize_text(value):
    value = (value or "").strip().lower()
    value = value.replace("_", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip(" ,.-")


@lru_cache(maxsize=1)
def load_disease_catalog():
    disease_rows = defaultdict(list)

    with SYMPTOM_DATASET.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        symptom_columns = [name for name in (reader.fieldnames or []) if name.startswith("Symptom_")]

        for row in reader:
            disease_name = (row.get("Disease") or "").strip()
            symptoms = {
                normalize_text(row.get(column))
                for column in symptom_columns
                if normalize_text(row.get(column))
            }

            if disease_name and symptoms:
                disease_rows[disease_name].append(symptoms)

    precautions = defaultdict(list)
    with PRECAUTION_DATASET.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        precaution_columns = [name for name in (reader.fieldnames or []) if name.startswith("Precaution_")]

        for row in reader:
            disease_name = (row.get("Disease") or "").strip()
            if not disease_name:
                continue

            for column in precaution_columns:
                precaution = normalize_text(row.get(column))
                if precaution:
                    precautions[disease_name].append(precaution)

    return {
        "disease_rows": dict(disease_rows),
        "precautions": dict(precautions)
    }


@lru_cache(maxsize=1)
def get_symptom_alias_map():
    catalog = load_disease_catalog()
    alias_map = {}

    for disease_combinations in catalog["disease_rows"].values():
        for symptoms in disease_combinations:
            for symptom in symptoms:
                alias_map[symptom] = symptom

    for alias, symptom in MANUAL_SYMPTOM_ALIASES.items():
        alias_map[normalize_text(alias)] = normalize_text(symptom)

    return alias_map
