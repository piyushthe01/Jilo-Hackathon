import base64
import os
import requests

from openai import OpenAI

SCRIPT_MODEL = "gpt-4o-mini"
TTS_MODEL = "gpt-4o-mini-tts"
CALLER_NAME = "Rohit"
HOSPITAL_NAME = "Wellness Hospital"
DEFAULT_TTS_VOICE = "echo"
_BASE_VOICE_STYLE = (
    "Speak as Rohit, a warm, calm, professional male care coordinator from Wellness Hospital. "
    "Your tone is caring, clear, and reassuring. Deliver the message naturally as if speaking "
    "on an outbound patient followup call. Do not rush. Be gentle and supportive."
)

# Unicode ranges for Devanagari (Hindi, Marathi, etc.) and Odia scripts.
_DEVANAGARI_RANGE = range(0x0900, 0x097F + 1)
_ODIA_RANGE = range(0x0B00, 0x0B7F + 1)


def _detect_script_language(text: str) -> str | None:
    """Infer language from Unicode block when no explicit label is available."""
    for char in text:
        cp = ord(char)
        if cp in _DEVANAGARI_RANGE:
            return "hindi"
        if cp in _ODIA_RANGE:
            return "odia"
    return None


def _get_language_tts_instructions(language_label: str | None, script_text: str = "") -> str:
    """Return TTS style instructions tailored to the target language."""
    label = (language_label or "").strip().lower()

    # Fallback: detect from Unicode if label is missing or generic.
    if not label or label in {"auto", "unknown"}:
        label = _detect_script_language(script_text) or "english"

    if "hindi" in label or label == "hi":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Hindi (Devanagari). Pronounce every word exactly as "
            "written in Hindi with correct Hindi phonetics and intonation. "
            "Do not transliterate or anglicise any Hindi words."
        )
    if "odia" in label or "oriya" in label or label == "or":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Odia. Pronounce every word exactly as "
            "written in Odia with correct Odia phonetics and intonation. "
            "Do not transliterate or anglicise any Odia words."
        )
    if "tamil" in label or label == "ta":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Tamil. Pronounce every word with correct Tamil phonetics."
        )
    if "telugu" in label or label == "te":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Telugu. Pronounce every word with correct Telugu phonetics."
        )
    if "kannada" in label or label == "kn":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Kannada. Pronounce every word with correct Kannada phonetics."
        )
    if "malayalam" in label or label == "ml":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Malayalam. Pronounce every word with correct Malayalam phonetics."
        )
    if "bengali" in label or label == "bn":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Bengali. Pronounce every word with correct Bengali phonetics."
        )
    if "gujarati" in label or label == "gu":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Gujarati. Pronounce every word with correct Gujarati phonetics."
        )
    if "marathi" in label or label == "mr":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Marathi. Pronounce every word with correct Marathi phonetics."
        )
    if "punjabi" in label or label == "pa":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Punjabi. Pronounce every word with correct Punjabi phonetics."
        )
    if "urdu" in label or label == "ur":
        return (
            _BASE_VOICE_STYLE
            + " The script is written in Urdu. Pronounce every word with correct Urdu phonetics."
        )

    # Default: English
    return _BASE_VOICE_STYLE


# Keep backward-compat alias so any external import of VOICE_STYLE_INSTRUCTIONS still works.
VOICE_STYLE_INSTRUCTIONS = _BASE_VOICE_STYLE


def _get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured for workflow automation.")
    if api_key.strip() == "your_openai_api_key_here":
        raise RuntimeError(
            "OPENAI_API_KEY is still set to the template placeholder in .env. "
            "Add a real OpenAI API key before running workflow automation."
        )

    return OpenAI(api_key=api_key)


def _extract_response_text(response):
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text.strip()

    for item in getattr(response, "output", []) or []:
        for content_item in getattr(item, "content", []) or []:
            text_value = getattr(content_item, "text", None)
            if text_value:
                return text_value.strip()

    # Fallback: try chat completions style response
    choices = getattr(response, "choices", None)
    if choices:
        return (getattr(choices[0].message, "content", None) or "").strip()

    return ""


def _replace_placeholders(script_text: str):
    return (
        script_text.replace("[आपका नाम]", CALLER_NAME)
        .replace("[अस्पताल का नाम]", HOSPITAL_NAME)
        .replace("[patient name]", CALLER_NAME)
        .replace("[hospital name]", HOSPITAL_NAME)
    )


def _build_identity_intro(language_label: str | None):
    language = (language_label or "").strip().lower()
    if "hindi" in language or language == "hi":
        return f"नमस्ते, मैं {CALLER_NAME} from {HOSPITAL_NAME} बोल रहा हूँ।"
    if "odia" in language or "oriya" in language or language == "or":
        return f"ନମସ୍କାର, ମୁଁ {CALLER_NAME} from {HOSPITAL_NAME} କହୁଛି।"
    return f"Hello, this is {CALLER_NAME} from {HOSPITAL_NAME}."


# Native-script markers that confirm the caller identity is already in the script.
# If ANY of these strings appear, the intro has already been included by GPT.
_NATIVE_IDENTITY_MARKERS: dict[str, list[str]] = {
    "hindi": ["नमस्ते", "रोहित", "वेलनेस"],
    "odia": ["ନମସ୍କାର", "ରୋହିତ", "ୱେଲନେସ"],
    "marathi": ["नमस्कार", "रोहित", "वेलनेस"],
    "bengali": ["নমস্কার", "রোহিত", "ওয়েলনেস"],
    "gujarati": ["નમસ્તે", "રોહિત", "વેલનેસ"],
    "punjabi": ["ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ", "ਰੋਹਿਤ", "ਵੈਲਨੈੱਸ"],
}


def _script_has_identity(cleaned_script: str, language_label: str | None) -> bool:
    """Return True if the script already contains a caller identity introduction."""
    lower = cleaned_script.lower()
    # English names present
    if CALLER_NAME.lower() in lower and HOSPITAL_NAME.lower() in lower:
        return True
    # Native-script names/greetings present
    detected = _detect_script_language(cleaned_script) or (language_label or "").strip().lower()
    markers = _NATIVE_IDENTITY_MARKERS.get(detected, [])
    return any(marker in cleaned_script for marker in markers)


def apply_caller_identity(script_text: str, language_label: str | None):
    cleaned_script = _replace_placeholders(script_text).strip()
    if _script_has_identity(cleaned_script, language_label):
        return cleaned_script

    return f"{_build_identity_intro(language_label)} {cleaned_script}".strip()


def generate_followup_call_script(patient, workflow):
    client = _get_client()
    system_prompt = (
        "You are designing only the opening turn of an outbound healthcare followup call. "
        "Return only the first spoken prompt in the patient's preferred language. "
        "The caller is a male care coordinator named Rohit from Wellness Hospital. "
        "Keep it warm, simple, and under 45 words. Start by clearly introducing Rohit and Wellness Hospital, "
        "briefly mention the followup goal, ask 1 short question about symptoms or medicine adherence, and stop so the patient can respond. "
        "End with a question. Do not add bullet points, stage directions, or any closing thanks yet."
    )
    user_input = (
        f"Caller name: {CALLER_NAME}\n"
        f"Hospital name: {HOSPITAL_NAME}\n"
        f"Patient name: {patient.name}\n"
        f"Preferred language: {patient.language}\n"
        f"Workflow name: {workflow.name}\n"
        f"Workflow trigger: {workflow.trigger_type}\n"
        f"Workflow goal: {workflow.message_goal}\n"
        f"Cadence: {workflow.cadence}\n"
        f"Audience: {workflow.audience}"
    )

    try:
        response = client.chat.completions.create(
            model=SCRIPT_MODEL,
            temperature=0.6,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
        )
        script_text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"OpenAI API call failed: {e}")
        raise RuntimeError(f"Failed to generate followup call script: {e}")

    if not script_text:
        raise RuntimeError("OpenAI did not return a followup call script.")

    return apply_caller_identity(script_text, patient.language or workflow.language)


def generate_followup_call_reply(patient, workflow, transcript, normalized_message, analysis_result):
    client = _get_client()
    system_prompt = (
        "You are continuing an automated healthcare followup call after the patient has spoken. "
        "Return only one short spoken reply in the patient's preferred language. "
        "Acknowledge what the patient said, mention the appropriate next step based on the risk level, "
        "and end by politely thanking the patient on behalf of Rohit from Wellness Hospital. "
        "Keep it under 55 words. Do not add bullet points or stage directions."
    )
    user_input = (
        f"Caller name: {CALLER_NAME}\n"
        f"Hospital name: {HOSPITAL_NAME}\n"
        f"Patient name: {patient.name}\n"
        f"Preferred language: {patient.language}\n"
        f"Workflow name: {workflow.name}\n"
        f"Patient transcript: {transcript}\n"
        f"Normalized message: {normalized_message}\n"
        f"Risk level: {analysis_result.get('risk_level')}\n"
        f"Probable condition: {analysis_result.get('probable_condition')}\n"
        f"Matched symptoms: {', '.join(analysis_result.get('matched_symptoms', []))}\n"
    )

    try:
        response = client.chat.completions.create(
            model=SCRIPT_MODEL,
            temperature=0.4,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
        )
        reply_text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"OpenAI API call failed for followup reply: {e}")
        risk_level = analysis_result.get("risk_level") or "LOW"
        return (
            f"Thank you for sharing this update. Our care team has recorded your response "
            f"and noted the current risk level as {risk_level}. Thank you from Rohit at {HOSPITAL_NAME}."
        )

    return reply_text or (
        f"Thank you for sharing this update. Our care team has recorded your response. "
        f"Thank you from Rohit at {HOSPITAL_NAME}."
    )


def synthesize_followup_call_audio(
    script_text: str,
    voice: str = DEFAULT_TTS_VOICE,
    language_label: str | None = None,
):
    from .logging_config import log_api_call, log_system_error
    
    if not script_text.strip():
        raise ValueError("Call script text is empty.")
    
    # Validate script length to prevent excessive costs
    if len(script_text) > 1000:
        raise ValueError(f"Script too long: {len(script_text)} characters (max 1000)")

    # Try ElevenLabs first if key is available
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY") or os.getenv("ELEVEN_LABS_API_KEY")
    if elevenlabs_key:
        voice_id = "pNInz6obpgDQGcFmaJgB"  # "Adam" - warm male voice
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_key
        }
        data = {
            "text": script_text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8
            }
        }
        try:
            import requests
            response = requests.post(url, json=data, headers=headers, timeout=30)
            if response.status_code == 200:
                log_api_call("ElevenLabs_TTS", "synthesize", "SUCCESS")
                return base64.b64encode(response.content).decode("utf-8")
            else:
                error_msg = f"ElevenLabs TTS failed ({response.status_code}): {response.text}"
                log_api_call("ElevenLabs_TTS", "synthesize", "FAILED", error=error_msg)
                print(f"ElevenLabs TTS failed ({response.status_code}): {response.text}. Falling back to OpenAI...")
        except Exception as e:
            log_system_error(e, "ElevenLabs TTS request")
            print(f"ElevenLabs TTS request failed: {e}. Falling back to OpenAI...")

    # Fallback to OpenAI TTS
    tts_instructions = _get_language_tts_instructions(language_label, script_text)

    client = _get_client()
    speech_kwargs = {
        "model": TTS_MODEL,
        "voice": voice,
        "input": script_text,
        "response_format": "mp3",
        "instructions": tts_instructions,
    }

    try:
        audio_response = client.audio.speech.create(**speech_kwargs)
        log_api_call("OpenAI_TTS", "synthesize", "SUCCESS")
    except Exception as exc:
        log_system_error(exc, "OpenAI TTS synthesis")
        if "instructions" in str(exc) or isinstance(exc, TypeError):
            speech_kwargs.pop("instructions", None)
            try:
                audio_response = client.audio.speech.create(**speech_kwargs)
                log_api_call("OpenAI_TTS", "synthesize_fallback", "SUCCESS")
            except Exception as fallback_exc:
                log_system_error(fallback_exc, "OpenAI TTS fallback")
                raise RuntimeError(f"Both TTS methods failed: {str(fallback_exc)}")
        else:
            raise RuntimeError(f"OpenAI TTS failed: {str(exc)}")

    audio_bytes = getattr(audio_response, "content", None)
    if not audio_bytes:
        error_msg = "OpenAI TTS did not return audio content"
        log_api_call("OpenAI_TTS", "synthesize", "FAILED", error=error_msg)
        raise RuntimeError(error_msg)

    return base64.b64encode(audio_bytes).decode("utf-8")


def summarize_followup_call_result(patient, workflow, transcript, normalized_message, analysis_result):
    client = _get_client()
    system_prompt = (
        "Write a concise clinical operations summary of an automated patient followup call. "
        "Keep it to 2 short sentences in English and focus on what the patient reported, "
        "the likely risk, and the next action."
    )
    user_input = (
        f"Caller name: {CALLER_NAME}\n"
        f"Hospital name: {HOSPITAL_NAME}\n"
        f"Patient: {patient.name}\n"
        f"Workflow: {workflow.name}\n"
        f"Transcript: {transcript}\n"
        f"Normalized message: {normalized_message}\n"
        f"Risk level: {analysis_result.get('risk_level')}\n"
        f"Probable condition: {analysis_result.get('probable_condition')}\n"
        f"Matched symptoms: {', '.join(analysis_result.get('matched_symptoms', []))}\n"
    )

    try:
        response = client.chat.completions.create(
            model=SCRIPT_MODEL,
            temperature=0.3,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
        )
        summary_text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"OpenAI API call failed for summarization: {e}")
        summary_text = f"{patient.name} completed an automated followup from {HOSPITAL_NAME} for {workflow.name}."

    return summary_text or f"{patient.name} completed an automated followup from {HOSPITAL_NAME} for {workflow.name}."
