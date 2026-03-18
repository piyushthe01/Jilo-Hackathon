import { useState, useEffect } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { analyzeAudioFollowup, analyzeFollowup, getPatients } from "../api/api";
import theme from "../theme";

const languageOptions = [
  { value: "auto", label: "Auto detect" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "gu", label: "Gujarati" },
  { value: "mr", label: "Marathi" },
  { value: "bn", label: "Bengali" },
  { value: "or", label: "Odia" },
  { value: "pa", label: "Punjabi" },
  { value: "ur", label: "Urdu" }
];

const languageAliases = {
  auto: "auto",
  en: "en",
  english: "en",
  hi: "hi",
  hindi: "hi",
  ta: "ta",
  tamil: "ta",
  te: "te",
  telugu: "te",
  kn: "kn",
  kannada: "kn",
  ml: "ml",
  malayalam: "ml",
  gu: "gu",
  gujarati: "gu",
  mr: "mr",
  marathi: "mr",
  bn: "bn",
  bengali: "bn",
  or: "or",
  odia: "or",
  oriya: "or",
  pa: "pa",
  punjabi: "pa",
  ur: "ur",
  urdu: "ur"
};

function normalizeLanguageValue(value) {
  if (!value) {
    return "auto";
  }

  return languageAliases[value.trim().toLowerCase()] || "auto";
}

function AiFollowup() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [message, setMessage] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [languageHint, setLanguageHint] = useState("auto");
  const [result, setResult] = useState(null);
  const [loadingMode, setLoadingMode] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({ audio: true });

  useEffect(() => {
    if (mediaBlobUrl) {
      fetch(mediaBlobUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], "recording.webm", { type: "audio/webm" });
          setAudioFile(file);
        });
    }
  }, [mediaBlobUrl]);

  useEffect(() => {
    getPatients()
      .then((response) => setPatients(response.data))
      .catch((error) => console.error("Error loading patients:", error));
  }, []);

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: `1px solid ${theme.colors.accent}`,
    outline: "none",
    fontSize: "15px",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "white"
  };

  const fieldRowStyle = {
    display: "grid",
    gridTemplateColumns: "150px minmax(0, 1fr)",
    gap: "18px",
    alignItems: "center",
    marginBottom: "20px"
  };

  const labelStyle = {
    fontWeight: "600",
    lineHeight: 1.4
  };

  const actionButtonStyle = (variant = "primary") => ({
    padding: "12px 22px",
    background:
      variant === "primary"
        ? `linear-gradient(90deg, ${theme.colors.sidebar}, ${theme.colors.primary})`
        : "rgba(255,255,255,0.06)",
    color: "white",
    border: variant === "primary" ? "none" : `1px solid ${theme.colors.border}`,
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "15px",
    boxShadow: variant === "primary" ? "0 6px 18px rgba(173,86,196,0.3)" : "none"
  });

  const resetInputs = () => {
    setMessage("");
    setAudioFile(null);
    clearBlobUrl();
    setFileInputKey((current) => current + 1);
  };

  const selectedPatient = patients.find((patient) => String(patient.id) === String(patientId)) || null;

  const handlePatientChange = (event) => {
    const nextPatientId = event.target.value;
    setPatientId(nextPatientId);

    const nextPatient = patients.find((patient) => String(patient.id) === String(nextPatientId));
    setLanguageHint(normalizeLanguageValue(nextPatient?.language));
  };

  const handleAnalyzeText = async () => {
    if (!patientId || !message.trim()) {
      alert("Please enter both patient ID and patient message");
      return;
    }

    try {
      setLoadingMode("text");
      const response = await analyzeFollowup(patientId, message);
      setResult(response.data);
      resetInputs();
    } catch (err) {
      console.error("Error analyzing followup:", err);
      alert(err.response?.data?.detail || "Failed to analyze followup");
    } finally {
      setLoadingMode(null);
    }
  };

  const handleAnalyzeAudio = async () => {
    if (!patientId || !audioFile) {
      alert("Please enter patient ID and upload an audio file");
      return;
    }

    try {
      setLoadingMode("audio");
      const response = await analyzeAudioFollowup(patientId, audioFile, languageHint);
      setResult(response.data);
      resetInputs();
    } catch (err) {
      console.error("Error transcribing followup audio:", err);
      alert(err.response?.data?.detail || "Failed to transcribe audio");
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div
      style={{
        padding: "32px",
        minHeight: "100vh",
        color: theme.colors.text,
        background: theme.gradients.page
      }}
    >
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>AI Followup Analysis</h1>
      <p style={{ color: theme.colors.mutedText, marginBottom: "30px", maxWidth: "860px" }}>
        Analyze typed patient updates or upload voice notes. Audio followups are transcribed with OpenAI,
        normalized into English symptom notes, and then passed through the same disease matching, alerting,
        and reporting pipeline already used by the platform.
      </p>

      <div
        style={{
          padding: "24px",
          borderRadius: "18px",
          background: theme.gradients.panel,
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: "840px",
          boxShadow: theme.shadows.panel
        }}
      >
        <div style={fieldRowStyle}>
          <label style={{ ...labelStyle, color: theme.colors.secondary }}>
            Patient
          </label>
          <select
            value={patientId}
            onChange={handlePatientChange}
            style={inputStyle}
          >
            <option value="" style={{ color: "#111" }}>Select patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id} style={{ color: "#111" }}>
                {patient.name} (#{patient.id}) - {patient.language}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldRowStyle}>
          <label style={{ ...labelStyle, color: theme.colors.info }}>
            Language Hint
          </label>
          <select
            value={languageHint}
            onChange={(event) => setLanguageHint(event.target.value)}
            style={inputStyle}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value} style={{ color: "#111" }}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {selectedPatient && (
          <div
            style={{
              marginTop: "-6px",
              marginBottom: "18px",
              marginLeft: "168px",
              color: theme.colors.mutedText,
              fontSize: "14px"
            }}
          >
            Using patient language from database: {selectedPatient.language}
          </div>
        )}

        <div style={{ ...fieldRowStyle, alignItems: "end" }}>
          <label style={{ ...labelStyle, color: theme.colors.accent }}>
            Patient Message
          </label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows="6"
            placeholder="Example: I have severe pain level 9 and fever"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div style={{ ...fieldRowStyle, alignItems: "start" }}>
          <label style={{ ...labelStyle, color: theme.colors.primary }}>
            Voice Note
          </label>
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
              <button
                onClick={startRecording}
                disabled={status === "recording"}
                style={actionButtonStyle(status === "recording" ? "secondary" : "primary")}
              >
                Start Recording
              </button>
              <button
                onClick={stopRecording}
                disabled={status !== "recording"}
                style={actionButtonStyle("secondary")}
              >
                Stop Recording
              </button>
              <span style={{ fontWeight: "700", color: status === "recording" ? theme.colors.primary : theme.colors.mutedText }}>
                Status: {status}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ color: theme.colors.mutedText, fontSize: "14px" }}>OR</span>
              <input
                key={fileInputKey}
                type="file"
                accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
                onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: "8px 12px", flex: 1 }}
              />
            </div>

            <p style={{ margin: "10px 0 0", color: theme.colors.mutedText, fontSize: "14px" }}>
              Record directly or upload an mp3, wav, or webm audio file up to 25 MB.
              {audioFile ? ` Selected: ${audioFile.name}` : ""}
            </p>
          </div>
        </div>

        <div
          style={{
            paddingLeft: "168px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap"
          }}
        >
          <button onClick={handleAnalyzeText} style={actionButtonStyle()} disabled={loadingMode !== null}>
            {loadingMode === "text" ? "Analyzing..." : "Analyze Typed Message"}
          </button>
          <button
            onClick={handleAnalyzeAudio}
            style={actionButtonStyle("secondary")}
            disabled={loadingMode !== null}
          >
            {loadingMode === "audio" ? "Transcribing..." : "Transcribe Audio + Analyze"}
          </button>
        </div>
      </div>

      {result && (
        <div
          style={{
            marginTop: "30px",
            padding: "24px",
            borderRadius: "18px",
            background: theme.gradients.panelStrong,
            border: `1px solid ${theme.colors.accent}`,
            maxWidth: "840px",
            boxShadow: theme.shadows.panel
          }}
        >
          <h2 style={{ marginTop: 0, color: theme.colors.secondary }}>Analysis Result</h2>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              marginBottom: "14px",
              color: theme.colors.text,
              fontWeight: "700"
            }}
          >
            Source: {result.input_source === "audio" ? "Audio upload" : "Typed message"}
          </div>

          {result.transcript && (
            <div
              style={{
                marginBottom: "16px",
                padding: "14px 16px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              <p style={{ margin: "0 0 8px", fontWeight: "700", color: theme.colors.secondary }}>
                Transcript
              </p>
              <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>
                {result.transcript}
              </p>
            </div>
          )}

          {result.normalized_message && (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px 16px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              <p style={{ margin: "0 0 8px", fontWeight: "700", color: theme.colors.accent }}>
                Message Used For Triage
              </p>
              <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>
                {result.normalized_message}
              </p>
            </div>
          )}

          <p><b>Patient ID:</b> {result.followup.patient_id}</p>
          <p><b>Pain Level:</b> {result.followup.pain_level}</p>
          <p><b>Fever:</b> {String(result.followup.fever)}</p>
          <p><b>Medicine Taken:</b> {String(result.followup.medicine_taken)}</p>
          <p>
            <b>Probable Condition:</b>{" "}
            {result.probable_condition || "No close disease pattern detected"}
          </p>
          <p>
            <b>Matched Symptoms:</b>{" "}
            {result.matched_symptoms?.length
              ? result.matched_symptoms.map((symptom) => symptom.replaceAll("_", " ")).join(", ")
              : "None"}
          </p>
          <p>
            <b>Condition Confidence:</b>{" "}
            {typeof result.condition_confidence === "number"
              ? `${Math.round(result.condition_confidence * 100)}%`
              : "N/A"}
          </p>
          <p>
            <b>Precautions:</b>{" "}
            {result.precautions?.length
              ? result.precautions.join(", ")
              : "No precautions available"}
          </p>
          <p>
            <b>Risk Level:</b>{" "}
            <span
              style={{
                color:
                  result.risk_level === "HIGH"
                    ? theme.colors.primary
                    : theme.colors.secondary,
                fontWeight: "700"
              }}
            >
              {result.risk_level}
            </span>
          </p>

          {result.top_matches?.length > 0 && (
            <div style={{ marginTop: "18px" }}>
              <h3 style={{ marginBottom: "12px", color: theme.colors.secondary }}>
                Top Disease Matches
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                {result.top_matches.map((match, index) => (
                  <div
                    key={`${match.condition}-${index}`}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <p style={{ margin: "0 0 8px", fontWeight: "700", color: theme.colors.accent }}>
                      #{index + 1} {match.condition}
                    </p>
                    <p style={{ margin: "0 0 8px", color: theme.colors.text }}>
                      <b>Confidence:</b> {Math.round((match.confidence || 0) * 100)}%
                    </p>
                    <p style={{ margin: "0 0 8px", color: theme.colors.mutedText, lineHeight: 1.6 }}>
                      {match.note}
                    </p>
                    <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.6 }}>
                      <b style={{ color: theme.colors.text }}>Matched Symptoms:</b>{" "}
                      {match.matched_symptoms?.length
                        ? match.matched_symptoms.map((symptom) => symptom.replaceAll("_", " ")).join(", ")
                        : "None"}
                    </p>
                    <p style={{ margin: "8px 0 0", color: theme.colors.mutedText, lineHeight: 1.6 }}>
                      <b style={{ color: theme.colors.text }}>Precautions:</b>{" "}
                      {match.precautions?.length ? match.precautions.join(", ") : "No precautions available"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AiFollowup;
