import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LocalHospitalRounded from "@mui/icons-material/LocalHospitalRounded";
import RecordVoiceOverRounded from "@mui/icons-material/RecordVoiceOverRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import MedicationRounded from "@mui/icons-material/MedicationRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import TranslateRounded from "@mui/icons-material/TranslateRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import { getPatients, getFollowups, getAlerts, getReportInbox } from "../api/api";
import theme from "../theme";
import { EmptyState, GlassPanel, MetricCard, PageHeader, StatusPill } from "../components/ui";

function getErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.detail || error?.message || fallbackMessage;
}

function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.allSettled([getPatients(), getFollowups(), getAlerts(), getReportInbox()])
      .then((results) => {
        const [patientsRes, followupsRes, alertsRes, reportsRes] = results;
        const errors = [];

        if (patientsRes.status === "fulfilled") {
          setPatients(patientsRes.value.data);
        } else {
          console.error("Error loading patients:", patientsRes.reason);
          errors.push(getErrorMessage(patientsRes.reason, "Patients could not be loaded."));
        }

        if (followupsRes.status === "fulfilled") {
          setFollowups(followupsRes.value.data);
        } else {
          console.error("Error loading followups:", followupsRes.reason);
          errors.push(getErrorMessage(followupsRes.reason, "Followups could not be loaded."));
        }

        if (alertsRes.status === "fulfilled") {
          setAlerts(alertsRes.value.data);
        } else {
          console.error("Error loading alerts:", alertsRes.reason);
          errors.push(getErrorMessage(alertsRes.reason, "Alerts could not be loaded."));
        }

        if (reportsRes.status === "fulfilled") {
          setReports(reportsRes.value.data);
        } else {
          console.error("Error loading reports:", reportsRes.reason);
          errors.push(getErrorMessage(reportsRes.reason, "Reports could not be loaded."));
        }

        setLoadError(errors.join(" "));
      })
      .finally(() => setLoading(false));
  }, []);

  const pageStyle = {
    padding: theme.layout.pagePadding,
    color: theme.colors.text,
    background: theme.gradients.page,
    minHeight: "100vh"
  };

  const containerStyle = {
    maxWidth: theme.layout.contentMax,
    margin: "0 auto"
  };

  const primaryButtonStyle = {
    padding: "13px 18px",
    background: theme.gradients.accent,
    color: theme.colors.text,
    border: "none",
    borderRadius: theme.radii.md,
    boxShadow: theme.shadows.glow
  };

  const secondaryButtonStyle = {
    padding: "13px 18px",
    background: "rgba(255,255,255,0.05)",
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md
  };

  const getStatusValueColor = (tone) => {
    if (tone === "primary") return theme.colors.primary;
    if (tone === "secondary") return theme.colors.secondary;
    if (tone === "success") return theme.colors.success;
    if (tone === "warning") return theme.colors.warning;
    return theme.colors.info;
  };

  const activeLanguages = [...new Set(patients.map((patient) => patient.language).filter(Boolean))];
  const avgPain = followups.length
    ? (followups.reduce((sum, item) => sum + item.pain_level, 0) / followups.length).toFixed(1)
    : "0.0";
  const adherenceRate = followups.length
    ? Math.round((followups.filter((item) => item.medicine_taken).length / followups.length) * 100)
    : 0;
  const followupCoverage = patients.length
    ? Math.round((followups.length / patients.length) * 100)
    : 0;
  const attentionRate = followups.length
    ? Math.round((alerts.length / followups.length) * 100)
    : 0;
  const draftReports = reports.filter((report) => report.status === "DRAFT").length;
  const sentReports = reports.filter((report) => report.status === "SENT").length;
  const reviewedReports = reports.filter((report) => report.status === "REVIEWED").length;
  const escalatedReports = reports.filter((report) => report.status === "ESCALATED").length;
  const closedReports = reports.filter((report) => report.status === "CLOSED").length;
  const openInboxReports = reports.filter((report) =>
    ["DRAFT", "SENT", "REVIEWED", "ESCALATED"].includes(report.status)
  ).length;
  const highRiskWaiting = reports.filter(
    (report) => report.latest_risk_level === "HIGH" && report.status !== "CLOSED"
  ).length;
  const recentInboxItems = reports.slice(0, 4);
  const inboxStatusCards = [
    { label: "Draft", value: draftReports, tone: "warning", query: "?status=DRAFT" },
    { label: "Sent", value: sentReports, tone: "info", query: "?status=SENT" },
    { label: "Reviewed", value: reviewedReports, tone: "secondary", query: "?status=REVIEWED" },
    { label: "Escalated", value: escalatedReports, tone: "primary", query: "?status=ESCALATED" },
    { label: "Closed", value: closedReports, tone: "success", query: "?status=CLOSED" }
  ];

  const objectives = [
    "Deliver multilingual automated voice follow-ups",
    "Provide regional-language health reminders",
    "Collect structured patient-reported data",
    "Scale engagement without hiring large teams"
  ];

  const stakeholders = [
    "Post-discharge patients",
    "Chronic care patients",
    "Hospital administrators",
    "Care coordination teams"
  ];

  const deliverables = [
    "Voice AI engine with Indic language support",
    "Patient engagement workflow builder",
    "Structured data collection and reporting dashboard"
  ];

  const workflowSteps = [
    {
      title: "Voice Outreach",
      description: "Trigger multilingual reminder or followup calls based on discharge or chronic-care workflows."
    },
    {
      title: "AI Extraction",
      description: "Convert patient replies into structured pain, fever, and medication signals."
    },
    {
      title: "Risk Scoring",
      description: "Flag patients whose symptoms indicate followup urgency or clinical concern."
    },
    {
      title: "Care Escalation",
      description: "Send the queue to doctors and coordinators with reasons and supporting context."
    }
  ];

  const recentAlerts = alerts.slice(0, 3);

  // Per-patient pain chart: auto-select first patient with followups if none chosen
  const patientsWithFollowups = patients.filter(p =>
    followups.some(f => f.patient_id === p.id)
  );
  const effectivePatientId = selectedPatientId ?? patientsWithFollowups[0]?.id ?? null;
  const selectedPatient = patients.find(p => p.id === effectivePatientId) ?? null;
  const chartData = [...followups]
    .filter(f => f.patient_id === effectivePatientId && f.pain_level != null)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((f, i) => ({
      name: `F${i + 1}`,
      pain: f.pain_level,
      date: f.created_at ? new Date(f.created_at).toLocaleDateString() : ""
    }));

  const earlyDetectionCases = [
    {
      icon: "🫀",
      condition: "Hypertension / Cardiac Risk",
      signal: "Persistent chest pain + high pain scores across followups",
      outcome: "AI flags HIGH risk → escalated before acute event"
    },
    {
      icon: "🫁",
      condition: "Respiratory / TB",
      signal: "Recurring cough + fever across multiple followups",
      outcome: "Pattern detected early → fast-tracked for specialist review"
    },
    {
      icon: "🩺",
      condition: "Diabetes Complications",
      signal: "Low medicine adherence + fatigue + pain spikes",
      outcome: "Adherence drop flagged → medication plan adjusted in time"
    },
    {
      icon: "🧠",
      condition: "Neurological Deterioration",
      signal: "Dizziness + worsening pain trend across weeks",
      outcome: "Trend graph shows escalation → imaging ordered proactively"
    },
    {
      icon: "🫘",
      condition: "Chronic Kidney Disease",
      signal: "Swelling, fatigue, and missed dialysis or medication across calls",
      outcome: "Adherence gaps caught early → nephrology referral triggered"
    },
    {
      icon: "🎗️",
      condition: "Cancer (Early Warning)",
      signal: "Unexplained pain + rapid weight loss signals across followups",
      outcome: "Symptom cluster flagged → oncology screening initiated early"
    },
    {
      icon: "🌡️",
      condition: "Sepsis / Severe Infection",
      signal: "Persistent high fever + confusion reported in voice followups",
      outcome: "HIGH risk alert raised → patient fast-tracked to emergency"
    },
    {
      icon: "💊",
      condition: "Mental Health Deterioration",
      signal: "Missed medications + declining engagement across call attempts",
      outcome: "Dropout pattern detected → mental health team notified"
    },
    {
      icon: "🦴",
      condition: "Osteoporosis / Fracture Risk",
      signal: "Bone pain + fall history reported across elderly patient followups",
      outcome: "Risk flagged early → bone density screening recommended"
    },
    {
      icon: "👁️",
      condition: "Diabetic Retinopathy",
      signal: "Vision complaints + poor glucose control signals in followups",
      outcome: "Ophthalmology referral triggered before irreversible damage"
    },
    {
      icon: "🩸",
      condition: "Anaemia / Blood Disorders",
      signal: "Persistent fatigue + pallor + missed iron supplements reported",
      outcome: "Blood work ordered early → transfusion or supplementation started"
    },
    {
      icon: "🫶",
      condition: "Heart Failure (Chronic)",
      signal: "Breathlessness + leg swelling worsening across consecutive calls",
      outcome: "Cardiologist loop closed before acute decompensation"
    },
    {
      icon: "🦠",
      condition: "HIV / Immunodeficiency",
      signal: "Recurring opportunistic infections + ART non-adherence flagged",
      outcome: "ART adherence counselling triggered → viral load managed"
    },
    {
      icon: "🧬",
      condition: "Thyroid Disorders",
      signal: "Fatigue + weight change + missed thyroid medication trend",
      outcome: "Thyroid function test ordered → dosage adjusted in time"
    },
    {
      icon: "🩻",
      condition: "COPD / Chronic Lung Disease",
      signal: "Worsening breathlessness + inhaler non-adherence over weeks",
      outcome: "Pulmonary rehab initiated → hospitalisation prevented"
    },
    {
      icon: "🤒",
      condition: "Malaria / Dengue (Endemic Areas)",
      signal: "Cyclical fever + chills + joint pain reported in voice followups",
      outcome: "Rapid diagnostic test ordered → treatment started within 24 hrs"
    },
    {
      icon: "🧒",
      condition: "Paediatric Malnutrition",
      signal: "Caregiver reports weight loss + feeding refusal over multiple calls",
      outcome: "Nutrition intervention triggered → SAM protocol initiated early"
    },
    {
      icon: "🤰",
      condition: "High-Risk Pregnancy",
      signal: "Bleeding, severe headache, or reduced fetal movement reported",
      outcome: "Obstetric emergency referral within hours of followup call"
    },
    {
      icon: "💉",
      condition: "Post-Surgical Complications",
      signal: "Wound pain spike + fever post-discharge in followup call",
      outcome: "Surgical site infection caught early → antibiotics started"
    },
    {
      icon: "🫠",
      condition: "Stroke Recovery / Relapse",
      signal: "Speech difficulty or limb weakness mentioned in voice followup",
      outcome: "Neurological review triggered → recurrence prevented"
    }
  ];

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <PageHeader
          badge="PS-3 Hackathon Build"
          title="Indic Voice AI-Driven Patient Engagement Platform"
          subtitle="A production-style care operations dashboard for multilingual outreach, structured followups, and faster escalation. This demo turns the hackathon problem statement into something that already looks like an actual hospital product."
          actions={[
            <button
              key="ai"
              onClick={() => navigate("/ai-followup")}
              style={primaryButtonStyle}
            >
              Run AI Followup
            </button>,
            <button
              key="patients"
              onClick={() => navigate("/patients")}
              style={secondaryButtonStyle}
            >
              View Patient Directory
            </button>,
            <button
              key="inbox"
              onClick={() => navigate("/medical-inbox")}
              style={secondaryButtonStyle}
            >
              Open Medical Inbox
            </button>
          ]}
        />

        {loadError && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: theme.radii.md,
              background: "rgba(255,141,161,0.12)",
              border: `1px solid ${theme.colors.primary}`,
              color: theme.colors.text
            }}
          >
            {loadError}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)",
            gap: "20px",
            marginBottom: "24px"
          }}
        >
          <GlassPanel
            title="Problem Context"
            subtitle="SME hospitals face unstructured data, a limited skilled workforce, and operational overload. Indic voice AI makes it possible to automate multilingual followups, collect structured patient data, and extend care without expanding teams."
            action={
              <StatusPill tone={loading ? "warning" : "success"}>
                {loading ? "Syncing live data" : "Live operations view"}
              </StatusPill>
            }
            style={{ background: theme.gradients.hero }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "18px"
              }}
            >
              <div>
                <p style={{ margin: "0 0 14px", color: theme.colors.secondary, fontWeight: "700" }}>
                  Objectives
                </p>
                <div style={{ display: "grid", gap: "10px" }}>
                  {objectives.map((objective) => (
                    <div
                      key={objective}
                      style={{
                        padding: "12px 14px",
                        borderRadius: theme.radii.md,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      {objective}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ margin: "0 0 14px", color: theme.colors.secondary, fontWeight: "700" }}>
                  Why This Works
                </p>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: theme.radii.md,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                      Followup coverage
                    </p>
                    <strong style={{ fontSize: "28px", color: theme.colors.secondary }}>
                      {followupCoverage}%
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: theme.radii.md,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                      Medication adherence
                    </p>
                    <strong style={{ fontSize: "28px", color: theme.colors.accent }}>
                      {adherenceRate}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel
            title="Platform Snapshot"
            subtitle="A quick readout that judges and stakeholders can understand in seconds."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: theme.radii.md,
                  background: "rgba(255,255,255,0.04)"
                }}
              >
                <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                  Supported languages in the current directory
                </p>
                <strong style={{ fontSize: "28px", color: theme.colors.info }}>
                  {activeLanguages.length}
                </strong>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: theme.radii.md,
                  background: "rgba(255,255,255,0.04)"
                }}
              >
                <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                  Attention rate
                </p>
                <strong style={{ fontSize: "28px", color: theme.colors.primary }}>
                  {attentionRate}%
                </strong>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: theme.radii.md,
                  background: "rgba(255,255,255,0.04)"
                }}
              >
                <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                  Average reported pain
                </p>
                <strong style={{ fontSize: "28px", color: theme.colors.secondary }}>
                  {avgPain}
                </strong>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel
            title={selectedPatient ? `Pain Trend — ${selectedPatient.name}` : "Patient Pain Trend"}
            subtitle={selectedPatient
              ? `Pain level across ${chartData.length} followup${chartData.length !== 1 ? "s" : ""} · Language: ${selectedPatient.language || "—"}`
              : "Select a patient to view their individual pain trend over time."
            }
            action={
              <select
                value={effectivePatientId ?? ""}
                onChange={e => setSelectedPatientId(Number(e.target.value) || null)}
                style={{
                  background: "#2a1f3d",
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: "8px",
                  color: "#ffffff",
                  padding: "6px 10px",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                {patientsWithFollowups.length === 0 && (
                  <option style={{ background: "#2a1f3d", color: "#ffffff" }} value="">No patients with followups</option>
                )}
                {patientsWithFollowups.map(p => (
                  <option style={{ background: "#2a1f3d", color: "#ffffff" }} key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            }
          >
            <div style={{ height: "240px", width: "100%", marginTop: "16px" }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.colors.secondary} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={theme.colors.secondary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke={theme.colors.mutedText} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke={theme.colors.mutedText} fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(30, 30, 30, 0.9)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: "8px",
                        color: theme.colors.text
                      }}
                      formatter={(value, name) => [value, "Pain Level"]}
                      labelFormatter={(label, payload) => {
                        const entry = payload?.[0]?.payload;
                        return entry ? `${label} · ${entry.date}` : label;
                      }}
                      itemStyle={{ color: theme.colors.secondary }}
                    />
                    <Area type="monotone" dataKey="pain" stroke={theme.colors.secondary} strokeWidth={3} fillOpacity={1} fill="url(#colorPain)" name="Pain Level" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title={patientsWithFollowups.length === 0 ? "No patient followups yet" : "No pain data for this patient"}
                  description={patientsWithFollowups.length === 0
                    ? "Complete AI Followups for patients to start tracking pain trends."
                    : "This patient has followups but no recorded pain scores."
                  }
                />
              )}
            </div>
          </GlassPanel>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "24px"
          }}
        >
          <MetricCard
            icon={LocalHospitalRounded}
            label="Tracked patients"
            value={patients.length}
            helper="Live patient directory"
            tone="secondary"
          />
          <MetricCard
            icon={RecordVoiceOverRounded}
            label="Voice followups logged"
            value={followups.length}
            helper="Structured patient responses"
            tone="accent"
          />
          <MetricCard
            icon={WarningAmberRounded}
            label="Open alerts"
            value={alerts.length}
            helper="Needs clinical attention"
            tone="primary"
          />
          <MetricCard
            icon={MedicationRounded}
            label="Medication adherence"
            value={`${adherenceRate}%`}
            helper="Based on completed followups"
            tone="success"
          />
          <MetricCard
            icon={InboxRounded}
            label="Inbox reports"
            value={openInboxReports}
            helper="Awaiting team action"
            tone="info"
          />
        </div>

        {/* Early Disease Detection Section */}
        <GlassPanel
          title="Early Disease Detection via Continuous Followup"
          subtitle="How structured AI followups catch life-threatening conditions before they escalate. Every followup is a screening opportunity."
          action={<StatusPill tone="primary">Chronic Care Advantage</StatusPill>}
          style={{ marginBottom: "24px" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "14px",
              marginTop: "4px"
            }}
          >
            {earlyDetectionCases.map((item) => (
              <div
                key={item.condition}
                style={{
                  padding: "18px",
                  borderRadius: theme.radii.md,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "26px" }}>{item.icon}</span>
                  <strong style={{ color: theme.colors.secondary, fontSize: "15px" }}>{item.condition}</strong>
                </div>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)",
                    fontSize: "13px",
                    color: theme.colors.mutedText,
                    lineHeight: 1.6
                  }}
                >
                  <span style={{ color: theme.colors.accent, fontWeight: "600" }}>Signal: </span>
                  {item.signal}
                </div>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "rgba(var(--color-success-rgb, 100,220,120), 0.07)",
                    border: "1px solid rgba(100,220,120,0.2)",
                    fontSize: "13px",
                    color: theme.colors.success ?? "#80eaa0",
                    lineHeight: 1.6
                  }}
                >
                  <span style={{ fontWeight: "600" }}>✓ Outcome: </span>
                  {item.outcome}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 1fr)",
            gap: "20px",
            marginBottom: "24px"
          }}
        >
          <GlassPanel
            title="Operational Workflow"
            subtitle="The core flow that takes the solution from voice outreach to escalation-ready clinical insight."
            action={<StatusPill tone="info">Hospital ops flow</StatusPill>}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px"
              }}
            >
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  style={{
                    padding: "18px",
                    borderRadius: theme.radii.md,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  <p style={{ margin: "0 0 10px", color: theme.colors.accent, fontWeight: "700" }}>
                    Step {index + 1}
                  </p>
                  <h3 style={{ margin: "0 0 10px" }}>{step.title}</h3>
                  <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel
            title="Stakeholders and Deliverables"
            subtitle="A concise framing of who benefits and what the platform already points toward."
            action={<StatusPill tone="secondary">Pitch-ready</StatusPill>}
          >
            <div style={{ display: "grid", gap: "18px" }}>
              <div>
                <p style={{ margin: "0 0 12px", color: theme.colors.secondary, fontWeight: "700" }}>
                  Key stakeholders
                </p>
                <div style={{ display: "grid", gap: "10px" }}>
                  {stakeholders.map((stakeholder) => (
                    <div key={stakeholder} style={{ color: theme.colors.mutedText }}>
                      {stakeholder}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ margin: "0 0 12px", color: theme.colors.secondary, fontWeight: "700" }}>
                  Expected deliverables
                </p>
                <div style={{ display: "grid", gap: "10px" }}>
                  {deliverables.map((deliverable) => (
                    <div key={deliverable} style={{ color: theme.colors.mutedText }}>
                      {deliverable}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
            gap: "20px"
          }}
        >
          <GlassPanel
            title="Priority Alert Queue"
            subtitle="Recent high-risk patients surfaced by the AI followup flow."
            action={<StatusPill tone="primary">{alerts.length} active alerts</StatusPill>}
          >
            {recentAlerts.length === 0 ? (
              <EmptyState
                title="No urgent cases right now"
                description="When the system detects critical symptoms, this queue becomes the live handoff point for doctors and coordinators."
              />
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "16px 18px",
                      borderRadius: theme.radii.md,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <div>
                      <p style={{ margin: "0 0 6px", fontWeight: "700" }}>Patient #{alert.patient_id}</p>
                      <p style={{ margin: 0, color: theme.colors.mutedText }}>{alert.reason}</p>
                    </div>
                    <StatusPill tone="primary">{alert.risk_level}</StatusPill>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel
            title="Medical Team Inbox"
            subtitle="Track report handoffs, review progress, and unresolved escalations."
            action={
              <button
                onClick={() => navigate("/medical-inbox")}
                style={{
                  ...secondaryButtonStyle,
                  padding: "10px 14px"
                }}
              >
                Open Inbox
              </button>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                marginBottom: "16px"
              }}
            >
              {inboxStatusCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => navigate(`/medical-inbox${card.query}`)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: theme.radii.md,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: theme.colors.text,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                    {card.label}
                  </p>
                  <strong style={{ fontSize: "28px", color: getStatusValueColor(card.tone) }}>{card.value}</strong>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate("/medical-inbox?risk=HIGH")}
              style={{
                width: "100%",
                marginBottom: "16px",
                padding: "16px 18px",
                borderRadius: theme.radii.md,
                background: "linear-gradient(135deg, rgba(255,120,120,0.14), rgba(255,191,90,0.08))",
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <div>
                <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                  High-risk reports waiting
                </p>
                <strong style={{ fontSize: "28px", color: theme.colors.primary }}>{highRiskWaiting}</strong>
              </div>
              <StatusPill tone="primary">Open HIGH queue</StatusPill>
            </button>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: theme.radii.md,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "16px"
              }}
            >
              <p style={{ margin: "0 0 6px", color: theme.colors.mutedText, fontSize: "14px" }}>
                Queue status
              </p>
              <p style={{ margin: 0, color: theme.colors.text, lineHeight: 1.6 }}>
                {openInboxReports} reports are still active in the medical handoff loop and {closedReports} have been closed.
              </p>
            </div>

            {recentInboxItems.length === 0 ? (
              <EmptyState
                title="No reports in the queue"
                description="As patient reports are generated and handed off, they will appear here for the medical team."
              />
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {recentInboxItems.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => navigate(`/medical-inbox?selected=${report.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "16px 18px",
                      borderRadius: theme.radii.md,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: theme.colors.text,
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                  >
                    <div>
                      <p style={{ margin: "0 0 6px", fontWeight: "700" }}>
                        {report.patient_name} - Report #{report.id}
                      </p>
                      <p style={{ margin: 0, color: theme.colors.mutedText }}>
                        {report.latest_alert_reason || report.title}
                      </p>
                    </div>
                    <StatusPill tone={report.status === "ESCALATED" ? "primary" : "info"}>
                      {report.status}
                    </StatusPill>
                  </button>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel
            title="Language Coverage"
            subtitle="The product is strongest when the language layer is visible everywhere in the experience."
            action={<StatusPill tone="info">{activeLanguages.length || 0} languages</StatusPill>}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
              {activeLanguages.length === 0 ? (
                <StatusPill tone="warning">No language data yet</StatusPill>
              ) : (
                activeLanguages.map((language) => (
                  <StatusPill key={language} tone="accent">
                    {language}
                  </StatusPill>
                ))
              )}
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ color: theme.colors.mutedText, lineHeight: 1.7 }}>
                <TranslateRounded sx={{ fontSize: 18, verticalAlign: "middle", marginRight: "8px" }} />
                Add outbound voice journeys by region and language.
              </div>
              <div style={{ color: theme.colors.mutedText, lineHeight: 1.7 }}>
                <InsightsRounded sx={{ fontSize: 18, verticalAlign: "middle", marginRight: "8px" }} />
                Track call completion, drop-offs, and symptom trends by cohort.
              </div>
              <div style={{ color: theme.colors.mutedText, lineHeight: 1.7 }}>
                <AutoAwesomeRounded sx={{ fontSize: 18, verticalAlign: "middle", marginRight: "8px" }} />
                Layer in AI-generated summaries for doctors before the next call.
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
