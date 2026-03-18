from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func, Index
from sqlalchemy.orm import relationship
from .database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    language = Column(String, nullable=False, default="English")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    followups = relationship("FollowUp", back_populates="patient")
    alerts = relationship("Alert", back_populates="patient")
    reports = relationship("PatientReport", back_populates="patient")


class FollowUp(Base):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    pain_level = Column(Integer, nullable=False, default=0)  # 0-10 scale
    fever = Column(Boolean, nullable=False, default=False)
    medicine_taken = Column(Boolean, nullable=False, default=False)
    input_source = Column(String, nullable=False, server_default="text")
    transcript = Column(String, nullable=True)
    normalized_message = Column(String, nullable=True)
    language_hint = Column(String, nullable=True)
    audio_filename = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    patient = relationship("Patient")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    risk_level = Column(String, nullable=False, index=True)
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    patient = relationship("Patient")
    
    __table_args__ = (
        Index('idx_alert_patient_risk', 'patient_id', 'risk_level'),
        Index('idx_alert_created_risk', 'created_at', 'risk_level'),
    )


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    trigger_type = Column(String, nullable=False, index=True)
    audience = Column(String, nullable=False)
    language = Column(String, nullable=False)
    cadence = Column(String, nullable=False)
    cadence_hours = Column(Integer, nullable=False, server_default="24")
    message_goal = Column(String, nullable=False)
    status = Column(String, nullable=False, server_default="ACTIVE", index=True)
    next_run_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index('idx_workflow_status_next_run', 'status', 'next_run_at'),
        Index('idx_workflow_trigger_audience', 'trigger_type', 'audience'),
    )


class WorkflowAssignment(Base):
    __tablename__ = "workflow_assignments"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    status = Column(String, nullable=False, server_default="ACTIVE", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    workflow = relationship("Workflow")
    patient = relationship("Patient")
    
    __table_args__ = (
        Index('idx_assignment_workflow_patient', 'workflow_id', 'patient_id'),
        Index('idx_assignment_status', 'status'),
    )


class FollowupCall(Base):
    __tablename__ = "followup_calls"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    linked_followup_id = Column(Integer, ForeignKey("followups.id"), nullable=True)
    linked_report_id = Column(Integer, ForeignKey("patient_reports.id"), nullable=True)
    status = Column(String, nullable=False, server_default="PREPARED", index=True)
    script_language = Column(String, nullable=False, server_default="English")
    tts_voice = Column(String, nullable=False, server_default="alloy")
    script_text = Column(String, nullable=False)
    tts_audio_base64 = Column(String, nullable=True)
    transcript = Column(String, nullable=True)
    normalized_message = Column(String, nullable=True)
    call_summary = Column(String, nullable=True)
    scheduled_for = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    workflow = relationship("Workflow")
    patient = relationship("Patient")
    linked_followup = relationship("FollowUp")
    linked_report = relationship("PatientReport")
    
    __table_args__ = (
        Index('idx_call_patient_status', 'patient_id', 'status'),
        Index('idx_call_scheduled_status', 'scheduled_for', 'status'),
        Index('idx_call_workflow_patient', 'workflow_id', 'patient_id'),
    )


class PatientReport(Base):
    __tablename__ = "patient_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    trigger_followup_id = Column(Integer, ForeignKey("followups.id"), nullable=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    status = Column(String, nullable=False, server_default="DRAFT", index=True)
    recipient = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    patient = relationship("Patient")
    trigger_followup = relationship("FollowUp")
    
    __table_args__ = (
        Index('idx_report_patient_status', 'patient_id', 'status'),
        Index('idx_report_created_status', 'created_at', 'status'),
    )
