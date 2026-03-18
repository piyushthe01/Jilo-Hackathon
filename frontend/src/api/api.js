import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read audio file"));
    reader.readAsDataURL(file);
  });
}

export const getPatients = () => API.get("/patients");
export const getPatientHistory = (patientId) => API.get(`/patients/${patientId}/history`);
export const getDoctorSummary = (patientId) => API.get(`/patients/${patientId}/doctor-summary`);
export const generatePatientReport = (patientId) => API.post(`/patients/${patientId}/reports/generate`);
export const getReportInbox = () => API.get("/reports/inbox");
export const getFollowups = () => API.get("/followups");
export const getAlerts = () => API.get("/alerts");
export const createPatient = (payload) => API.post("/patients", payload);
export const getWorkflows = () => API.get("/workflows");
export const createWorkflow = (payload) => API.post("/workflows", payload);
export const getWorkflowAssignments = () => API.get("/workflow-assignments");
export const assignPatientsToWorkflow = (workflowId, patientIds) =>
  API.post(`/workflows/${workflowId}/assign-patients`, { patient_ids: patientIds });
export const deleteWorkflowAssignment = (assignmentId) =>
  API.delete(`/workflow-assignments/${assignmentId}`);
export const runActiveWorkflowAutomation = (workflowId = null) =>
  API.post(
    "/automation/run-active-workflows",
    { workflow_id: workflowId ? Number(workflowId) : null },
    { timeout: 120000 }
  );
export const runDueWorkflowAutomation = () =>
  API.post("/automation/run-due-workflows", {}, { timeout: 120000 });
export const getFollowupCalls = () => API.get("/followup-calls");
export const sendReport = (reportId, recipient = "Medical Team") =>
  API.post(`/reports/${reportId}/send`, { recipient });
export const updateReportStatus = (reportId, status) =>
  API.post(`/reports/${reportId}/status`, { status });

export const analyzeFollowup = (patient_id, message) =>
  API.post(`/ai-followup?patient_id=${patient_id}&message=${encodeURIComponent(message)}`);

export const analyzeAudioFollowup = async (patientId, file, languageHint) => {
  const audioBase64 = await fileToBase64(file);

  return API.post(
    "/ai-followup/audio",
    {
      patient_id: Number(patientId),
      audio_filename: file.name,
      audio_base64: audioBase64,
      language_hint: languageHint === "auto" ? null : languageHint
    },
    {
      timeout: 60000
    }
  );
};

export const completeFollowupCallWithAudio = async (callId, file, languageHint) => {
  const audioBase64 = await fileToBase64(file);

  return API.post(
    `/followup-calls/${callId}/complete/audio`,
    {
      audio_filename: file.name,
      audio_base64: audioBase64,
      language_hint: languageHint === "auto" ? null : languageHint
    },
    {
      timeout: 60000
    }
  );
};
