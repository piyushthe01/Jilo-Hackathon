"""Unit tests for language-aware TTS pronunciation instructions."""
import unittest

from app.openai_followup_automation import (
    _detect_script_language,
    _get_language_tts_instructions,
    _BASE_VOICE_STYLE,
    VOICE_STYLE_INSTRUCTIONS,
)


class TestDetectScriptLanguage(unittest.TestCase):
    def test_devanagari_detected_as_hindi(self):
        self.assertEqual(_detect_script_language("नमस्ते, मैं अर्पिता बोल रही हूँ।"), "hindi")

    def test_odia_detected_as_odia(self):
        self.assertEqual(_detect_script_language("ନମସ୍କାର, ମୁଁ ଅର୍ପିତା କହୁଛି।"), "odia")

    def test_plain_english_returns_none(self):
        self.assertIsNone(_detect_script_language("Hello, this is Arpita from Wellness Hospital."))

    def test_mixed_hindi_english_detects_hindi(self):
        # When Hindi chars are present, must detect Hindi even if mixed
        self.assertEqual(_detect_script_language("Hello! आपका स्वागत है।"), "hindi")


class TestGetLanguageTtsInstructions(unittest.TestCase):
    # ------- Hindi variants -------
    def test_hindi_label_includes_hindi_instructions(self):
        instructions = _get_language_tts_instructions("Hindi")
        self.assertIn("Hindi", instructions)
        self.assertIn("Devanagari", instructions)
        self.assertIn("phonetics", instructions)

    def test_hi_code_resolves_to_hindi(self):
        instructions = _get_language_tts_instructions("hi")
        self.assertIn("Hindi", instructions)

    def test_hindi_script_fallback_via_unicode_detection(self):
        # No label — should detect from Devanagari chars in script_text
        instructions = _get_language_tts_instructions(None, script_text="नमस्ते")
        self.assertIn("Hindi", instructions)

    # ------- Odia variants -------
    def test_odia_label_includes_odia_instructions(self):
        instructions = _get_language_tts_instructions("Odia")
        self.assertIn("Odia", instructions)
        self.assertIn("phonetics", instructions)

    def test_oriya_alias_resolves_to_odia(self):
        instructions = _get_language_tts_instructions("oriya")
        self.assertIn("Odia", instructions)

    def test_or_code_resolves_to_odia(self):
        instructions = _get_language_tts_instructions("or")
        self.assertIn("Odia", instructions)

    def test_odia_script_fallback_via_unicode_detection(self):
        instructions = _get_language_tts_instructions(None, script_text="ନମସ୍କାର")
        self.assertIn("Odia", instructions)

    # ------- Other Indian languages -------
    def test_tamil_label(self):
        self.assertIn("Tamil", _get_language_tts_instructions("Tamil"))

    def test_bengali_label(self):
        self.assertIn("Bengali", _get_language_tts_instructions("Bengali"))

    def test_marathi_label(self):
        self.assertIn("Marathi", _get_language_tts_instructions("Marathi"))

    # ------- English / default -------
    def test_english_label_returns_base_style(self):
        instructions = _get_language_tts_instructions("English")
        self.assertEqual(instructions, _BASE_VOICE_STYLE)

    def test_none_label_empty_text_returns_base_style(self):
        instructions = _get_language_tts_instructions(None, script_text="Hello there.")
        self.assertEqual(instructions, _BASE_VOICE_STYLE)

    def test_unknown_label_returns_base_style(self):
        instructions = _get_language_tts_instructions("Klingon")
        self.assertEqual(instructions, _BASE_VOICE_STYLE)

    # ------- All instructions must include the base style -------
    def test_hindi_instructions_include_base_style(self):
        self.assertIn(_BASE_VOICE_STYLE, _get_language_tts_instructions("Hindi"))

    def test_odia_instructions_include_base_style(self):
        self.assertIn(_BASE_VOICE_STYLE, _get_language_tts_instructions("Odia"))

    # ------- Backward compat alias -------
    def test_voice_style_instructions_alias_still_works(self):
        self.assertEqual(VOICE_STYLE_INSTRUCTIONS, _BASE_VOICE_STYLE)


if __name__ == "__main__":
    unittest.main()
