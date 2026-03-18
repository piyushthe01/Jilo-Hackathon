import gzip
import json
import re
from functools import lru_cache
from pathlib import Path

from pypdf import PdfReader

from .clinical_data import normalize_text


BOOK_PATH = Path(__file__).resolve().parent / "data" / "Harrison.pdf"
CACHE_PATH = Path(__file__).resolve().parent / "data" / "harrison_pages.json.gz"
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
    "in", "is", "it", "of", "on", "or", "that", "the", "to", "was", "with"
}
CONDITION_QUERY_EXPANSIONS = {
    "Heart attack": ["myocardial infarction", "acute coronary syndrome"],
    "Common Cold": ["common cold", "upper respiratory infection"],
    "Typhoid": ["enteric fever", "typhoid fever"],
    "Tuberculosis": ["tuberculosis", "tb"],
    "Hypertension": ["hypertension", "high blood pressure"],
    "Malaria": ["malaria"],
    "Dengue": ["dengue"],
    "Pneumonia": ["pneumonia"],
    "Hepatitis B": ["hepatitis b"],
    "Hepatitis C": ["hepatitis c"],
    "Hepatitis E": ["hepatitis e"],
    "Gastroenteritis": ["gastroenteritis", "acute diarrhea", "acute diarrhoea"]
}


def _tokenize(text):
    return [
        token for token in re.findall(r"[a-z0-9]+", normalize_text(text))
        if len(token) > 2 and token not in STOPWORDS
    ]
@lru_cache(maxsize=1)
def load_book_pages():
    if CACHE_PATH.exists():
        with gzip.open(CACHE_PATH, "rt", encoding="utf-8") as cache_file:
            return json.load(cache_file)

    reader = PdfReader(str(BOOK_PATH))
    pages = []

    for page_index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        normalized = normalize_text(text)
        pages.append(
            {
                "page": page_index + 1,
                "text": text,
                "normalized": normalized
            }
        )

    with gzip.open(CACHE_PATH, "wt", encoding="utf-8") as cache_file:
        json.dump(pages, cache_file)

    return pages


def _build_snippet(page_text, anchor_terms):
    normalized = normalize_text(page_text)
    position = 0

    for term in anchor_terms:
        position = normalized.find(term)
        if position != -1:
            break

    start = max(position - 160, 0)
    end = min(position + 380, len(normalized))
    return normalized[start:end].strip()


def retrieve_references(probable_condition=None, symptoms=None, top_k=3):
    symptoms = symptoms or []
    query_terms = []
    boosted_phrases = []

    if probable_condition:
        for phrase in CONDITION_QUERY_EXPANSIONS.get(probable_condition, []):
            query_terms.extend(_tokenize(phrase))
            boosted_phrases.append(normalize_text(phrase))
        query_terms.extend(_tokenize(probable_condition))
        boosted_phrases.append(normalize_text(probable_condition))

    for symptom in symptoms:
        query_terms.extend(_tokenize(symptom))

    query_terms = list(dict.fromkeys(query_terms))
    if not query_terms:
        return []

    exact_matches = []
    seen_pages = set()
    for phrase in boosted_phrases:
        if not phrase:
            continue

        for page in load_book_pages():
            position = page["normalized"].find(phrase)
            if position == -1 or page["page"] in seen_pages:
                continue

            start = max(position - 160, 0)
            end = min(position + 380, len(page["normalized"]))
            exact_matches.append(
                {
                    "page": page["page"],
                    "score": 18.0,
                    "snippet": page["normalized"][start:end].strip()
                }
            )
            seen_pages.add(page["page"])

            if len(exact_matches) >= top_k:
                return exact_matches

    scored_pages = []
    for page in load_book_pages():
        score = 0.0
        page_tokens = _tokenize(page["text"])
        token_counts = {}
        for token in page_tokens:
            token_counts[token] = token_counts.get(token, 0) + 1

        for term in query_terms:
            if term in token_counts:
                score += 1.0 + min(token_counts[term] * 0.15, 0.75)

        for phrase in boosted_phrases:
            if phrase and phrase in page["normalized"]:
                score += 4.0

        joined_symptoms = [normalize_text(symptom) for symptom in symptoms if symptom]
        phrase_hits = sum(1 for symptom in joined_symptoms if symptom in page["normalized"])
        score += phrase_hits * 0.8

        if score <= 0:
            continue

        scored_pages.append(
            {
                "page": page["page"],
                "score": round(score, 2),
                "snippet": _build_snippet(page["text"], boosted_phrases + joined_symptoms + query_terms)
            }
        )

    scored_pages.sort(key=lambda item: (-item["score"], item["page"]))

    deduped = list(exact_matches)
    seen = {(item["page"], item["snippet"][:120]) for item in exact_matches}
    for item in scored_pages:
        key = (item["page"], item["snippet"][:120])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= top_k:
            break

    return deduped
