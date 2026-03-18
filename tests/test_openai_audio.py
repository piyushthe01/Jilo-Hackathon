import unittest
from unittest.mock import patch

from app.openai_audio import transcribe_patient_audio


class _FakeTranscriptionResponse:
    def __init__(self, text):
        self.text = text


class _FakeTranscriptions:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs.get("language") == "pa":
            raise RuntimeError("Unsupported language hint")
        return _FakeTranscriptionResponse("Patient reports mild cough")


class _FakeAudio:
    def __init__(self):
        self.transcriptions = _FakeTranscriptions()


class _FakeClient:
    def __init__(self):
        self.audio = _FakeAudio()


class OpenAIAudioTests(unittest.TestCase):
    @patch("app.openai_audio._get_client")
    def test_transcription_retries_without_language_hint_when_hint_fails(self, mock_get_client):
        fake_client = _FakeClient()
        mock_get_client.return_value = fake_client

        transcript = transcribe_patient_audio(
            "data:audio/webm;base64,QQ==",
            "reply.webm",
            language_hint="Punjabi",
        )

        self.assertEqual(transcript, "Patient reports mild cough")
        self.assertEqual(len(fake_client.audio.transcriptions.calls), 2)
        self.assertEqual(fake_client.audio.transcriptions.calls[0]["language"], "pa")
        self.assertNotIn("language", fake_client.audio.transcriptions.calls[1])


if __name__ == "__main__":
    unittest.main()
