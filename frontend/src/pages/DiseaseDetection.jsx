import theme from "../theme";
import { GlassPanel, PageHeader, StatusPill } from "../components/ui";
import MonitorHeartRounded from "@mui/icons-material/MonitorHeartRounded";

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

function DiseaseDetection() {
  return (
    <div
      style={{
        padding: theme.layout.pagePadding,
        color: theme.colors.text,
        background: theme.gradients.page,
        minHeight: "100vh"
      }}
    >
      <div style={{ maxWidth: theme.layout.contentMax, margin: "0 auto" }}>
        <PageHeader
          badge="Clinical Intelligence"
          title="Early Disease Detection"
          subtitle="How structured AI followups catch life-threatening conditions before they escalate. Every call is a passive screening opportunity — patterns across followups reveal what a single visit cannot."
          actions={[
            <StatusPill key="count" tone="primary">
              {earlyDetectionCases.length} conditions monitored
            </StatusPill>
          ]}
        />

        {/* How it works strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "28px"
          }}
        >
          {[
            { step: "1", label: "Voice Followup", desc: "Patient answers structured questions in their own language" },
            { step: "2", label: "Symptom Extraction", desc: "AI pulls pain level, fever, and medication adherence signals" },
            { step: "3", label: "Pattern Matching", desc: "Risk engine matches symptom clusters to known disease patterns" },
            { step: "4", label: "Early Escalation", desc: "Doctor is alerted before the condition becomes an emergency" }
          ].map(item => (
            <div
              key={item.step}
              style={{
                padding: "16px",
                borderRadius: theme.radii.md,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: theme.gradients.accent,
                    display: "grid",
                    placeItems: "center",
                    fontSize: "13px",
                    fontWeight: "800",
                    flexShrink: 0
                  }}
                >
                  {item.step}
                </div>
                <strong style={{ color: theme.colors.secondary, fontSize: "14px" }}>{item.label}</strong>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: theme.colors.mutedText, lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Disease cards grid */}
        <GlassPanel
          title="Conditions Detectable via Continuous Followup"
          subtitle="Each row shows the pattern the AI picks up across multiple calls and the clinical action it enables."
          action={<StatusPill tone="secondary">{earlyDetectionCases.length} conditions</StatusPill>}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "14px",
              marginTop: "8px"
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
                    background: "rgba(100,220,120,0.07)",
                    border: "1px solid rgba(100,220,120,0.2)",
                    fontSize: "13px",
                    color: "#80eaa0",
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
      </div>
    </div>
  );
}

export default DiseaseDetection;
