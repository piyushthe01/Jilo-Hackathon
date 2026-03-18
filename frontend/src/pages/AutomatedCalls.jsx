import { useState, useEffect, useRef, useCallback } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import {
  getFollowupCalls,
  getPatients,
  runDueWorkflowAutomation,
  completeFollowupCallWithAudio,
} from "../api/api";
import theme from "../theme";

const PHASES = {
  IDLE: "IDLE",
  RINGING: "RINGING",
  SPEAKING: "SPEAKING",
  LISTENING: "LISTENING",
  PROCESSING: "PROCESSING",
  RESPONDING: "RESPONDING",
  COMPLETE: "COMPLETE",
  ERROR: "ERROR",
};

const phaseLabels = {
  [PHASES.IDLE]: "Ready",
  [PHASES.RINGING]: "Ringing patient...",
  [PHASES.SPEAKING]: "Rohit is speaking...",
  [PHASES.LISTENING]: "Listening to patient response...",
  [PHASES.PROCESSING]: "Analyzing response with AI...",
  [PHASES.RESPONDING]: "Responding to the patient...",
  [PHASES.COMPLETE]: "Call complete",
  [PHASES.ERROR]: "Error occurred",
};

const phaseColors = {
  [PHASES.IDLE]: theme.colors.mutedText,
  [PHASES.RINGING]: theme.colors.warning,
  [PHASES.SPEAKING]: theme.colors.info,
  [PHASES.LISTENING]: theme.colors.primary,
  [PHASES.PROCESSING]: theme.colors.accent,
  [PHASES.RESPONDING]: theme.colors.secondary,
  [PHASES.COMPLETE]: theme.colors.success,
  [PHASES.ERROR]: theme.colors.danger,
};

function AutomatedCalls() {
  const [calls, setCalls] = useState([]);
  const [patients, setPatients] = useState([]);
  const [activeCallId, setActiveCallId] = useState(null);
  const [activeCallData, setActiveCallData] = useState(null);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [callResult, setCallResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [runningDue, setRunningDue] = useState(false);

  const audioRef = useRef(null);
  const recordingBlobRef = useRef(null);

  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({
      audio: true,
      askPermissionOnMount: true,
      onStop: (_blobUrl, blob) => {
        recordingBlobRef.current = blob;
      },
    });

  // Capture recorded blob when available
  useEffect(() => {
    if (mediaBlobUrl && !recordingBlobRef.current) {
      fetch(mediaBlobUrl)
        .then((r) => r.blob())
        .then((blob) => {
          recordingBlobRef.current = blob;
        });
    }
  }, [mediaBlobUrl, phase]);

  const loadData = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const [callRes, patientRes] = await Promise.all([
        getFollowupCalls(),
        getPatients(),
      ]);
      setCalls(callRes.data.filter((c) => c.status === "PREPARED"));
      setPatients(patientRes.data);
    } catch (err) {
      console.error("Failed to load calls:", err);
    } finally {
      setLoadingCalls(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getPatientName = (patientId) => {
    const p = patients.find((pt) => pt.id === patientId);
    return p ? p.name : `Patient #${patientId}`;
  };

  const getPatientPhone = (patientId) => {
    const p = patients.find((pt) => pt.id === patientId);
    return p ? p.phone : "N/A";
  };

  const handleRunDue = async () => {
    try {
      setRunningDue(true);
      await runDueWorkflowAutomation();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setRunningDue(false);
    }
  };

  const startSimulatedCall = async (call) => {
    setActiveCallId(call.id);
    setActiveCallData(call);
    setCallResult(null);
    setErrorMsg("");
    clearBlobUrl();
    recordingBlobRef.current = null;

    // Phase 1: Ringing
    setPhase(PHASES.RINGING);
    await sleep(2000);

    // Phase 2: Speaking (play the TTS audio)
    setPhase(PHASES.SPEAKING);
    try {
      await playBase64Audio(call.tts_audio_base64);
    } catch (err) {
      console.error("Audio playback failed:", err);
    }

    // Phase 3: Listening (start recording patient response)
    setPhase(PHASES.LISTENING);
    if (status === "denied") {
      setPhase(PHASES.ERROR);
      setErrorMsg("Microphone permission is blocked in the browser. Allow mic access and try again.");
      return;
    }
    startRecording();
  };

  const handleStopRecording = async () => {
    stopRecording();
    setPhase(PHASES.PROCESSING);

    // Wait a bit for blob to be captured by useEffect
    await sleep(1500);

    const blob = recordingBlobRef.current;
    if (!blob) {
      setPhase(PHASES.ERROR);
      setErrorMsg(
        status === "denied"
          ? "Microphone permission is blocked in the browser. Allow mic access and try again."
          : "No audio was recorded. Please try again after allowing microphone access."
      );
      return;
    }

    const file = new File([blob], "patient_response.webm", {
      type: "audio/webm",
    });

    try {
      const activeCall = calls.find((c) => c.id === activeCallId);
      const langHint =
        activeCall?.script_language || activeCall?.patient_language || "auto";
      const result = await completeFollowupCallWithAudio(
        activeCallId,
        file,
        langHint
      );
      setCallResult(result.data);
      setActiveCallData(result.data.call || activeCall);
      setPhase(PHASES.RESPONDING);
      if (result.data?.patient_reply?.tts_audio_base64) {
        await playBase64Audio(result.data.patient_reply.tts_audio_base64);
      }
      setPhase(PHASES.COMPLETE);
      await loadData();
    } catch (err) {
      console.error("Error completing call:", err);
      setPhase(PHASES.ERROR);
      setErrorMsg(
        err.response?.data?.detail || "Failed to analyze patient response."
      );
    }
  };

  const resetCall = () => {
    setActiveCallId(null);
    setActiveCallData(null);
    setPhase(PHASES.IDLE);
    setCallResult(null);
    setErrorMsg("");
    clearBlobUrl();
    recordingBlobRef.current = null;
  };

  const playBase64Audio = (base64Audio) => {
    return new Promise((resolve, reject) => {
      if (!base64Audio) {
        resolve();
        return;
      }
      // Handle both raw base64 and data-URI style
      const src = base64Audio.startsWith("data:")
        ? base64Audio
        : `data:audio/mp3;base64,${base64Audio}`;

      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const activeCall = activeCallData || calls.find((c) => c.id === activeCallId);

  const cardStyle = {
    padding: "22px",
    borderRadius: "18px",
    background: theme.gradients.panel,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.panel,
  };

  const buttonStyle = (variant = "primary") => ({
    padding: "12px 22px",
    background:
      variant === "primary"
        ? `linear-gradient(90deg, ${theme.colors.sidebar}, ${theme.colors.primary})`
        : "rgba(255,255,255,0.06)",
    color: "white",
    border:
      variant === "primary" ? "none" : `1px solid ${theme.colors.border}`,
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "15px",
    boxShadow:
      variant === "primary" ? "0 6px 18px rgba(173,86,196,0.3)" : "none",
  });

  return (
    <div
      style={{
        padding: "32px",
        minHeight: "100vh",
        color: theme.colors.text,
        background: theme.gradients.page,
      }}
    >
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>
        Automated Patient Calls
      </h1>
      <p
        style={{
          color: theme.colors.mutedText,
          marginBottom: "30px",
          maxWidth: "900px",
        }}
      >
        Simulates the end-to-end automated patient call loop: Rohit's AI voice
        speaks the personalized follow-up script, then listens to the patient's
        spoken response through the browser microphone. The response is
        transcribed, analyzed by the AI engine, and a clinical report with risk
        alerts is generated automatically.
      </p>

      {/* Top controls */}
      <div
        style={{
          ...cardStyle,
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
            Pending Calls
          </p>
          <h2 style={{ margin: 0, color: theme.colors.secondary }}>
            {calls.length} prepared call{calls.length !== 1 ? "s" : ""} ready
          </h2>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            onClick={handleRunDue}
            disabled={runningDue}
            style={buttonStyle()}
          >
            {runningDue ? "Preparing..." : "Prepare Due Calls"}
          </button>
          <button onClick={loadData} disabled={loadingCalls} style={buttonStyle("secondary")}>
            {loadingCalls ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Active call simulation */}
      {activeCallId && activeCall && (
        <div
          style={{
            ...cardStyle,
            marginBottom: "24px",
            border: `2px solid ${phaseColors[phase]}`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Animated top bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: phaseColors[phase],
              animation:
                phase === PHASES.SPEAKING || phase === PHASES.LISTENING
                  ? "pulse 1.5s ease-in-out infinite"
                  : "none",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", color: theme.colors.secondary }}>
                Call in Progress
              </h2>
              <p style={{ margin: 0, color: theme.colors.mutedText }}>
                Patient: <strong>{getPatientName(activeCall.patient_id)}</strong>{" "}
                | Phone: {getPatientPhone(activeCall.patient_id)} | Workflow:{" "}
                {activeCall.workflow_name}
              </p>
            </div>
            <div
              style={{
                padding: "10px 20px",
                borderRadius: "999px",
                backgroundColor: `${phaseColors[phase]}22`,
                color: phaseColors[phase],
                fontWeight: "700",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: phaseColors[phase],
                  animation:
                    phase === PHASES.SPEAKING ||
                    phase === PHASES.LISTENING ||
                    phase === PHASES.RINGING
                      ? "pulse 1s ease-in-out infinite"
                      : "none",
                }}
              />
              {phaseLabels[phase]}
            </div>
          </div>

          {/* Script preview */}
          {activeCall.script_text && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "16px",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontWeight: "700",
                  color: theme.colors.info,
                  fontSize: "13px",
                }}
              >
                AI Call Script (what Rohit will say):
              </p>
              <p
                style={{
                  margin: 0,
                  color: theme.colors.mutedText,
                  lineHeight: 1.7,
                  fontSize: "14px",
                }}
              >
                {activeCall.script_text}
              </p>
            </div>
          )}

          {callResult?.analysis && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontWeight: "700",
                    color: theme.colors.secondary,
                    fontSize: "13px",
                  }}
                >
                  Transcript Understood
                </p>
                <p
                  style={{
                    margin: 0,
                    color: theme.colors.mutedText,
                    lineHeight: 1.7,
                    fontSize: "14px",
                  }}
                >
                  {callResult.analysis.transcript || "Transcript unavailable"}
                </p>
              </div>
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontWeight: "700",
                    color: theme.colors.accent,
                    fontSize: "13px",
                  }}
                >
                  Triage Note Used
                </p>
                <p
                  style={{
                    margin: 0,
                    color: theme.colors.mutedText,
                    lineHeight: 1.7,
                    fontSize: "14px",
                  }}
                >
                  {callResult.analysis.normalized_message || "No normalized message recorded"}
                </p>
              </div>
            </div>
          )}

          {/* Controls per phase */}
          {phase === PHASES.LISTENING && (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  color: theme.colors.primary,
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                Speak your response as the patient now...
              </p>
              <button
                onClick={handleStopRecording}
                style={{
                  ...buttonStyle(),
                  background: `linear-gradient(90deg, ${theme.colors.danger}, ${theme.colors.primary})`,
                  padding: "14px 36px",
                  fontSize: "16px",
                }}
              >
                Stop & Submit Response
              </button>
              <p
                style={{
                  color: theme.colors.mutedText,
                  fontSize: "13px",
                  marginTop: "10px",
                }}
              >
                Mic status: {status}
              </p>
            </div>
          )}

          {phase === PHASES.PROCESSING && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: `3px solid ${theme.colors.accent}`,
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  margin: "0 auto 14px",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ color: theme.colors.accent, fontWeight: "600" }}>
                Transcribing and analyzing with AI...
              </p>
            </div>
          )}

          {phase === PHASES.RESPONDING && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p
                style={{
                  color: theme.colors.secondary,
                  fontWeight: "700",
                  marginBottom: "12px",
                }}
              >
                Rohit is replying to the patient and closing the call...
              </p>
              <p style={{ color: theme.colors.mutedText, lineHeight: 1.7, margin: "0 auto", maxWidth: "720px" }}>
                {callResult?.patient_reply?.text || "Thank you for sharing your update."}
              </p>
            </div>
          )}

          {phase === PHASES.ERROR && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p
                style={{
                  color: theme.colors.danger,
                  fontWeight: "600",
                  marginBottom: "14px",
                }}
              >
                {errorMsg}
              </p>
              <button onClick={resetCall} style={buttonStyle("secondary")}>
                Dismiss
              </button>
            </div>
          )}

          {phase === PHASES.COMPLETE && callResult && (
            <div>
              <h3
                style={{
                  color: theme.colors.success,
                  margin: "0 0 14px",
                }}
              >
                Call Completed Successfully
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  flexWrap: "wrap",
                  marginBottom: "14px",
                }}
              >
                <p>
                  <b>Risk Level:</b>{" "}
                  <span
                    style={{
                      color:
                        callResult.analysis?.risk_level === "HIGH"
                          ? theme.colors.danger
                          : callResult.analysis?.risk_level === "MEDIUM"
                          ? theme.colors.warning
                          : theme.colors.success,
                      fontWeight: "700",
                    }}
                  >
                    {callResult.analysis?.risk_level || "N/A"}
                  </span>
                </p>
                <p>
                  <b>Condition:</b>{" "}
                  {callResult.analysis?.probable_condition || "None detected"}
                </p>
                <p>
                  <b>Pain Level:</b>{" "}
                  {callResult.analysis?.followup?.pain_level ?? "N/A"}
                </p>
                <p>
                  <b>Fever:</b>{" "}
                  {String(callResult.analysis?.followup?.fever ?? "N/A")}
                </p>
              </div>

              {callResult.call?.call_summary && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "rgba(99,230,190,0.08)",
                    border: "1px solid rgba(99,230,190,0.2)",
                    marginBottom: "14px",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontWeight: "700",
                      color: theme.colors.success,
                      fontSize: "13px",
                    }}
                  >
                    AI Call Summary
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: theme.colors.mutedText,
                      lineHeight: 1.7,
                    }}
                  >
                    {callResult.call.call_summary}
                  </p>
                </div>
              )}

              {callResult.patient_reply?.text && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: "14px",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontWeight: "700",
                      color: theme.colors.info,
                      fontSize: "13px",
                    }}
                  >
                    AI Follow-up Response
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: theme.colors.mutedText,
                      lineHeight: 1.7,
                    }}
                  >
                    {callResult.patient_reply.text}
                  </p>
                </div>
              )}

              <button onClick={resetCall} style={buttonStyle()}>
                Start Next Call
              </button>
            </div>
          )}
        </div>
      )}

      {/* Call Queue */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: "16px", color: theme.colors.secondary }}>
          Call Queue
        </h2>
        {calls.length === 0 ? (
          <p style={{ color: theme.colors.mutedText }}>
            No prepared calls in the queue. Use "Prepare Due Calls" to generate
            them, or go to the Workflow Builder to assign patients and run
            automation.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {calls.map((call) => (
              <div
                key={call.id}
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background:
                    activeCallId === call.id
                      ? "rgba(173,86,196,0.15)"
                      : "rgba(255,255,255,0.05)",
                  border:
                    activeCallId === call.id
                      ? `2px solid ${theme.colors.sidebar}`
                      : "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p style={{ margin: "0 0 6px", fontWeight: "700" }}>
                    {getPatientName(call.patient_id)}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: theme.colors.mutedText,
                      fontSize: "14px",
                    }}
                  >
                    Workflow: {call.workflow_name} | Language:{" "}
                    {call.script_language || call.patient_language || "auto"} |
                    Phone: {getPatientPhone(call.patient_id)}
                  </p>
                </div>
                <button
                  onClick={() => startSimulatedCall(call)}
                  disabled={
                    activeCallId !== null && activeCallId !== call.id
                  }
                  style={{
                    ...buttonStyle(),
                    opacity:
                      activeCallId !== null && activeCallId !== call.id
                        ? 0.4
                        : 1,
                  }}
                >
                  Start Call
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AutomatedCalls;
