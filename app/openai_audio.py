import base64
import io
import os
from pathlib import Path

from openai import OpenAI

TRANSCRIPTION_MODEL = "whisper-1"
NORMALIZATION_MODEL = "gpt-4o-mini"
MAX_AUDIO_BYTES = 25 * 1024 * 1024
SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".m4a",
    ".wav",
    ".webm",
}
LANGUAGE_HINT_ALIASES = {
    "en": "en",
    "english": "en",
    "hi": "hi",
    "hindi": "hi",
    "ta": "ta",
    "tamil": "ta",
    "te": "te",
    "telugu": "te",
    "kn": "kn",
    "kannada": "kn",
    "ml": "ml",
    "malayalam": "ml",
    "gu": "gu",
    "gujarati": "gu",
    "mr": "mr",
    "marathi": "mr",
    "bn": "bn",
    "bengali": "bn",
    "or": "or",
    "odia": "or",
    "oriya": "or",
    "pa": "pa",
    "punjabi": "pa",
    "ur": "ur",
    "urdu": "ur",
}


def _get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured for audio transcription.")
    if api_key.strip() == "your_openai_api_key_here":
        raise RuntimeError(
            "OPENAI_API_KEY is still set to the template placeholder in .env. "
            "Add a real OpenAI API key before using audio transcription."
        )

    return OpenAI(api_key=api_key)


def _decode_audio(audio_base64: str):
    if not audio_base64:
        raise ValueError("Audio content is missing.")

    payload = audio_base64.split(",", 1)[-1]
    try:
        audio_bytes = base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise ValueError("Audio data is not valid base64.") from exc

    if not audio_bytes:
        raise ValueError("Audio content is empty.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ValueError("Audio file is too large. Please keep uploads under 25 MB.")

    return audio_bytes


def _validate_audio_filename(audio_filename: str):
    suffix = Path(audio_filename or "followup.webm").suffix.lower()
    if suffix not in SUPPORTED_AUDIO_EXTENSIONS:
        raise ValueError("Unsupported audio format. Please upload mp3, mp4, m4a, wav, or webm audio.")

    return audio_filename or f"followup{suffix}"


def normalize_audio_language_hint(language_hint: str | None):
    if not language_hint:
        return None

    normalized_hint = LANGUAGE_HINT_ALIASES.get(language_hint.strip().lower())
    return normalized_hint


def transcribe_patient_audio(audio_base64: str, audio_filename: str, language_hint: str | None = None):
    filename = _validate_audio_filename(audio_filename)
    audio_bytes = _decode_audio(audio_base64)
    normalized_language_hint = normalize_audio_language_hint(language_hint)
    client = _get_client()

    def _run_transcription(hint: str | None):
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename

        transcription_kwargs = {
            "model": TRANSCRIPTION_MODEL,
            "file": audio_file,
        }
        if hint:
            transcription_kwargs["language"] = hint

        transcription = client.audio.transcriptions.create(**transcription_kwargs)
        transcript_text = getattr(transcription, "text", None)
        if not transcript_text and isinstance(transcription, dict):
            transcript_text = transcription.get("text")

        if not transcript_text:
            raise RuntimeError("OpenAI did not return a transcript.")

        return transcript_text.strip()

    try:
        return _run_transcription(normalized_language_hint)
    except Exception:
        if not normalized_language_hint:
            raise

    return _run_transcription(None)


def normalize_followup_transcript(transcript: str, language_hint: str | None = None):
    if not transcript.strip():
        raise ValueError("Transcript is empty.")

    language_line = language_hint or "auto-detect"
    response = _get_client().chat.completions.create(
        model=NORMALIZATION_MODEL,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "You convert multilingual patient followup transcripts into one short English symptom summary "
                    "for downstream clinical triage. Preserve only what the patient actually said. Keep negations, "
                    "pain scores, timing, severity, and medication adherence intact. Prefer plain medical phrases "
                    "like fever, high fever, cough, sore throat, chest pain, shortness of breath, stomach pain, "
                    "vomiting, nausea, diarrhea, dizziness, fatigue, chills, sweating, took medicine, or did not take medicine. "
                    "Return only the cleaned English followup message."
                ),
            },
            {
                "role": "user",
                "content": f"Language hint: {language_line}\nTranscript:\n{transcript}",
            },
        ],
    )
    normalized_message = response.choices[0].message.content if response.choices else ""
    normalized_message = (normalized_message or "").strip()

    return normalized_message or transcript.strip()
