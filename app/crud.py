from datetime import datetime, timezone

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session
from . import models
from .workflow_schedule import parse_cadence_hours, utc_now


def create_patient(db: Session, patient):
    # Auto-format phone number if missing country code
    phone = patient.phone.strip() if patient.phone else ""
    
    # Add +91 for Indian numbers if no country code
    if phone and not phone.startswith('+'):
        # If 10 digits, assume India
        if len(phone) == 10 and phone.isdigit():
            phone = "+91" + phone
        # If starts with 0, replace with +91
        elif phone.startswith('0') and len(phone) == 11:
            phone = "+91" + phone[1:]
        else:
            phone = "+" + phone
    
    # Fix common language spelling mistakes
    language = patient.language.strip() if patient.language else "English"
    language_corrections = {
        "gujrati": "Gujarati",
        "gujarati": "Gujarati",
        "hindi": "Hindi",
        "bengali": "Bengali",
        "bangla": "Bengali",
        "telugu": "Telugu",
        "tamil": "Tamil",
        "marathi": "Marathi",
        "odia": "Odia",
        "oriya": "Odia",
        "kannada": "Kannada",
        "malayalam": "Malayalam",
        "punjabi": "Punjabi",
        "urdu": "Urdu",
        "english": "English",
    }
    
    # Convert to lowercase for matching, then get corrected version
    language_lower = language.lower()
    if language_lower in language_corrections:
        language = language_corrections[language_lower]
    
    # Only use basic fields that exist in current database schema
    existing_patient = db.query(models.Patient).filter(models.Patient.phone == phone).first()
    if existing_patient:
        raise ValueError(f"Phone number {phone} already exists")

    db_patient = models.Patient(
        name=patient.name.strip(),
        phone=phone,
        language=language
    )

    try:
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient
    except Exception as e:
        db.rollback()
        # Check for duplicate phone error
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise ValueError(f"Phone number {phone} already exists")
        raise e


def create_followup(db: Session, followup):
    db_followup = models.FollowUp(
        patient_id=followup.patient_id,
        pain_level=followup.pain_level,
        fever=followup.fever,
        medicine_taken=followup.medicine_taken,
        input_source=followup.input_source,
        transcript=followup.transcript,
        normalized_message=followup.normalized_message,
        language_hint=followup.language_hint,
        audio_filename=followup.audio_filename
    )

    db.add(db_followup)
    db.commit()
    db.refresh(db_followup)

    return db_followup

def get_patients(db: Session):
    return db.query(models.Patient).order_by(asc(models.Patient.id)).all()

def get_patient(db: Session, patient_id: int):
    return db.query(models.Patient).filter(models.Patient.id == patient_id).first()

def get_followups(db: Session):
    return db.query(models.FollowUp).order_by(
        asc(models.FollowUp.patient_id),
        desc(models.FollowUp.created_at),
        desc(models.FollowUp.id)
    ).all()

def get_patient_followups(db: Session, patient_id: int):
    return db.query(models.FollowUp).filter(
        models.FollowUp.patient_id == patient_id
    ).order_by(desc(models.FollowUp.created_at), desc(models.FollowUp.id)).all()

def get_patient_alerts(db: Session, patient_id: int):
    return db.query(models.Alert).filter(
        models.Alert.patient_id == patient_id
    ).order_by(desc(models.Alert.created_at), desc(models.Alert.id)).all()

def create_alert(db: Session, alert):

    db_alert = models.Alert(
        patient_id=alert.patient_id,
        risk_level=alert.risk_level,
        reason=alert.reason
    )

    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)

    return db_alert


def create_workflow(db: Session, workflow):
    cadence_hours = parse_cadence_hours(workflow.cadence)
    db_workflow = models.Workflow(
        name=workflow.name,
        trigger_type=workflow.trigger_type,
        audience=workflow.audience,
        language=workflow.language,
        cadence=workflow.cadence,
        cadence_hours=cadence_hours,
        message_goal=workflow.message_goal,
        status=workflow.status,
        next_run_at=utc_now()
    )

    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)

    return db_workflow


def get_workflows(db: Session):
    return db.query(models.Workflow).order_by(desc(models.Workflow.created_at), desc(models.Workflow.id)).all()


def get_workflow(db: Session, workflow_id: int):
    return db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()


def get_due_workflows(db: Session, reference_time: datetime | None = None):
    due_time = reference_time or utc_now()
    return db.query(models.Workflow).filter(
        models.Workflow.status == "ACTIVE",
        models.Workflow.next_run_at <= due_time
    ).order_by(asc(models.Workflow.next_run_at), desc(models.Workflow.id)).all()


def get_workflow_assignments(db: Session, workflow_id: int | None = None):
    query = db.query(models.WorkflowAssignment)
    if workflow_id is not None:
        query = query.filter(models.WorkflowAssignment.workflow_id == workflow_id)

    return query.order_by(
        desc(models.WorkflowAssignment.created_at),
        desc(models.WorkflowAssignment.id)
    ).all()


def get_workflow_assignment(db: Session, assignment_id: int):
    return db.query(models.WorkflowAssignment).filter(
        models.WorkflowAssignment.id == assignment_id
    ).first()


def create_workflow_assignments(db: Session, workflow_id: int, patient_ids: list[int]):
    created_assignments = []
    existing_patient_ids = {
        assignment.patient_id
        for assignment in db.query(models.WorkflowAssignment).filter(
            models.WorkflowAssignment.workflow_id == workflow_id,
            models.WorkflowAssignment.status == "ACTIVE"
        ).all()
    }

    for patient_id in patient_ids:
        if patient_id in existing_patient_ids:
            continue

        assignment = models.WorkflowAssignment(
            workflow_id=workflow_id,
            patient_id=patient_id,
            status="ACTIVE"
        )
        db.add(assignment)
        created_assignments.append(assignment)

    db.commit()
    for assignment in created_assignments:
        db.refresh(assignment)

    return created_assignments


def delete_workflow_assignment(db: Session, assignment_id: int):
    assignment = get_workflow_assignment(db, assignment_id)
    if not assignment:
        return None

    db.delete(assignment)
    db.commit()
    return assignment


def get_active_assignments(db: Session):
    return db.query(models.WorkflowAssignment).filter(
        models.WorkflowAssignment.status == "ACTIVE"
    ).order_by(desc(models.WorkflowAssignment.created_at), desc(models.WorkflowAssignment.id)).all()


def get_active_workflow_assignments(db: Session, workflow_id: int):
    return db.query(models.WorkflowAssignment).filter(
        models.WorkflowAssignment.workflow_id == workflow_id,
        models.WorkflowAssignment.status == "ACTIVE"
    ).order_by(desc(models.WorkflowAssignment.created_at), desc(models.WorkflowAssignment.id)).all()


def get_alerts(db: Session):
    return db.query(models.Alert).order_by(desc(models.Alert.created_at), desc(models.Alert.id)).all()


def create_followup_call(db: Session, call):
    db_call = models.FollowupCall(
        workflow_id=call.workflow_id,
        patient_id=call.patient_id,
        linked_followup_id=call.linked_followup_id,
        linked_report_id=call.linked_report_id,
        status=call.status,
        script_language=call.script_language,
        tts_voice=call.tts_voice,
        script_text=call.script_text,
        tts_audio_base64=call.tts_audio_base64,
        transcript=call.transcript,
        normalized_message=call.normalized_message,
        call_summary=call.call_summary,
        scheduled_for=call.scheduled_for or utc_now()
    )

    db.add(db_call)
    db.commit()
    db.refresh(db_call)

    return db_call


def get_followup_call(db: Session, call_id: int):
    return db.query(models.FollowupCall).filter(models.FollowupCall.id == call_id).first()


def get_followup_calls(db: Session):
    return db.query(models.FollowupCall).order_by(
        desc(models.FollowupCall.created_at),
        desc(models.FollowupCall.id)
    ).all()


def get_workflow_followup_calls(db: Session, workflow_id: int):
    return db.query(models.FollowupCall).filter(
        models.FollowupCall.workflow_id == workflow_id
    ).order_by(desc(models.FollowupCall.created_at), desc(models.FollowupCall.id)).all()


def delete_pending_followup_calls(db: Session, workflow_id: int, patient_id: int):
    calls = db.query(models.FollowupCall).filter(
        models.FollowupCall.workflow_id == workflow_id,
        models.FollowupCall.patient_id == patient_id,
        models.FollowupCall.status.in_(["PREPARED", "IN_PROGRESS"])
    ).all()

    deleted_count = len(calls)
    for call in calls:
        db.delete(call)

    if deleted_count:
        db.commit()

    return deleted_count


def delete_followup_call(db: Session, call_id: int):
    call = get_followup_call(db, call_id)
    if not call:
        return False

    db.delete(call)
    db.commit()
    return True


def get_open_followup_call(db: Session, workflow_id: int, patient_id: int):
    return db.query(models.FollowupCall).filter(
        models.FollowupCall.workflow_id == workflow_id,
        models.FollowupCall.patient_id == patient_id,
        models.FollowupCall.status.in_(["PREPARED", "IN_PROGRESS"])
    ).order_by(desc(models.FollowupCall.created_at), desc(models.FollowupCall.id)).first()


def count_pending_calls_for_workflow(db: Session, workflow_id: int):
    return db.query(models.FollowupCall).filter(
        models.FollowupCall.workflow_id == workflow_id,
        models.FollowupCall.status.in_(["PREPARED", "IN_PROGRESS"])
    ).count()


def count_completed_calls_for_workflow(db: Session, workflow_id: int):
    return db.query(models.FollowupCall).filter(
        models.FollowupCall.workflow_id == workflow_id,
        models.FollowupCall.status == "COMPLETED"
    ).count()


def update_workflow_schedule(
    db: Session,
    workflow_id: int,
    *,
    next_run_at: datetime | None = None,
    last_run_at: datetime | None = None,
    cadence_hours: int | None = None,
):
    workflow = get_workflow(db, workflow_id)
    if not workflow:
        return None

    if next_run_at is not None:
        workflow.next_run_at = next_run_at
    if last_run_at is not None:
        workflow.last_run_at = last_run_at
    if cadence_hours is not None:
        workflow.cadence_hours = cadence_hours

    db.commit()
    db.refresh(workflow)
    return workflow


def complete_followup_call(
    db: Session,
    call_id: int,
    transcript: str,
    normalized_message: str,
    linked_followup_id: int | None,
    linked_report_id: int | None,
    call_summary: str | None
):
    call = get_followup_call(db, call_id)
    if not call:
        return None

    call.status = "COMPLETED"
    call.transcript = transcript
    call.normalized_message = normalized_message
    call.linked_followup_id = linked_followup_id
    call.linked_report_id = linked_report_id
    call.call_summary = call_summary
    call.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(call)

    return call


def create_patient_report(db: Session, report):
    db_report = models.PatientReport(
        patient_id=report.patient_id,
        trigger_followup_id=report.trigger_followup_id,
        title=report.title,
        content=report.content,
        status=report.status,
        recipient=report.recipient
    )

    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return db_report


def get_patient_reports(db: Session, patient_id: int):
    return db.query(models.PatientReport).filter(
        models.PatientReport.patient_id == patient_id
    ).order_by(desc(models.PatientReport.created_at), desc(models.PatientReport.id)).all()


def get_report(db: Session, report_id: int):
    return db.query(models.PatientReport).filter(models.PatientReport.id == report_id).first()


def get_reports(db: Session):
    return db.query(models.PatientReport).order_by(
        desc(models.PatientReport.sent_at),
        desc(models.PatientReport.created_at),
        desc(models.PatientReport.id)
    ).all()


def send_report(db: Session, report_id: int, recipient: str):
    report = get_report(db, report_id)
    if not report:
        return None

    report.status = "SENT"
    report.recipient = recipient
    report.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)

    return report


def update_report_status(db: Session, report_id: int, status: str):
    report = get_report(db, report_id)
    if not report:
        return None

    report.status = status
    db.commit()
    db.refresh(report)

    return report
