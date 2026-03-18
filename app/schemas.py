from datetime import datetime

from pydantic import BaseModel


class PatientCreate(BaseModel):
    name: str
    phone: str
    language: str


class FollowUpCreate(BaseModel):
    patient_id: int
    pain_level: int
    fever: bool
    medicine_taken: bool
    input_source: str = "text"
    transcript: str | None = None
    normalized_message: str | None = None
    language_hint: str | None = None
    audio_filename: str | None = None


class AudioFollowupRequest(BaseModel):
    patient_id: int
    audio_filename: str
    audio_base64: str
    language_hint: str | None = None


class AlertCreate(BaseModel):
    patient_id: int
    risk_level: str
    reason: str


class WorkflowCreate(BaseModel):
    name: str
    trigger_type: str
    audience: str
    language: str
    cadence: str
    message_goal: str
    status: str = "ACTIVE"


class WorkflowAssignmentCreate(BaseModel):
    patient_ids: list[int]


class WorkflowAutomationRunRequest(BaseModel):
    workflow_id: int | None = None


class FollowupCallCreate(BaseModel):
    workflow_id: int
    patient_id: int
    status: str = "PREPARED"
    script_language: str
    tts_voice: str = "nova"
    script_text: str
    tts_audio_base64: str | None = None
    transcript: str | None = None
    normalized_message: str | None = None
    call_summary: str | None = None
    linked_followup_id: int | None = None
    linked_report_id: int | None = None
    scheduled_for: datetime | None = None


class FollowupCallCompleteAudioRequest(BaseModel):
    audio_filename: str
    audio_base64: str
    language_hint: str | None = None


class PatientReportCreate(BaseModel):
    patient_id: int
    trigger_followup_id: int | None = None
    title: str
    content: str
    status: str = "DRAFT"
    recipient: str | None = None


class ReportSendRequest(BaseModel):
    recipient: str = "Medical Team"


class ReportStatusUpdate(BaseModel):
    status: str
