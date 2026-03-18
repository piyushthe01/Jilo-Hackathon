import { useEffect, useState } from "react";
import { getFollowups } from "../api/api";
import theme from "../theme";

function formatDate(value) {
  if (!value) {
    return "Just now";
  }

  return new Date(value).toLocaleString();
}

function formatInputSource(value) {
  return value === "audio" ? "Voice note" : "Typed message";
}

function Followups() {
  const [followups, setFollowups] = useState([]);
  const [filter, setFilter] = useState("ALL");
  
  const voiceFollowups = followups.filter((followup) => followup.input_source === "audio").length;

  const filteredFollowups = followups.filter((f) => {
    if (filter === "ALL") return true;
    if (filter === "AUDIO") return f.input_source === "audio";
    if (filter === "FEVER") return f.fever;
    if (filter === "PAIN_HIGH") return f.pain_level >= 7;
    return true;
  });

  useEffect(() => {
    getFollowups()
      .then((res) => {
        setFollowups(res.data);
      })
      .catch((err) => console.error("Error fetching followups:", err));
  }, []);

  const pageStyle = {
    padding: "32px",
    minHeight: "100vh",
    color: theme.colors.text,
    background: "linear-gradient(135deg, #1f1f1f, #2a1f2d)"
  };

  const cardStyle = {
    padding: "22px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(255,194,186,0.08), rgba(255,156,233,0.08))",
    border: `1px solid ${theme.colors.border}`,
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>Followups</h1>
      <p style={{ color: theme.colors.mutedText, marginBottom: "28px", maxWidth: "820px" }}>
        Review AI-recorded followups, grouped by ascending patient ID and shown newest to
        oldest within each patient using the actual followup timestamp.
      </p>

      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "24px",
          maxWidth: "760px"
        }}
      >
        <div>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Total Followups</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "36px", color: theme.colors.accent }}>
            {followups.length}
          </h2>
        </div>
        <div>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Voice Followups</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "36px", color: theme.colors.info }}>
            {voiceFollowups}
          </h2>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ color: theme.colors.mutedText, fontWeight: "600" }}>Filter:</span>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none"
              }}
            >
              <option value="ALL">All Followups</option>
              <option value="AUDIO">Voice Logs Only</option>
              <option value="FEVER">Has Fever</option>
              <option value="PAIN_HIGH">High Pain (7+)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredFollowups.length === 0 && (
        <div style={{ ...cardStyle, maxWidth: "760px" }}>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>No followups found for the selected filter.</p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px"
        }}
      >
        {filteredFollowups.map((f) => (
          <div key={f.id} style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "16px"
              }}
            >
              <h3 style={{ margin: 0, color: theme.colors.secondary }}>
                Patient #{f.patient_id}
              </h3>
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(255,141,161,0.18)",
                  color: theme.colors.primary,
                  fontSize: "13px",
                  fontWeight: "700"
                }}
              >
                Pain {f.pain_level}
              </span>
            </div>

            <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Fever:</b> {f.fever ? "Yes" : "No"}
            </p>
            <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Medicine Taken:</b>{" "}
              {f.medicine_taken ? "Yes" : "No"}
            </p>
            <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Recorded:</b> {formatDate(f.created_at)}
            </p>
            <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Source:</b> {formatInputSource(f.input_source)}
            </p>
            {f.language_hint && (
              <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Language:</b> {f.language_hint}
              </p>
            )}
            {f.transcript && (
              <p style={{ margin: "0 0 10px", color: theme.colors.mutedText, lineHeight: 1.6 }}>
                <b style={{ color: theme.colors.text }}>Transcript:</b> {f.transcript}
              </p>
            )}
            {f.normalized_message && f.normalized_message !== f.transcript && (
              <p style={{ margin: "0 0 10px", color: theme.colors.mutedText, lineHeight: 1.6 }}>
                <b style={{ color: theme.colors.text }}>Triage Message:</b> {f.normalized_message}
              </p>
            )}
            <p style={{ margin: 0, color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Followup ID:</b> {f.id}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Followups;
