import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignPatientsToWorkflow,
  completeFollowupCallWithAudio,
  createWorkflow,
  deleteWorkflowAssignment,
  getFollowupCalls,
  getPatients,
  getWorkflowAssignments,
  getWorkflows,
  runActiveWorkflowAutomation,
  runDueWorkflowAutomation
} from "../api/api";
import theme from "../theme";

const emptyForm = {
  name: "",
  trigger_type: "Post-discharge",
  audience: "",
  language: "hi",
  cadence: "",
  message_goal: "",
  status: "ACTIVE"
};

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

const workflowLanguageOptions = languageOptions.filter((option) => option.value !== "auto");
const workflowLanguageLabelMap = Object.fromEntries(
  workflowLanguageOptions.map((option) => [option.value, option.label])
);

const languageAliases = {
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
    return "";
  }

  return languageAliases[value.trim().toLowerCase()] || "";
}

function formatDate(value) {
  if (!value) {
    return "Just now";
  }

  return new Date(value).toLocaleString();
}

function summarizeAutomationResult(responseData, label) {
  const workflowResults = responseData?.workflow_results || [];
  const skippedCount = workflowResults.reduce(
    (sum, item) => sum + (item.skipped_patients?.length || 0),
    0
  );
  const createdCount = responseData?.count || 0;
  const touchedWorkflowCount = workflowResults.filter(
    (item) => (item.created_count || 0) > 0 || (item.existing_count || 0) > 0
  ).length;

  if (skippedCount > 0) {
    return `Prepared ${createdCount} ${label}. ${skippedCount} patient${skippedCount === 1 ? "" : "s"} were skipped due to automation or language issues.`;
  }

  return `Prepared ${createdCount} ${label}${touchedWorkflowCount ? ` across ${touchedWorkflowCount} workflow${touchedWorkflowCount === 1 ? "" : "s"}` : ""}.`;
}

function scheduleBadgeStyle(status) {
  if (status === "DUE") {
    return {
      backgroundColor: "rgba(255, 214, 102, 0.18)",
      color: "#ffd666"
    };
  }
  if (status === "SCHEDULED") {
    return {
      backgroundColor: "rgba(125, 211, 252, 0.18)",
      color: "#7dd3fc"
    };
  }
  if (status === "UNASSIGNED") {
    return {
      backgroundColor: "rgba(255,255,255,0.08)",
      color: theme.colors.mutedText
    };
  }

  return {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: theme.colors.accent
  };
}

function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState([]);
  const [patients, setPatients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [calls, setCalls] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState(null);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [runningDueAutomation, setRunningDueAutomation] = useState(false);
  const [callActionLoadingId, setCallActionLoadingId] = useState(null);
  const [responseFiles, setResponseFiles] = useState({});
  const [responseLanguages, setResponseLanguages] = useState({});

  // Use a ref so loadAutomationData can read the current selectedWorkflowId
  // without being a dependency of useCallback (which would cause infinite re-renders).
  const selectedWorkflowIdRef = useRef(selectedWorkflowId);
  useEffect(() => {
    selectedWorkflowIdRef.current = selectedWorkflowId;
  }, [selectedWorkflowId]);

  const loadAutomationData = useCallback(async (preferredWorkflowId = null) => {
    try {
      const [workflowResponse, patientResponse, assignmentResponse, callResponse] = await Promise.all([
        getWorkflows(),
        getPatients(),
        getWorkflowAssignments(),
        getFollowupCalls()
      ]);

      const nextWorkflows = workflowResponse.data;
      setWorkflows(nextWorkflows);
      setPatients(patientResponse.data);
      setAssignments(assignmentResponse.data);
      setCalls(callResponse.data);

      const fallbackWorkflowId = nextWorkflows[0]?.id ? String(nextWorkflows[0].id) : "";
      const nextSelectedWorkflowId =
        preferredWorkflowId || selectedWorkflowIdRef.current || fallbackWorkflowId;
      setSelectedWorkflowId(nextSelectedWorkflowId ? String(nextSelectedWorkflowId) : "");
    } catch (err) {
      console.error("Error loading workflow automation data:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAutomationData();
  }, [loadAutomationData]);

  useEffect(() => {
    setSelectedPatientIds([]);
  }, [selectedWorkflowId]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.audience.trim() || !form.language.trim() || !form.cadence.trim() || !form.message_goal.trim()) {
      alert("Please complete all workflow fields");
      return;
    }

    try {
      setSaving(true);
      const response = await createWorkflow({
        ...form,
        name: form.name.trim(),
        audience: form.audience.trim(),
        language: workflowLanguageLabelMap[form.language] || form.language.trim(),
        cadence: form.cadence.trim(),
        message_goal: form.message_goal.trim()
      });
      setForm(emptyForm);
      await loadAutomationData(String(response.data.id));
    } catch (err) {
      console.error("Error creating workflow:", err);
      alert("Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePatient = (patientId) => {
    setSelectedPatientIds((current) =>
      current.includes(patientId)
        ? current.filter((id) => id !== patientId)
        : [...current, patientId]
    );
  };

  const handleAssignPatients = async () => {
    if (!selectedWorkflowId || selectedPatientIds.length === 0) {
      alert("Select a workflow and at least one patient");
      return;
    }

    try {
      setAssigning(true);
      const response = await assignPatientsToWorkflow(Number(selectedWorkflowId), selectedPatientIds);
      setSelectedPatientIds([]);
      await loadAutomationData(selectedWorkflowId);
      alert(
        response.data.length > 0
          ? `${response.data.length} patient${response.data.length === 1 ? "" : "s"} assigned to workflow`
          : "No new patients were assigned. Check language match or existing assignments."
      );
    } catch (err) {
      console.error("Error assigning patients:", err);
      alert("Failed to assign patients");
    } finally {
      setAssigning(false);
    }
  };

  const handleRunAutomation = async () => {
    try {
      setRunningAutomation(true);
      const response = await runActiveWorkflowAutomation(selectedWorkflowId || null);
      await loadAutomationData(selectedWorkflowId);
      alert(
        selectedWorkflowId
          ? summarizeAutomationResult(response.data, "AI followup call" + (response.data.count === 1 ? "" : "s") + " for the selected workflow")
          : summarizeAutomationResult(response.data, "AI followup call" + (response.data.count === 1 ? "" : "s"))
      );
    } catch (err) {
      console.error("Error running workflow automation:", err);
      alert(err.response?.data?.detail || "Failed to run AI followup automation");
    } finally {
      setRunningAutomation(false);
    }
  };

  const handleRunDueAutomation = async () => {
    try {
      setRunningDueAutomation(true);
      const response = await runDueWorkflowAutomation();
      await loadAutomationData(selectedWorkflowId);
      alert(summarizeAutomationResult(response.data, "scheduled AI followup call" + (response.data.count === 1 ? "" : "s")));
    } catch (err) {
      console.error("Error running due workflow automation:", err);
      alert(err.response?.data?.detail || "Failed to run due workflows");
    } finally {
      setRunningDueAutomation(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      setRemovingAssignmentId(assignmentId);
      await deleteWorkflowAssignment(assignmentId);
      await loadAutomationData(selectedWorkflowId);
      alert("Patient removed from workflow");
    } catch (err) {
      console.error("Error removing workflow assignment:", err);
      alert(err.response?.data?.detail || "Failed to remove patient from workflow");
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  const handleCompleteCall = async (call) => {
    const file = responseFiles[call.id];
    if (!file) {
      alert("Upload a patient response audio file first");
      return;
    }

    const languageHint =
      responseLanguages[call.id] ||
      normalizeLanguageValue(call.script_language || call.patient_language) ||
      "auto";

    try {
      setCallActionLoadingId(call.id);
      await completeFollowupCallWithAudio(call.id, file, languageHint);
      setResponseFiles((current) => ({ ...current, [call.id]: null }));
      await loadAutomationData(selectedWorkflowId);
      alert("Automated call response analyzed and stored");
    } catch (err) {
      console.error("Error completing automated followup call:", err);
      alert(err.response?.data?.detail || "Failed to analyze automated call response");
    } finally {
      setCallActionLoadingId(null);
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

  const preparedCalls = calls.filter((call) => call.status === "PREPARED").length;
  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => String(workflow.id) === String(selectedWorkflowId)) || null,
    [workflows, selectedWorkflowId]
  );
  const dueWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.schedule_status === "DUE"),
    [workflows]
  );
  const scheduledWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.schedule_status === "SCHEDULED"),
    [workflows]
  );
  const selectedWorkflowAssignments = useMemo(
    () => assignments.filter((assignment) => String(assignment.workflow_id) === String(selectedWorkflowId)),
    [assignments, selectedWorkflowId]
  );
  const selectedWorkflowLanguage = normalizeLanguageValue(selectedWorkflow?.language);
  const selectedWorkflowPatientIds = useMemo(
    () => new Set(selectedWorkflowAssignments.map((assignment) => assignment.patient_id)),
    [selectedWorkflowAssignments]
  );
  const availablePatients = useMemo(
    () =>
      patients.filter((patient) => {
        if (selectedWorkflowPatientIds.has(patient.id)) {
          return false;
        }

        if (!selectedWorkflowLanguage) {
          return true;
        }

        return normalizeLanguageValue(patient.language) === selectedWorkflowLanguage;
      }),
    [patients, selectedWorkflowLanguage, selectedWorkflowPatientIds]
  );

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: "48px", marginBottom: "12px" }}>Workflow Builder</h1>
      <p style={{ color: theme.colors.mutedText, maxWidth: "920px", marginBottom: "28px" }}>
        Configure care workflows, assign patients, and let OpenAI prepare automated multilingual followup calls.
        This page now runs the full in-product automation loop: generate the call script, synthesize a voice preview,
        and analyze patient reply audio back into the followup pipeline.
      </p>

      <div
        style={{
          ...cardStyle,
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>Caller Identity</p>
          <p style={{ margin: 0, color: theme.colors.text, lineHeight: 1.7 }}>
            Automated calls are now generated as <b>Rohit</b> from <b>Wellness Hospital</b> using a multilingual AI voice path tuned for clearer pronunciation.
          </p>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,0.06)",
            color: theme.colors.info,
            fontWeight: "700"
          }}
        >
          Voice: Multilingual AI
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>Automation Mode</p>
          <p style={{ margin: 0, color: theme.colors.text, lineHeight: 1.7 }}>
            Scheduled workflows can now become due automatically. Run the due batch to queue calls for workflows whose next run time has arrived,
            or manually trigger a selected workflow whenever you want to override the schedule.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRunDueAutomation}
            disabled={runningDueAutomation}
            style={{
              padding: "12px 18px",
              background: theme.gradients.accent,
              color: theme.colors.text,
              border: "none",
              borderRadius: "12px",
              fontWeight: "700",
              opacity: runningDueAutomation ? 0.8 : 1
            }}
          >
            {runningDueAutomation ? "Running Due..." : "Run Due Workflows"}
          </button>
          <button
            type="button"
            onClick={handleRunAutomation}
            disabled={runningAutomation}
            style={{
              padding: "12px 18px",
              background: "rgba(255,255,255,0.06)",
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: "12px",
              fontWeight: "700",
              opacity: runningAutomation ? 0.8 : 1
            }}
          >
            {runningAutomation ? "Running..." : "Run Selected Workflow Now"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "24px"
        }}
      >
        <div style={cardStyle}>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Configured Workflows</p>
          <h2 style={{ margin: "8px 0 0", color: theme.colors.secondary }}>{workflows.length}</h2>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Due Workflows</p>
          <h2 style={{ margin: "8px 0 0", color: "#ffd666" }}>{dueWorkflows.length}</h2>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Prepared AI Calls</p>
          <h2 style={{ margin: "8px 0 0", color: theme.colors.accent }}>{preparedCalls}</h2>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, color: theme.colors.mutedText }}>Scheduled Workflows</p>
          <h2 style={{ margin: "8px 0 0", color: theme.colors.info }}>{scheduledWorkflows.length}</h2>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
          gap: "24px",
          alignItems: "start",
          marginBottom: "24px"
        }}
      >
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "16px", color: theme.colors.secondary }}>
            New Workflow
          </h2>

          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Workflow Name</label>
              <input value={form.name} onChange={handleChange("name")} placeholder="Post-discharge fever check" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Trigger Type</label>
              <select value={form.trigger_type} onChange={handleChange("trigger_type")} style={inputStyle}>
                <option>Post-discharge</option>
                <option>Chronic care</option>
                <option>Medication reminder</option>
                <option>Escalation callback</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Audience</label>
              <input value={form.audience} onChange={handleChange("audience")} placeholder="Recent surgery patients" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Language</label>
              <select value={form.language} onChange={handleChange("language")} style={inputStyle}>
                {workflowLanguageOptions.map((option) => (
                  <option key={option.value} value={option.value} style={{ color: "#111" }}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Cadence</label>
              <input value={form.cadence} onChange={handleChange("cadence")} placeholder="24 hours after discharge, then every 3 days" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Message Goal</label>
              <textarea value={form.message_goal} onChange={handleChange("message_goal")} rows="4" placeholder="Check pain, fever, medicine adherence, and decide if escalation is needed." style={{ ...inputStyle, resize: "vertical" }} />
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
              {saving ? "Saving..." : "Save Workflow"}
            </button>
          </div>
        </form>

        <div style={{ display: "grid", gap: "18px" }}>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", color: theme.colors.secondary }}>
              Due Followup Queue
            </h2>
            {dueWorkflows.length === 0 ? (
              <p style={{ margin: 0, color: theme.colors.mutedText }}>
                No workflows are due right now. Scheduled workflows will appear here when their next run time arrives.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {dueWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    style={{
                      padding: "12px 14px",
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
                      <strong style={{ color: theme.colors.text }}>{workflow.name}</strong>
                      <span
                        style={{
                          padding: "6px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: "700",
                          ...scheduleBadgeStyle(workflow.schedule_status)
                        }}
                      >
                        {workflow.schedule_status}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 4px", color: theme.colors.mutedText }}>
                      Language: {workflow.language} | Assigned patients: {workflow.assignment_count}
                    </p>
                    <p style={{ margin: 0, color: theme.colors.mutedText }}>
                      Next run: {formatDate(workflow.next_run_at)} | Pending calls: {workflow.pending_call_count}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "16px",
                flexWrap: "wrap"
              }}
            >
              <div>
                <h2 style={{ margin: 0, color: theme.colors.secondary }}>Patient Assignment</h2>
                <p style={{ margin: "8px 0 0", color: theme.colors.mutedText }}>
                  Attach patients to a workflow before you run the AI followup automation batch.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAssignPatients}
                disabled={assigning}
                style={{
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.06)",
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: "12px",
                  opacity: assigning ? 0.8 : 1
                }}
              >
                {assigning ? "Assigning..." : "Assign Patients"}
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Workflow</label>
                <select
                  value={selectedWorkflowId}
                  onChange={(event) => setSelectedWorkflowId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id} style={{ color: "#111" }}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p style={{ margin: "0 0 10px", fontWeight: "600" }}>Patients</p>
                {selectedWorkflow && (
                  <p style={{ margin: "0 0 10px", color: theme.colors.mutedText }}>
                    Showing patients whose preferred language matches the selected workflow.
                  </p>
                )}
                <div
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    display: "grid",
                    gap: "10px",
                    paddingRight: "4px"
                  }}
                >
                  {availablePatients.map((patient) => (
                    <label
                      key={patient.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPatientIds.includes(patient.id)}
                        onChange={() => handleTogglePatient(patient.id)}
                      />
                      <span>
                        {patient.name} (#{patient.id}) - {patient.language}
                      </span>
                    </label>
                  ))}
                  {availablePatients.length === 0 && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: theme.colors.mutedText
                      }}
                    >
                      No unassigned patients match this workflow yet.
                    </div>
                  )}
                </div>
              </div>

              {selectedWorkflowId && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  <p style={{ margin: "0 0 8px", fontWeight: "700", color: theme.colors.secondary }}>
                    Already assigned
                  </p>
                  {selectedWorkflowAssignments.length === 0 ? (
                    <p style={{ margin: 0, color: theme.colors.mutedText }}>
                      No patients assigned to this workflow yet.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: "8px" }}>
                      {selectedWorkflowAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            color: theme.colors.mutedText
                          }}
                        >
                          <span>
                            {assignment.patient_name} (#{assignment.patient_id})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignment(assignment.id)}
                            disabled={removingAssignmentId === assignment.id}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "10px",
                              border: `1px solid ${theme.colors.border}`,
                              background: "rgba(255,255,255,0.06)",
                              color: theme.colors.text,
                              opacity: removingAssignmentId === assignment.id ? 0.8 : 1
                            }}
                          >
                            {removingAssignmentId === assignment.id ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {workflows.map((workflow) => (
            <div key={workflow.id} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "14px"
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 6px", color: theme.colors.secondary }}>{workflow.name}</h3>
                  <p style={{ margin: 0, color: theme.colors.mutedText }}>{workflow.trigger_type}</p>
                </div>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    ...scheduleBadgeStyle(workflow.schedule_status),
                    fontSize: "13px",
                    fontWeight: "700"
                  }}
                >
                  {workflow.schedule_status}
                </span>
              </div>

              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Audience:</b> {workflow.audience}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Language:</b> {workflow.language}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Cadence:</b> {workflow.cadence}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Cadence Hours:</b> Every {workflow.cadence_hours} hour{workflow.cadence_hours === 1 ? "" : "s"}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                <b style={{ color: theme.colors.text }}>Goal:</b> {workflow.message_goal}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Assigned Patients:</b> {workflow.assignment_count || 0}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Next Run:</b> {formatDate(workflow.next_run_at)}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Last Run:</b> {workflow.last_run_at ? formatDate(workflow.last_run_at) : "Not run yet"}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Pending Calls:</b> {workflow.pending_call_count}
              </p>
              <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Completed Calls:</b> {workflow.completed_call_count}
              </p>
              <p style={{ margin: 0, color: theme.colors.mutedText }}>
                <b style={{ color: theme.colors.text }}>Created:</b> {formatDate(workflow.created_at)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: "18px" }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "12px", color: theme.colors.secondary }}>
            Automated Call Queue
          </h2>
          <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>
            Each entry below is an AI-prepared followup call. OpenAI generated the call script in the workflow language,
            synthesized a spoken preview, and waits for the patient response audio to complete the followup loop.
          </p>
        </div>

        {calls.length === 0 && (
          <div style={cardStyle}>
            <p style={{ margin: 0, color: theme.colors.mutedText }}>
              No automated calls prepared yet. Assign patients to a workflow and run the automation batch.
            </p>
          </div>
        )}

        {calls.map((call) => (
          <div key={call.id} style={cardStyle}>
            {call.workflow_language && call.patient_language && normalizeLanguageValue(call.workflow_language) !== normalizeLanguageValue(call.patient_language) && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(255, 214, 102, 0.12)",
                  border: "1px solid rgba(255, 214, 102, 0.35)",
                  color: theme.colors.text
                }}
              >
                Workflow language and patient language do not match. This call should be regenerated after fixing the assignment.
              </div>
            )}
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
                <h3 style={{ margin: "0 0 6px", color: theme.colors.secondary }}>
                  {call.patient_name} - {call.workflow_name}
                </h3>
                <p style={{ margin: 0, color: theme.colors.mutedText }}>
                  Patient #{call.patient_id} | Patient language: {call.patient_language || "Unknown"} | Workflow language: {call.workflow_language || "Unknown"}
                </p>
              </div>
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: "999px",
                  backgroundColor: call.status === "COMPLETED"
                    ? "rgba(99,230,190,0.18)"
                    : "rgba(255,255,255,0.06)",
                  color: call.status === "COMPLETED" ? theme.colors.success : theme.colors.accent,
                  fontSize: "13px",
                  fontWeight: "700"
                }}
              >
                {call.status}
              </span>
            </div>

            <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Prepared:</b> {formatDate(call.created_at)}
            </p>
            <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Caller:</b> {call.caller_name} from {call.hospital_name}
            </p>
            <p style={{ margin: "0 0 12px", color: theme.colors.mutedText }}>
              <b style={{ color: theme.colors.text }}>Voice Preview:</b> {call.tts_voice}
            </p>
            <p style={{ margin: "0 0 12px", color: theme.colors.mutedText, lineHeight: 1.7 }}>
              <b style={{ color: theme.colors.text }}>AI Call Script:</b> {call.script_text}
            </p>

            {call.tts_audio_base64 && (
              <div style={{ marginBottom: "14px" }}>
                <audio
                  controls
                  src={`data:audio/mpeg;base64,${call.tts_audio_base64}`}
                  style={{ width: "100%" }}
                >
                  <track kind="captions" />
                </audio>
              </div>
            )}

            {call.status !== "COMPLETED" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 180px auto",
                  gap: "12px",
                  alignItems: "center",
                  marginBottom: "12px"
                }}
              >
                <input
                  type="file"
                  accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
                  onChange={(event) =>
                    setResponseFiles((current) => ({
                      ...current,
                      [call.id]: event.target.files?.[0] || null
                    }))
                  }
                  style={{ ...inputStyle, padding: "10px 12px" }}
                />

                <select
                  value={responseLanguages[call.id] || normalizeLanguageValue(call.script_language || call.patient_language) || "auto"}
                  onChange={(event) =>
                    setResponseLanguages((current) => ({
                      ...current,
                      [call.id]: event.target.value
                    }))
                  }
                  style={inputStyle}
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value} style={{ color: "#111" }}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleCompleteCall(call)}
                  disabled={callActionLoadingId === call.id}
                  style={{
                    padding: "12px 16px",
                    background: theme.gradients.accent,
                    color: theme.colors.text,
                    border: "none",
                    borderRadius: "12px",
                    opacity: callActionLoadingId === call.id ? 0.8 : 1
                  }}
                >
                  {callActionLoadingId === call.id ? "Analyzing..." : "Complete Call"}
                </button>
              </div>
            )}

            {call.status === "COMPLETED" && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText }}>
                  <b style={{ color: theme.colors.text }}>Completed:</b> {formatDate(call.completed_at)}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                  <b style={{ color: theme.colors.text }}>Patient Transcript:</b> {call.transcript || "Not captured"}
                </p>
                <p style={{ margin: "0 0 8px", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                  <b style={{ color: theme.colors.text }}>Normalized Message:</b>{" "}
                  {call.normalized_message || "Not available"}
                </p>
                <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>
                  <b style={{ color: theme.colors.text }}>AI Call Summary:</b>{" "}
                  {call.call_summary || "No AI summary recorded"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkflowBuilder;
