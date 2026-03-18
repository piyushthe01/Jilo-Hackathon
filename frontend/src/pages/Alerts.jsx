import { useEffect, useState } from "react";
import { getAlerts } from "../api/api";
import theme from "../theme";

function formatDate(value) {
  if (!value) {
    return "Just now";
  }

  return new Date(value).toLocaleString();
}

function Alerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    getAlerts().then((res) => {
      setAlerts(res.data);
    });
  }, []);

  const pageStyle = {
    padding: "32px",
    minHeight: "100vh",
    color: theme.colors.text,
    background: theme.gradients.page
  };

  const cardStyle = {
    padding: "22px",
    borderRadius: "18px",
    background: theme.gradients.panel,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.panel
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>Clinical Alerts</h1>
      <p style={{ color: theme.colors.mutedText, marginBottom: "28px", maxWidth: "820px" }}>
        Monitor flagged patients and review disease-aware reasons the AI marked them for followup.
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
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Open Alerts</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "36px", color: theme.colors.primary }}>
            {alerts.length}
          </h2>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,0.06)",
            color: theme.colors.accent,
            fontWeight: "700"
          }}
        >
          Needs review
        </div>
      </div>

      {alerts.length === 0 && (
        <div style={{ ...cardStyle, maxWidth: "760px" }}>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>No alerts detected.</p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px"
        }}
      >
        {alerts.map((alert) => (
          <div key={alert.id} style={cardStyle}>
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
                Patient #{alert.patient_id}
              </h3>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    backgroundColor: alert.risk_level === "HIGH" 
                      ? "rgba(255,141,161,0.18)" 
                      : alert.risk_level === "MEDIUM" 
                        ? "rgba(255,194,186,0.18)"
                        : "rgba(173,86,196,0.18)",
                    color: alert.risk_level === "HIGH" 
                      ? theme.colors.primary 
                      : alert.risk_level === "MEDIUM" 
                        ? theme.colors.accent 
                        : theme.colors.secondary,
                    fontSize: "13px",
                    fontWeight: "700",
                    border: `1px solid ${alert.risk_level === "HIGH" ? theme.colors.primary : "transparent"}`
                  }}
                >
                  {alert.risk_level} Risk
                </span>
              </div>

              <p style={{ margin: "0 0 10px", color: theme.colors.mutedText, lineHeight: 1.5 }}>
              <b style={{ color: theme.colors.text }}>Reason:</b> {alert.reason}
            </p>
            <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Raised:</b> {formatDate(alert.created_at)}
            </p>
            <p style={{ margin: 0, color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Alert ID:</b> {alert.id}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Alerts;
