import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getReportInbox, sendReport, updateReportStatus } from "../api/api";
import theme from "../theme";

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

function normalizeSearchValue(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[#:/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const VALID_STATUS_FILTERS = ["ALL", "DRAFT", "SENT", "REVIEWED", "ESCALATED", "CLOSED"];
const VALID_RISK_FILTERS = ["ALL", "HIGH", "MEDIUM", "LOW", "NONE"];

function getValidFilter(value, validValues) {
  return validValues.includes(value) ? value : validValues[0];
}

function getSelectedReportParam(searchParams) {
  const rawValue = searchParams.get("selected");
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function MedicalInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(() => getSelectedReportParam(searchParams));
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(() =>
    getValidFilter(searchParams.get("status") || "ALL", VALID_STATUS_FILTERS)
  );
  const [riskFilter, setRiskFilter] = useState(() =>
    getValidFilter(searchParams.get("risk") || "ALL", VALID_RISK_FILTERS)
  );

  const loadInbox = async (preferredReportId = null) => {
    try {
      setLoading(true);
      const response = await getReportInbox();
      const nextReports = response.data;
      setReports(nextReports);

      const fallbackId = nextReports[0]?.id || null;
      setSelectedReportId(preferredReportId || selectedReportId || fallbackId);
    } catch (err) {
      console.error("Error loading medical inbox:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getReportInbox()
      .then((response) => {
        const nextReports = response.data;
        setReports(nextReports);
        setSelectedReportId(nextReports[0]?.id || null);
      })
      .catch((err) => console.error("Error loading medical inbox:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const nextSearch = searchParams.get("search") || "";
    const nextStatus = getValidFilter(searchParams.get("status") || "ALL", VALID_STATUS_FILTERS);
    const nextRisk = getValidFilter(searchParams.get("risk") || "ALL", VALID_RISK_FILTERS);
    const nextSelected = getSelectedReportParam(searchParams);

    setSearch((current) => (current === nextSearch ? current : nextSearch));
    setStatusFilter((current) => (current === nextStatus ? current : nextStatus));
    setRiskFilter((current) => (current === nextRisk ? current : nextRisk));
    if (nextSelected !== null) {
      setSelectedReportId((current) => (current === nextSelected ? current : nextSelected));
    }
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (search.trim()) {
      nextParams.set("search", search.trim());
    }
    if (statusFilter !== "ALL") {
      nextParams.set("status", statusFilter);
    }
    if (riskFilter !== "ALL") {
      nextParams.set("risk", riskFilter);
    }
    if (selectedReportId) {
      nextParams.set("selected", String(selectedReportId));
    }

    const currentParams = searchParams.toString();
    const nextParamsString = nextParams.toString();
    if (currentParams !== nextParamsString) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [riskFilter, search, searchParams, selectedReportId, setSearchParams, statusFilter]);

  const filteredReports = useMemo(() => {
    const searchTerms = normalizeSearchValue(search).split(" ").filter(Boolean);

    return reports.filter((report) => {
      const searchableText = normalizeSearchValue(
        [
          report.id,
          report.patient_id,
          report.trigger_followup_id,
          report.patient_name,
          report.patient_language,
          report.title,
          report.status,
          report.recipient,
          report.latest_risk_level,
          report.latest_alert_reason,
          report.content
        ].join(" ")
      );

      const matchesSearch =
        searchTerms.length === 0 ||
        searchTerms.every((term) => searchableText.includes(term));

      const matchesStatus = statusFilter === "ALL" || report.status === statusFilter;
      const matchesRisk = riskFilter === "ALL" || report.latest_risk_level === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [reports, riskFilter, search, statusFilter]);

  useEffect(() => {
    if (filteredReports.length === 0) {
      setSelectedReportId(null);
      return;
    }

    const stillVisible = filteredReports.some((report) => report.id === selectedReportId);
    if (!stillVisible) {
      setSelectedReportId(filteredReports[0].id);
    }
  }, [filteredReports, selectedReportId]);

  const selectedReport =
    filteredReports.find((report) => report.id === selectedReportId) ||
    null;

  const handleSend = async (reportId) => {
    try {
      setActionLoading(true);
      await sendReport(reportId, "Medical Team");
      await loadInbox(reportId);
      alert("Report sent to the medical team");
    } catch (err) {
      console.error("Error sending report:", err);
      alert("Failed to send report");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId, status) => {
    try {
      setActionLoading(true);
      await updateReportStatus(reportId, status);
      await loadInbox(reportId);
      alert(`Report marked as ${status}`);
    } catch (err) {
      console.error("Error updating report status:", err);
      alert("Failed to update report status");
    } finally {
      setActionLoading(false);
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

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>Medical Team Inbox</h1>
      <p style={{ color: theme.colors.mutedText, maxWidth: "860px", marginBottom: "28px" }}>
        Review sent patient reports, track acknowledgement states, and manage the medical-team handoff queue from one place.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.45fr)",
          gap: "24px",
          alignItems: "start"
        }}
      >
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={cardStyle}>
            <div style={{ display: "grid", gap: "12px" }}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by patient, report, followup, risk, or ID"
                style={inputStyle}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
                  <option value="ALL">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="ESCALATED">Escalated</option>
                  <option value="CLOSED">Closed</option>
                </select>

                <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} style={inputStyle}>
                  <option value="ALL">All risks</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="NONE">None</option>
                </select>
              </div>
            </div>
          </div>

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
              <p style={{ margin: 0, color: theme.colors.mutedText }}>Reports in Inbox</p>
              <h2 style={{ margin: "8px 0 0", fontSize: "36px", color: theme.colors.secondary }}>
                {filteredReports.length}
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
              Team handoff queue
            </div>
          </div>

          {loading && (
            <div style={cardStyle}>
              <p style={{ margin: 0, color: theme.colors.mutedText }}>Loading inbox...</p>
            </div>
          )}

          {!loading && filteredReports.length === 0 && (
            <div style={cardStyle}>
              <p style={{ margin: 0, color: theme.colors.mutedText }}>No reports match the current filters.</p>
            </div>
          )}

          {!loading && filteredReports.map((report) => {
            const isSelected = report.id === selectedReportId;

            return (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReportId(report.id)}
                style={{
                  ...cardStyle,
                  textAlign: "left",
                  cursor: "pointer",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(255,141,161,0.22), rgba(173,86,196,0.2))"
                    : cardStyle.background,
                  border: isSelected ? `1px solid ${theme.colors.accent}` : cardStyle.border
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
                  <strong>{report.patient_name}</strong>
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
                    {report.status}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>{report.title}</p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  Patient #{report.patient_id} | Risk {report.latest_risk_level}
                </p>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>
                  {report.sent_at ? `Sent ${formatDate(report.sent_at)}` : `Created ${formatDate(report.created_at)}`}
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
                gap: "12px",
                marginBottom: "14px",
                flexWrap: "wrap"
              }}
            >
              <div>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>Selected Report</p>
                <h2 style={{ margin: "8px 0 0", color: theme.colors.secondary }}>
                  {selectedReport ? selectedReport.title : "No report selected"}
                </h2>
              </div>

              {selectedReport && (
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {selectedReport.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleSend(selectedReport.id)}
                      disabled={actionLoading}
                      style={{
                        padding: "10px 14px",
                        background: theme.gradients.accent,
                        color: theme.colors.text,
                        border: "none",
                        borderRadius: "12px",
                        opacity: actionLoading ? 0.8 : 1
                      }}
                    >
                      Send To Team
                    </button>
                  )}
                  {selectedReport.status !== "REVIEWED" && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedReport.id, "REVIEWED")}
                      disabled={actionLoading}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.06)",
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: "12px",
                        opacity: actionLoading ? 0.8 : 1
                      }}
                    >
                      Mark Reviewed
                    </button>
                  )}
                  {selectedReport.status !== "ESCALATED" && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedReport.id, "ESCALATED")}
                      disabled={actionLoading}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.06)",
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: "12px",
                        opacity: actionLoading ? 0.8 : 1
                      }}
                    >
                      Escalate
                    </button>
                  )}
                  {selectedReport.status !== "CLOSED" && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedReport.id, "CLOSED")}
                      disabled={actionLoading}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.06)",
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: "12px",
                        opacity: actionLoading ? 0.8 : 1
                      }}
                    >
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>

            {!selectedReport && (
              <p style={{ margin: 0, color: theme.colors.mutedText }}>
                Select a report from the inbox to review the full handoff details.
              </p>
            )}

            {selectedReport && (
              <>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Patient:</b> {selectedReport.patient_name} (#{selectedReport.patient_id})
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Language:</b> {selectedReport.patient_language || "Not provided"}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Risk Level:</b> {selectedReport.latest_risk_level}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Latest Alert:</b> {selectedReport.latest_alert_reason || "No alert reason available"}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Created:</b> {formatDate(selectedReport.created_at)}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Recipient:</b> {selectedReport.recipient || "Not sent yet"}
                </p>
                <p style={{ margin: "0 0 18px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Sent:</b> {selectedReport.sent_at ? formatDate(selectedReport.sent_at) : "Not sent yet"}
                </p>

                <div
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {selectedReport.content}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MedicalInbox;
