import { useEffect, useState } from "react";
import {
  createPatient,
  generatePatientReport,
  getDoctorSummary,
  getPatientHistory,
  getPatients,
  sendReport
} from "../api/api";
import theme from "../theme";
import { downloadPdfDocument } from "../utils/pdf";

const emptyForm = {
  name: "",
  phone: "",
  language: ""
};

function getErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.detail || error?.message || fallbackMessage;
}

function formatDate(value) {
  if (!value) {
    return "Just now";
  }

  return new Date(value).toLocaleString();
}

function formatInputSource(value) {
  return value === "audio" ? "Voice note" : "Typed message";
}

function Patients() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [doctorSummary, setDoctorSummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadPatientHistory = async (patientId) => {
    if (!patientId) {
      setPatientHistory(null);
      setDoctorSummary(null);
      return;
    }

    try {
      setHistoryLoading(true);
      setLoadError("");
      const [historyResponse, summaryResponse] = await Promise.all([
        getPatientHistory(patientId),
        getDoctorSummary(patientId)
      ]);
      setPatientHistory(historyResponse.data);
      setDoctorSummary(summaryResponse.data);
      setSelectedPatientId(patientId);
    } catch (err) {
      console.error("Error fetching patient history:", err);
      setLoadError(getErrorMessage(err, "Failed to load patient history."));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPatients = async (preferredPatientId = null) => {
    try {
      setLoadError("");
      const response = await getPatients();
      const nextPatients = response.data;
      setPatients(nextPatients);

      const fallbackId = nextPatients[0]?.id || null;
      const nextSelectedId = preferredPatientId || selectedPatientId || fallbackId;

      if (nextSelectedId) {
        loadPatientHistory(nextSelectedId);
      } else {
        setSelectedPatientId(null);
        setPatientHistory(null);
      }
    } catch (err) {
      console.error("Error fetching patients:", err);
      setLoadError(getErrorMessage(err, "Failed to load patients."));
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.language.trim()) {
      alert("Please enter name, phone, and language");
      return;
    }

    try {
      setSaving(true);
      const response = await createPatient({
        name: form.name.trim(),
        phone: form.phone.trim(),
        language: form.language.trim()
      });
      setForm(emptyForm);
      await loadPatients(response.data.id);
    } catch (err) {
      console.error("Error creating patient:", err);
      alert(getErrorMessage(err, "Failed to add patient"));
    } finally {
      setSaving(false);
    }
  };

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

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) || patientHistory?.patient;
  const followups = patientHistory?.followups || [];
  const alerts = patientHistory?.alerts || [];
  const reports = patientHistory?.reports || [];
  const feverCount = followups.filter((item) => item.fever).length;
  const medicineCount = followups.filter((item) => item.medicine_taken).length;
  const voiceFollowups = followups.filter((item) => item.input_source === "audio");

  const doctorSummaryText = doctorSummary
    ? [
        doctorSummary.headline,
        doctorSummary.summary,
        "Next steps:",
        ...(doctorSummary.next_steps || []).map((step, index) => `${index + 1}. ${step}`)
      ].join("\n")
    : "";

  const handleCopySummary = async () => {
    if (!doctorSummaryText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(doctorSummaryText);
      alert("Doctor summary copied");
    } catch (err) {
      console.error("Error copying summary:", err);
      alert("Failed to copy summary");
    }
  };

  const handleDownloadSummary = () => {
    if (!doctorSummaryText || !selectedPatient) {
      return;
    }

    const blob = new Blob([doctorSummaryText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `patient-${selectedPatient.id}-doctor-summary.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSummaryPdf = () => {
    if (!doctorSummaryText || !selectedPatient) {
      return;
    }

    downloadPdfDocument(
      `patient-${selectedPatient.id}-doctor-summary.pdf`,
      `Doctor Summary - ${selectedPatient.name}`,
      doctorSummaryText
    );
  };

  const handleGenerateReport = async () => {
    if (!selectedPatient) {
      return;
    }

    try {
      setReportActionLoading(true);
      await generatePatientReport(selectedPatient.id);
      await loadPatientHistory(selectedPatient.id);
      alert("Patient report generated and stored");
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Failed to generate patient report");
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleSendReport = async (reportId) => {
    try {
      setReportActionLoading(true);
      await sendReport(reportId, "Medical Team");
      await loadPatientHistory(selectedPatient.id);
      alert("Report marked as sent to the medical team");
    } catch (err) {
      console.error("Error sending report:", err);
      alert("Failed to send report");
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleDownloadReport = (report) => {
    const blob = new Blob([report.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `patient-${report.patient_id}-report-${report.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReportPdf = (report) => {
    downloadPdfDocument(
      `patient-${report.patient_id}-report-${report.id}.pdf`,
      report.title,
      report.content
    );
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>Patients</h1>
      <p style={{ color: theme.colors.mutedText, maxWidth: "860px", marginBottom: "28px" }}>
        Add new patients to the directory, then select any patient to review their followup
        history, symptom trends, and alert summary.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)",
          gap: "24px",
          alignItems: "start",
          marginBottom: "24px"
        }}
      >
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "16px", color: theme.colors.secondary }}>
            Add Patient
          </h2>

          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Name
              </label>
              <input
                value={form.name}
                onChange={handleChange("name")}
                placeholder="Enter patient name"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Phone
              </label>
              <input
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="Enter phone number"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Language
              </label>
              <input
                value={form.language}
                onChange={handleChange("language")}
                placeholder="Hindi, English, Tamil, Odia..."
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 22px",
                background: `linear-gradient(90deg, ${theme.colors.sidebar}, ${theme.colors.primary})`,
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: saving ? "default" : "pointer",
                fontWeight: "700",
                fontSize: "15px",
                opacity: saving ? 0.8 : 1,
                boxShadow: "0 6px 18px rgba(173,86,196,0.3)"
              }}
            >
              {saving ? "Saving..." : "Add Patient"}
            </button>
          </div>
        </form>

        <div
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px"
          }}
        >
          <div>
            <p style={{ margin: 0, color: theme.colors.mutedText }}>Registered Patients</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "36px", color: theme.colors.secondary }}>
              {patients.length}
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
            Select a patient
          </div>
        </div>
      </div>

      {loadError && (
        <div
          style={{
            ...cardStyle,
            marginBottom: "24px",
            border: `1px solid ${theme.colors.primary}`,
            background: "linear-gradient(135deg, rgba(255,141,161,0.12), rgba(173,86,196,0.12))"
          }}
        >
          <p style={{ margin: 0, color: theme.colors.text }}>
            {loadError}
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.4fr)",
          gap: "24px",
          alignItems: "start"
        }}
      >
        <div style={{ display: "grid", gap: "18px" }}>
          {patients.length === 0 && (
            <div style={cardStyle}>
              <p style={{ margin: 0, color: theme.colors.mutedText }}>No patients found.</p>
            </div>
          )}

          {patients.map((patient) => {
            const isSelected = patient.id === selectedPatientId;

            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => loadPatientHistory(patient.id)}
                style={{
                  ...cardStyle,
                  textAlign: "left",
                  cursor: "pointer",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(255,141,161,0.22), rgba(173,86,196,0.2))"
                    : cardStyle.background,
                  border: isSelected
                    ? `1px solid ${theme.colors.accent}`
                    : cardStyle.border
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "16px"
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "22px", color: theme.colors.secondary }}>
                    {patient.name}
                  </h3>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(173,86,196,0.2)",
                      color: theme.colors.accent,
                      fontSize: "13px",
                      fontWeight: "700"
                    }}
                  >
                    {patient.language}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "10px"
                  }}
                >
                  <p style={{ margin: 0, color: theme.colors.mutedText }}>
                    <b style={{ color: theme.colors.text }}>Phone:</b> {patient.phone}
                  </p>
                  <span style={{ fontSize: "12px", color: theme.colors.mutedText }}>
                    {formatDate(patient.created_at)}
                  </span>
                </div>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Patient ID:</b> {patient.id}
                </p>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: "18px" }}>
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "14px"
              }}
            >
              <div>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Selected Patient</p>
                <h2 style={{ margin: "8px 0 0", color: theme.colors.secondary }}>
                  {selectedPatient ? selectedPatient.name : "No patient selected"}
                </h2>
              </div>
              {selectedPatient && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: theme.colors.accent,
                    fontWeight: "700"
                  }}
                >
                  Patient #{selectedPatient.id}
                </div>
              )}
            </div>

            {!selectedPatient && (
              <p style={{ margin: 0, color: theme.colors.mutedText }}>
                Choose a patient from the directory to see their followup history and summary.
              </p>
            )}

            {selectedPatient && (
              <>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Phone:</b> {selectedPatient.phone}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Language:</b> {selectedPatient.language}
                </p>
                <p style={{ margin: "16px 0 0", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                  {historyLoading ? "Loading patient summary..." : patientHistory?.summary}
                </p>
              </>
            )}
          </div>

          {selectedPatient && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "14px"
              }}
            >
              <div style={cardStyle}>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Followups</p>
                <h3 style={{ margin: "8px 0 0", color: theme.colors.secondary }}>
                  {followups.length}
                </h3>
              </div>
              <div style={cardStyle}>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Alerts</p>
                <h3 style={{ margin: "8px 0 0", color: theme.colors.primary }}>
                  {alerts.length}
                </h3>
              </div>
              <div style={cardStyle}>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Fever Reports</p>
                <h3 style={{ margin: "8px 0 0", color: theme.colors.accent }}>
                  {feverCount}
                </h3>
              </div>
              <div style={cardStyle}>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Medicine Taken</p>
                <h3 style={{ margin: "8px 0 0", color: theme.colors.secondary }}>
                  {medicineCount}
                </h3>
              </div>
              <div style={cardStyle}>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Stored Reports</p>
                <h3 style={{ margin: "8px 0 0", color: theme.colors.secondary }}>
                  {reports.length}
                </h3>
              </div>
              <div style={cardStyle}>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Voice Interactions</p>
                <h3 style={{ margin: "8px 0 0", color: theme.colors.info }}>
                  {voiceFollowups.length}
                </h3>
              </div>
            </div>
          )}

          {selectedPatient && (
            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "14px",
                  flexWrap: "wrap"
                }}
              >
                <h3 style={{ margin: 0, color: theme.colors.secondary }}>Doctor Summary</h3>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.06)",
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: "12px"
                    }}
                  >
                    Copy Summary
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSummaryPdf}
                    style={{
                      padding: "10px 14px",
                      background: theme.gradients.accent,
                      color: theme.colors.text,
                      border: "none",
                      borderRadius: "12px"
                    }}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSummary}
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.06)",
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: "12px"
                    }}
                  >
                    Download TXT
                  </button>
                </div>
              </div>

              {historyLoading && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Building doctor summary...</p>
              )}

              {!historyLoading && doctorSummary && (
                <>
                  <p style={{ margin: "0 0 10px", color: theme.colors.text, fontWeight: "700" }}>
                    {doctorSummary.headline}
                  </p>
                  <p style={{ margin: "0 0 14px", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                    {doctorSummary.summary}
                  </p>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {(doctorSummary.next_steps || []).map((step, index) => (
                      <div key={step} style={{ color: theme.colors.mutedText }}>
                        {index + 1}. {step}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {selectedPatient && (
            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "14px",
                  flexWrap: "wrap"
                }}
              >
                <h3 style={{ margin: 0, color: theme.colors.secondary }}>Stored Reports</h3>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={reportActionLoading}
                  style={{
                    padding: "10px 14px",
                    background: theme.gradients.accent,
                    color: theme.colors.text,
                    border: "none",
                    borderRadius: "12px",
                    opacity: reportActionLoading ? 0.8 : 1
                  }}
                >
                  {reportActionLoading ? "Working..." : "Generate Report"}
                </button>
              </div>

              {historyLoading && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Loading stored reports...</p>
              )}

              {!historyLoading && reports.length === 0 && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>
                  No stored reports yet. Generate one from the linked patient history or create one automatically via AI followup.
                </p>
              )}

              {!historyLoading && reports.length > 0 && (
                <div style={{ display: "grid", gap: "12px" }}>
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "8px",
                          flexWrap: "wrap"
                        }}
                      >
                        <strong>{report.title}</strong>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: "999px",
                            backgroundColor: report.status === "SENT"
                              ? "rgba(99,230,190,0.18)"
                              : "rgba(255,255,255,0.06)",
                            color: report.status === "SENT" ? theme.colors.success : theme.colors.accent,
                            fontSize: "13px",
                            fontWeight: "700"
                          }}
                        >
                          {report.status}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                        Created: {formatDate(report.created_at)}
                      </p>
                      <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                        Recipient: {report.recipient || "Not sent yet"}
                      </p>
                      {report.sent_at && (
                        <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                          Sent: {formatDate(report.sent_at)}
                        </p>
                      )}
                      <p style={{ margin: "0 0 14px", color: theme.colors.mutedText, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {report.content}
                      </p>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        {report.status !== "SENT" && (
                          <button
                            type="button"
                            onClick={() => handleSendReport(report.id)}
                            disabled={reportActionLoading}
                            style={{
                              padding: "10px 14px",
                              background: "rgba(255,255,255,0.06)",
                              color: theme.colors.text,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: "12px",
                              opacity: reportActionLoading ? 0.8 : 1
                            }}
                          >
                            Send To Medical Team
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadReportPdf(report)}
                          style={{
                            padding: "10px 14px",
                            background: theme.gradients.accent,
                            color: theme.colors.text,
                            border: "none",
                            borderRadius: "12px"
                          }}
                        >
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadReport(report)}
                          style={{
                            padding: "10px 14px",
                            background: "rgba(255,255,255,0.06)",
                            color: theme.colors.text,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: "12px"
                          }}
                        >
                          Download TXT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedPatient && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: "14px", color: theme.colors.secondary }}>
                Followup Timeline
              </h3>

              {historyLoading && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Loading followup history...</p>
              )}

              {!historyLoading && followups.length === 0 && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>No followups recorded for this patient yet.</p>
              )}

              {!historyLoading && followups.length > 0 && (
                <div style={{ display: "grid", gap: "12px" }}>
                  {followups.map((followup) => (
                    <div
                      key={followup.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "10px"
                        }}
                      >
                        <strong>Followup #{followup.id}</strong>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: "999px",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            color: theme.colors.accent,
                            fontSize: "13px",
                            fontWeight: "700"
                          }}
                        >
                          Pain {followup.pain_level}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                        Recorded: {formatDate(followup.created_at)}
                      </p>
                      <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                        Source: {formatInputSource(followup.input_source)}
                      </p>
                      {followup.language_hint && (
                        <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                          Language: {followup.language_hint}
                        </p>
                      )}
                      <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                        Fever: {followup.fever ? "Yes" : "No"}
                      </p>
                      <p style={{ margin: 0, color: theme.colors.mutedText }}>
                        Medicine Taken: {followup.medicine_taken ? "Yes" : "No"}
                      </p>
                      {followup.transcript && (
                        <p style={{ margin: "10px 0 0", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                          <b style={{ color: theme.colors.text }}>Transcript:</b> {followup.transcript}
                        </p>
                      )}
                      {followup.normalized_message && followup.normalized_message !== followup.transcript && (
                        <p style={{ margin: "8px 0 0", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                          <b style={{ color: theme.colors.text }}>Triage Message:</b> {followup.normalized_message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedPatient && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: "14px", color: theme.colors.secondary }}>
                Voice Interaction Log
              </h3>

              {historyLoading && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Loading voice interactions...</p>
              )}

              {!historyLoading && voiceFollowups.length === 0 && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>
                  No voice interactions have been captured for this patient yet.
                </p>
              )}

              {!historyLoading && voiceFollowups.length > 0 && (
                <div style={{ display: "grid", gap: "12px" }}>
                  {voiceFollowups.map((followup) => (
                    <div
                      key={`voice-${followup.id}`}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "10px",
                          flexWrap: "wrap"
                        }}
                      >
                        <strong>Voice Followup #{followup.id}</strong>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: "999px",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            color: theme.colors.info,
                            fontSize: "13px",
                            fontWeight: "700"
                          }}
                        >
                          {followup.language_hint || selectedPatient.language || "Language not set"}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                        Recorded: {formatDate(followup.created_at)}
                      </p>
                      {followup.audio_filename && (
                        <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                          File: {followup.audio_filename}
                        </p>
                      )}
                      <p style={{ margin: "0 0 10px", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                        <b style={{ color: theme.colors.text }}>Transcript:</b> {followup.transcript || "Transcript unavailable"}
                      </p>
                      <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>
                        <b style={{ color: theme.colors.text }}>Normalized Triage Note:</b>{" "}
                        {followup.normalized_message || "No normalized message recorded"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedPatient && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: "14px", color: theme.colors.secondary }}>
                Alert History
              </h3>

              {historyLoading && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Loading alerts...</p>
              )}

              {!historyLoading && alerts.length === 0 && (
                <p style={{ margin: 0, color: theme.colors.mutedText }}>No alerts recorded for this patient.</p>
              )}

              {!historyLoading && alerts.length > 0 && (
                <div style={{ display: "grid", gap: "12px" }}>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "8px"
                        }}
                      >
                        <strong>Alert #{alert.id}</strong>
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
                          {alert.risk_level}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px", color: theme.colors.mutedText }}>
                        Raised: {formatDate(alert.created_at)}
                      </p>
                      <p style={{ margin: 0, color: theme.colors.mutedText }}>{alert.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Patients;
