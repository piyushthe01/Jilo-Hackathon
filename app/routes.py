from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import SessionLocal
from . import schemas, crud, models
from .ai_agent import extract_health_data
from .risk_engine import detect_risk
from .disease_matcher import match_condition, rank_conditions
from .book_rag import retrieve_references
from .clinical_explainer import build_grounded_note
from .openai_audio import (
    normalize_audio_language_hint,
    normalize_followup_transcript,
    transcribe_patient_audio,
)
from .openai_followup_automation import (
    CALLER_NAME,
    DEFAULT_TTS_VOICE,
    HOSPITAL_NAME,
    apply_caller_identity,
    generate_followup_call_script,
    generate_followup_call_reply,
    summarize_followup_call_result,
    synthesize_followup_call_audio,
)
from .workflow_schedule import (
    next_run_from,
    resolved_cadence_hours,
    utc_now,
    workflow_is_due,
    workflow_schedule_status,
)
from .notifications import send_email_alert, send_whatsapp_alert

router = APIRouter()

PAIN_SIGNAL_TERMS = (
    "pain",
    "chest pain",
    "stomach pain",
    "abdominal pain",
    "headache",
    "body pain",
)


def followup_mentions_pain(followup):
    if getattr(followup, "pain_level", 0) and followup.pain_level > 0:
        return True

    source_text = " ".join(
        filter(
            None,
            [
                getattr(followup, "normalized_message", None),
                getattr(followup, "transcript", None),
            ]
        )
    ).lower()
    return any(term in source_text for term in PAIN_SIGNAL_TERMS)


def format_pain_status(followup):
    if getattr(followup, "pain_level", 0) and followup.pain_level > 0:
        return f"a pain level of {followup.pain_level}"
    if followup_mentions_pain(followup):
        return "pain symptoms, but no numeric pain score was provided"
    return "no pain symptoms"


def format_average_pain_summary(followups):
    scored_followups = [item.pain_level for item in followups if getattr(item, "pain_level", 0) > 0]
    if not scored_followups:
        return "No numeric pain trend is available because the patient did not provide a pain score."

    average_pain = round(sum(scored_followups) / len(scored_followups), 1)
    return f"Average recorded pain score is {average_pain}."


def build_patient_history_summary(patient, followups, alerts):
    if not followups:
        return (
            f"{patient.name} has no followups recorded yet. Once AI followups are completed, "
            "this panel will summarize symptom trends, medicine adherence, and escalations."
        )

    total_followups = len(followups)
    fever_count = sum(1 for item in followups if item.fever)
    medicine_taken_count = sum(1 for item in followups if item.medicine_taken)
    adherence_rate = round((medicine_taken_count / total_followups) * 100)
    latest_followup = followups[0]
    voice_followups = [item for item in followups if item.input_source == "audio"]
    latest_voice_followup = voice_followups[0] if voice_followups else None

    latest_summary = (
        f"The latest followup was #{latest_followup.id}, with {format_pain_status(latest_followup)}, "
        f"{'fever reported' if latest_followup.fever else 'no fever reported'}, and "
        f"{'medicine taken' if latest_followup.medicine_taken else 'medicine not taken'}."
    )
    voice_summary = (
        f" {len(voice_followups)} voice interactions have been logged so far."
        if voice_followups
        else " No voice interactions have been logged so far."
    )
    if latest_voice_followup and latest_voice_followup.transcript:
        voice_summary += f" The latest voice note was captured in {latest_voice_followup.language_hint or patient.language or 'the selected language'}."

    alert_summary = (
        f" There have been {len(alerts)} alerts so far."
        if alerts
        else " No alerts have been raised so far."
    )

    return (
        f"{patient.name} has completed {total_followups} followups. "
        f"{format_average_pain_summary(followups)} Fever was reported in {fever_count} followups, "
        f"and medicine adherence is {adherence_rate}%. "
        f"{latest_summary}{voice_summary}{alert_summary}"
    )


def build_doctor_summary(patient, followups, alerts):
    if not followups:
        return {
            "headline": f"{patient.name} has no followup history yet.",
            "summary": (
                f"Patient #{patient.id} prefers {patient.language}. No symptom followups have been logged yet, "
                "so there is no trend data available."
            ),
            "next_steps": [
                "Schedule the first followup outreach.",
                "Collect baseline symptom status and medicine adherence.",
                "Monitor for escalation after the initial check-in."
            ]
        }

    latest_followup = followups[0]
    alert_count = len(alerts)
    fever_count = sum(1 for item in followups if item.fever)
    medicine_taken_count = sum(1 for item in followups if item.medicine_taken)
    adherence_rate = round((medicine_taken_count / len(followups)) * 100)
    voice_followup_count = sum(1 for item in followups if item.input_source == "audio")

    next_steps = []
    if latest_followup.pain_level >= 7:
        next_steps.append("Prioritize clinician review because recent pain levels are high.")
    if latest_followup.fever:
        next_steps.append("Check for persistent infectious symptoms and reassess within 24 hours.")
    if not latest_followup.medicine_taken:
        next_steps.append("Confirm the reason for missed medication and reinforce adherence.")
    if alert_count:
        next_steps.append("Review prior alerts before the next patient interaction.")
    if not next_steps:
        next_steps.append("Continue routine followup and monitor for symptom change.")

    return {
        "headline": f"{patient.name}: {len(followups)} followups recorded, {alert_count} alerts raised.",
        "summary": (
            f"Patient #{patient.id} prefers {patient.language}. {format_average_pain_summary(followups)} "
            f"Fever was reported {fever_count} times and medicine adherence is {adherence_rate}%. "
            f"{voice_followup_count} followups came in through voice interactions. "
            f"The latest followup recorded {format_pain_status(latest_followup)}, "
            f"{'fever present' if latest_followup.fever else 'no fever'}, and "
            f"{'medicine taken' if latest_followup.medicine_taken else 'medicine not taken'}."
        ),
        "next_steps": next_steps
    }


def build_patient_report_payload(patient, followups, alerts, trigger_followup_id=None, risk_level=None, probable_condition=None):
    doctor_summary = build_doctor_summary(patient, followups, alerts)
    latest_followup = followups[0] if followups else None
    report_title = (
        f"Patient Update Report - {patient.name}"
        if not latest_followup
        else f"Patient Update Report - Followup #{latest_followup.id}"
    )

    context_lines = []
    if risk_level:
        context_lines.append(f"Risk level: {risk_level}")
    if probable_condition:
        context_lines.append(f"Probable condition: {probable_condition}")
    if latest_followup:
        context_lines.append(
            f"Latest followup recorded {format_pain_status(latest_followup)}, "
            f"{'fever present' if latest_followup.fever else 'no fever'}, and "
            f"{'medicine taken' if latest_followup.medicine_taken else 'medicine not taken'}."
        )

    content = "\n".join(
        [
            doctor_summary["headline"],
            doctor_summary["summary"],
            *(context_lines or []),
            "Recommended next steps:",
            *[f"{index + 1}. {step}" for index, step in enumerate(doctor_summary["next_steps"])]
        ]
    )

    return schemas.PatientReportCreate(
        patient_id=patient.id,
        trigger_followup_id=trigger_followup_id,
        title=report_title,
        content=content
    )


def serialize_report(db, report):
    patient = crud.get_patient(db, report.patient_id)
    latest_alerts = crud.get_patient_alerts(db, report.patient_id)
    latest_followups = crud.get_patient_followups(db, report.patient_id)
    latest_alert = latest_alerts[0] if latest_alerts else None
    latest_followup = latest_followups[0] if latest_followups else None

    return {
        "id": report.id,
        "patient_id": report.patient_id,
        "patient_name": patient.name if patient else None,
        "patient_language": patient.language if patient else None,
        "title": report.title,
        "content": report.content,
        "status": report.status,
        "recipient": report.recipient,
        "sent_at": report.sent_at,
        "created_at": report.created_at,
        "trigger_followup_id": report.trigger_followup_id,
        "latest_risk_level": latest_alert.risk_level if latest_alert else "NONE",
        "latest_alert_reason": latest_alert.reason if latest_alert else None,
        "latest_followup_id": latest_followup.id if latest_followup else None
    }


def serialize_followup(followup):
    return {
        "id": followup.id,
        "patient_id": followup.patient_id,
        "pain_level": followup.pain_level,
        "fever": followup.fever,
        "medicine_taken": followup.medicine_taken,
        "input_source": followup.input_source,
        "transcript": followup.transcript,
        "normalized_message": followup.normalized_message,
        "language_hint": followup.language_hint,
        "audio_filename": followup.audio_filename,
        "created_at": followup.created_at,
    }


def serialize_workflow_assignment(db, assignment):
    workflow = crud.get_workflow(db, assignment.workflow_id)
    patient = crud.get_patient(db, assignment.patient_id)

    return {
        "id": assignment.id,
        "workflow_id": assignment.workflow_id,
        "workflow_name": workflow.name if workflow else None,
        "patient_id": assignment.patient_id,
        "patient_name": patient.name if patient else None,
        "patient_language": patient.language if patient else None,
        "status": assignment.status,
        "created_at": assignment.created_at,
    }


def serialize_followup_call(db, call):
    workflow = crud.get_workflow(db, call.workflow_id)
    patient = crud.get_patient(db, call.patient_id)

    return {
        "id": call.id,
        "workflow_id": call.workflow_id,
        "workflow_name": workflow.name if workflow else None,
        "workflow_language": workflow.language if workflow else None,
        "patient_id": call.patient_id,
        "patient_name": patient.name if patient else None,
        "patient_language": patient.language if patient else None,
        "status": call.status,
        "script_language": call.script_language,
        "tts_voice": call.tts_voice,
        "caller_name": CALLER_NAME,
        "hospital_name": HOSPITAL_NAME,
        "script_text": call.script_text,
        "tts_audio_base64": call.tts_audio_base64,
        "transcript": call.transcript,
        "normalized_message": call.normalized_message,
        "call_summary": call.call_summary,
        "linked_followup_id": call.linked_followup_id,
        "linked_report_id": call.linked_report_id,
        "scheduled_for": call.scheduled_for,
        "completed_at": call.completed_at,
        "created_at": call.created_at,
    }


VALID_TTS_VOICES = {
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
}


def followup_call_is_legacy(call):
    raw_script = (call.script_text or "").strip()
    enriched_script = apply_caller_identity(raw_script, getattr(call, "script_language", None)).strip()
    script_word_count = len(raw_script.split())
    return (
        not raw_script
        or (call.tts_voice or "") not in VALID_TTS_VOICES
        or len(call.tts_audio_base64 or "") < 100
        or script_word_count > 45
        or not enriched_script
        or "[" in (call.script_text or "")
    )


def languages_match(workflow_language: str | None, patient_language: str | None):
    normalized_workflow_language = normalize_audio_language_hint(workflow_language)
    normalized_patient_language = normalize_audio_language_hint(patient_language)

    if not normalized_workflow_language or not normalized_patient_language:
        return True

    return normalized_workflow_language == normalized_patient_language


def serialize_workflow(db, workflow, now=None):
    reference_time = now or utc_now()
    assignments = crud.get_active_workflow_assignments(db, workflow.id)
    pending_call_count = crud.count_pending_calls_for_workflow(db, workflow.id)
    completed_call_count = crud.count_completed_calls_for_workflow(db, workflow.id)
    cadence_hours = resolved_cadence_hours(workflow)
    due_patient_count = len(
        [
            assignment for assignment in assignments
            if languages_match(workflow.language, assignment.patient.language if assignment.patient else None)
        ]
    )

    return {
        "id": workflow.id,
        "name": workflow.name,
        "trigger_type": workflow.trigger_type,
        "audience": workflow.audience,
        "language": workflow.language,
        "cadence": workflow.cadence,
        "cadence_hours": cadence_hours,
        "message_goal": workflow.message_goal,
        "status": workflow.status,
        "created_at": workflow.created_at,
        "next_run_at": workflow.next_run_at,
        "last_run_at": workflow.last_run_at,
        "assignment_count": len(assignments),
        "pending_call_count": pending_call_count,
        "completed_call_count": completed_call_count,
        "due_patient_count": due_patient_count,
        "is_due": workflow_is_due(workflow, now=reference_time),
        "schedule_status": workflow_schedule_status(workflow, len(assignments), now=reference_time),
    }


def run_workflow_automation_batch(
    db: Session,
    *,
    workflow_id: int | None = None,
    due_only: bool = False,
    advance_schedule: bool = False,
):
    reference_time = utc_now()
    workflows = crud.get_workflows(db)
    if workflow_id is not None:
        workflows = [workflow for workflow in workflows if workflow.id == workflow_id]
    workflows = [workflow for workflow in workflows if workflow.status == "ACTIVE"]

    created_calls = []
    workflow_results = []

    for workflow in workflows:
        assignments = crud.get_active_workflow_assignments(db, workflow.id)
        if due_only and not workflow_is_due(workflow, now=reference_time):
            continue

        workflow_created = []
        workflow_existing = 0
        workflow_skipped = []

        if not assignments:
            workflow_results.append(
                {
                    "workflow_id": workflow.id,
                    "workflow_name": workflow.name,
                    "created_count": 0,
                    "existing_count": 0,
                    "skipped_patients": [],
                    "advanced_schedule": False,
                    "reason": "No assigned patients",
                }
            )
            continue

        for assignment in assignments:
            patient = crud.get_patient(db, assignment.patient_id)
            if not patient:
                workflow_skipped.append(
                    {"patient_id": assignment.patient_id, "reason": "Patient not found"}
                )
                continue

            if not languages_match(workflow.language, patient.language):
                crud.delete_pending_followup_calls(db, workflow_id=workflow.id, patient_id=patient.id)
                workflow_skipped.append(
                    {"patient_id": patient.id, "patient_name": patient.name, "reason": "Language mismatch"}
                )
                continue

            open_call = crud.get_open_followup_call(db, workflow.id, patient.id)
            if open_call and followup_call_is_legacy(open_call):
                crud.delete_followup_call(db, open_call.id)
                open_call = None
            if open_call:
                workflow_existing += 1
                continue

            try:
                script_text = generate_followup_call_script(patient, workflow)
                tts_audio_base64 = synthesize_followup_call_audio(
                    script_text,
                    voice=DEFAULT_TTS_VOICE,
                    language_label=patient.language or workflow.language,
                )
            except Exception as exc:
                workflow_skipped.append(
                    {
                        "patient_id": patient.id,
                        "patient_name": patient.name,
                        "reason": f"Automation failed: {exc}",
                    }
                )
                continue

            scheduled_for = workflow.next_run_at if due_only else reference_time
            call_payload = schemas.FollowupCallCreate(
                workflow_id=workflow.id,
                patient_id=patient.id,
                status="PREPARED",
                script_language=patient.language or workflow.language or "English",
                tts_voice=DEFAULT_TTS_VOICE,
                script_text=script_text,
                tts_audio_base64=tts_audio_base64,
                scheduled_for=scheduled_for,
            )
            created_call = serialize_followup_call(db, crud.create_followup_call(db, call_payload))
            workflow_created.append(created_call)
            created_calls.append(created_call)

        should_advance_schedule = advance_schedule and (workflow_created or workflow_existing)
        if should_advance_schedule:
            cadence_hours = resolved_cadence_hours(workflow)
            updated_workflow = crud.update_workflow_schedule(
                db,
                workflow.id,
                cadence_hours=cadence_hours,
                last_run_at=reference_time,
                next_run_at=next_run_from(reference_time, cadence_hours),
            )
            workflow = updated_workflow or workflow

        workflow_results.append(
            {
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "created_count": len(workflow_created),
                "existing_count": workflow_existing,
                "skipped_patients": workflow_skipped,
                "advanced_schedule": should_advance_schedule,
                "next_run_at": workflow.next_run_at,
                "last_run_at": workflow.last_run_at,
            }
        )

    return {
        "created_calls": created_calls,
        "count": len(created_calls),
        "workflow_results": workflow_results,
    }


def assign_dynamic_followup_workflow(db: Session, patient, risk_level: str):
    cadence_map = {
        "HIGH": ("Critical Surveillance (24h)", "24 hours", "Daily check-in for high risk"),
        "MEDIUM": ("Standard Recovery (3 Days)", "3 days", "Routine recovery tracking"),
        "LOW": ("Mild Conditions (7 Days)", "7 days", "Weekly mild symptom check"),
    }
    name, cadence, goal = cadence_map.get(risk_level, ("Routine Wellness (30 Days)", "4 weeks", "Monthly wellness checkup"))

    workflow = db.query(models.Workflow).filter(models.Workflow.name == name).first()
    if not workflow:
        workflow_data = schemas.WorkflowCreate(
            name=name,
            trigger_type="SCHEDULED",
            audience="ALL_PATIENTS",
            language="English",
            cadence=cadence,
            message_goal=goal,
            status="ACTIVE"
        )
        workflow = crud.create_workflow(db, workflow_data)

    existing_assignments = db.query(models.WorkflowAssignment).filter(
        models.WorkflowAssignment.patient_id == patient.id,
        models.WorkflowAssignment.status == "ACTIVE"
    ).all()

    already_assigned = False
    for a in existing_assignments:
        if a.workflow_id != workflow.id:
            crud.delete_workflow_assignment(db, a.id)
        else:
            already_assigned = True

    if not already_assigned:
        crud.create_workflow_assignments(db, workflow.id, [patient.id])


def analyze_followup_message(
    db: Session,
    patient_id: int,
    message: str,
    input_source: str = "text",
    transcript: str | None = None,
    language_hint: str | None = None,
    audio_filename: str | None = None,
):
    patient = crud.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    data = extract_health_data(message)
    ranked_matches = rank_conditions(data, top_k=3)
    condition_match = ranked_matches[0] if ranked_matches else match_condition(data)

    top_matches = []
    for match in ranked_matches:
        references = retrieve_references(
            probable_condition=match["condition"],
            symptoms=data["symptoms_detected"],
            top_k=3
        )
        top_matches.append(
            {
                **match,
                "note": build_grounded_note(match, data),
                "reference_pages": [reference["page"] for reference in references]
            }
        )

    risk = detect_risk(data, condition_match)
    assign_dynamic_followup_workflow(db, patient, risk)

    if risk in {"HIGH", "MEDIUM"}:
        probable_condition = condition_match["condition"] or "Unspecified symptom cluster"
        matched_symptoms = condition_match["matched_symptoms"]
        symptom_text = ", ".join(sym.replace("_", " ") for sym in matched_symptoms) or "pain/fever indicators"
        alert = schemas.AlertCreate(
            patient_id=patient_id,
            risk_level=risk,
            reason=f"{probable_condition}: {condition_match['alert_reason']} (matched: {symptom_text})"
        )

        crud.create_alert(db, alert)
        
        # Trigger external notifications
        subject = f"URGENT: {risk} Risk Alert for {patient.name}"
        body = f"Patient {patient.name} (Phone: {patient.phone}) has triggered a {risk} risk alert.\n\nReason: {alert.reason}\n\nPlease review immediately."
        send_email_alert("medical_team@hospital.local", subject, body)
        
        patient_msg = f"This is an automated alert from your Medical Assistant. We have detected a {risk} risk indicator based on your recent check-in. Please be advised that a doctor will review your case shortly."
        send_whatsapp_alert(patient.phone, patient_msg)

    followup = schemas.FollowUpCreate(
        patient_id=patient_id,
        pain_level=data["pain_level"],
        fever=data["fever"],
        medicine_taken=data["medicine_taken"],
        input_source=input_source,
        transcript=transcript,
        normalized_message=message,
        language_hint=language_hint,
        audio_filename=audio_filename
    )

    result = crud.create_followup(db, followup)
    updated_followups = crud.get_patient_followups(db, patient_id)
    updated_alerts = crud.get_patient_alerts(db, patient_id)
    report_payload = build_patient_report_payload(
        patient,
        updated_followups,
        updated_alerts,
        trigger_followup_id=result.id,
        risk_level=risk,
        probable_condition=condition_match["condition"]
    )
    report = crud.create_patient_report(db, report_payload)
    
    # Send report notification
    report_subject = f"New Patient Report Generated for {patient.name}"
    send_email_alert("medical_team@hospital.local", report_subject, report.content)

    return {
        "followup": serialize_followup(result),
        "risk_level": risk,
        "probable_condition": condition_match["condition"],
        "condition_confidence": condition_match["confidence"],
        "matched_symptoms": condition_match["matched_symptoms"],
        "precautions": condition_match["precautions"],
        "symptoms_detected": data["symptoms_detected"],
        "top_matches": top_matches,
        "report": serialize_report(db, report),
        "normalized_message": message,
        "transcript": transcript,
        "input_source": input_source,
        "language_hint": language_hint
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/patients")
def add_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    try:
        result = crud.create_patient(db, patient)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        error_detail = f"Failed to create patient: {str(e)}"
        print(f"ERROR: {error_detail}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/followup")
def add_followup(followup: schemas.FollowUpCreate, db: Session = Depends(get_db)):
    return crud.create_followup(db, followup)

@router.get("/patients")
def read_patients(db: Session = Depends(get_db)):
    return crud.get_patients(db)


@router.get("/patients/{patient_id}/history")
def read_patient_history(patient_id: int, db: Session = Depends(get_db)):
    patient = crud.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    followups = crud.get_patient_followups(db, patient_id)
    alerts = crud.get_patient_alerts(db, patient_id)
    reports = crud.get_patient_reports(db, patient_id)

    return {
        "patient": patient,
        "followups": followups,
        "alerts": alerts,
        "reports": reports,
        "summary": build_patient_history_summary(patient, followups, alerts)
    }


@router.get("/patients/{patient_id}/doctor-summary")
def read_doctor_summary(patient_id: int, db: Session = Depends(get_db)):
    patient = crud.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    followups = crud.get_patient_followups(db, patient_id)
    alerts = crud.get_patient_alerts(db, patient_id)

    return build_doctor_summary(patient, followups, alerts)


@router.post("/patients/{patient_id}/reports/generate")
def generate_patient_report(patient_id: int, db: Session = Depends(get_db)):
    patient = crud.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    followups = crud.get_patient_followups(db, patient_id)
    alerts = crud.get_patient_alerts(db, patient_id)
    latest_followup = followups[0] if followups else None
    report_payload = build_patient_report_payload(
        patient,
        followups,
        alerts,
        trigger_followup_id=latest_followup.id if latest_followup else None
    )

    created_report = crud.create_patient_report(db, report_payload)
    
    # Send report notification
    report_subject = f"On-Demand Patient Report for {patient.name}"
    send_email_alert("medical_team@hospital.local", report_subject, created_report.content)
    
    return created_report

@router.get("/followups")
def read_followups(db: Session = Depends(get_db)):
    return crud.get_followups(db)


@router.post("/ai-followup")
def ai_followup(patient_id: int, message: str, db: Session = Depends(get_db)):
    return analyze_followup_message(db, patient_id, message)


@router.post("/ai-followup/audio")
def ai_followup_from_audio(payload: schemas.AudioFollowupRequest, db: Session = Depends(get_db)):
    patient = crud.get_patient(db, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    language_hint = payload.language_hint or None
    if language_hint == "auto":
        language_hint = None

    try:
        transcript = transcribe_patient_audio(
            payload.audio_base64,
            payload.audio_filename,
            language_hint=language_hint
        )
        normalized_message = normalize_followup_transcript(
            transcript,
            language_hint=language_hint or patient.language
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Audio transcription failed.") from exc

    return analyze_followup_message(
        db,
        payload.patient_id,
        normalized_message,
        input_source="audio",
        transcript=transcript,
        language_hint=language_hint or patient.language,
        audio_filename=payload.audio_filename
    )

@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    return crud.get_alerts(db)


@router.post("/workflows")
def add_workflow(workflow: schemas.WorkflowCreate, db: Session = Depends(get_db)):
    return crud.create_workflow(db, workflow)


@router.get("/workflows")
def read_workflows(db: Session = Depends(get_db)):
    workflows = crud.get_workflows(db)
    reference_time = utc_now()
    return [serialize_workflow(db, workflow, now=reference_time) for workflow in workflows]


@router.post("/workflows/{workflow_id}/assign-patients")
def assign_patients_to_workflow(
    workflow_id: int,
    payload: schemas.WorkflowAssignmentCreate,
    db: Session = Depends(get_db)
):
    workflow = crud.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    valid_patient_ids = []
    for patient_id in payload.patient_ids:
        patient = crud.get_patient(db, patient_id)
        if not patient:
            continue

        workflow_language = normalize_audio_language_hint(workflow.language)
        patient_language = normalize_audio_language_hint(patient.language)
        if workflow_language and patient_language and workflow_language != patient_language:
            continue

        valid_patient_ids.append(patient_id)

    assignments = crud.create_workflow_assignments(db, workflow_id, valid_patient_ids)
    return [serialize_workflow_assignment(db, assignment) for assignment in assignments]


@router.get("/workflow-assignments")
def read_workflow_assignments(db: Session = Depends(get_db)):
    assignments = crud.get_workflow_assignments(db)
    return [serialize_workflow_assignment(db, assignment) for assignment in assignments]


@router.delete("/workflow-assignments/{assignment_id}")
def delete_workflow_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = crud.get_workflow_assignment(db, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Workflow assignment not found")

    deleted_pending_calls = crud.delete_pending_followup_calls(
        db,
        workflow_id=assignment.workflow_id,
        patient_id=assignment.patient_id
    )
    crud.delete_workflow_assignment(db, assignment_id)

    return {
        "assignment_id": assignment_id,
        "workflow_id": assignment.workflow_id,
        "patient_id": assignment.patient_id,
        "deleted_pending_calls": deleted_pending_calls
    }


@router.post("/automation/run-active-workflows")
def run_active_workflow_automation(
    payload: schemas.WorkflowAutomationRunRequest,
    db: Session = Depends(get_db)
):
    return run_workflow_automation_batch(
        db,
        workflow_id=payload.workflow_id,
        due_only=False,
        advance_schedule=False,
    )


@router.post("/automation/run-due-workflows")
def run_due_workflows(db: Session = Depends(get_db)):
    return run_workflow_automation_batch(
        db,
        due_only=True,
        advance_schedule=True,
    )


@router.get("/followup-calls")
def read_followup_calls(db: Session = Depends(get_db)):
    active_pairs = {
        (assignment.workflow_id, assignment.patient_id)
        for assignment in crud.get_active_assignments(db)
    }
    for call in crud.get_followup_calls(db):
        workflow = crud.get_workflow(db, call.workflow_id)
        patient = crud.get_patient(db, call.patient_id)
        if (
            call.status in {"PREPARED", "IN_PROGRESS"}
            and (call.workflow_id, call.patient_id) not in active_pairs
        ) or (
            workflow
            and patient
            and call.status in {"PREPARED", "IN_PROGRESS"}
            and not languages_match(workflow.language, patient.language)
        ) or followup_call_is_legacy(call):
            crud.delete_followup_call(db, call.id)

    calls = crud.get_followup_calls(db)
    return [serialize_followup_call(db, call) for call in calls]


@router.post("/followup-calls/{call_id}/complete/audio")
def complete_followup_call_with_audio(
    call_id: int,
    payload: schemas.FollowupCallCompleteAudioRequest,
    db: Session = Depends(get_db)
):
    call = crud.get_followup_call(db, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Followup call not found")
    if call.status == "COMPLETED":
        raise HTTPException(status_code=409, detail="This followup call has already been completed.")

    patient = crud.get_patient(db, call.patient_id)
    workflow = crud.get_workflow(db, call.workflow_id)
    if not patient or not workflow:
        raise HTTPException(status_code=404, detail="Linked patient or workflow not found")

    requested_language_hint = payload.language_hint
    transcription_language_hint = None
    if requested_language_hint and requested_language_hint != "auto":
        transcription_language_hint = requested_language_hint

    analysis_language_hint = (
        requested_language_hint
        if requested_language_hint and requested_language_hint != "auto"
        else patient.language
    )

    try:
        transcript = transcribe_patient_audio(
            payload.audio_base64,
            payload.audio_filename,
            language_hint=transcription_language_hint
        )
        normalized_message = normalize_followup_transcript(
            transcript,
            language_hint=analysis_language_hint
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Audio transcription failed.") from exc

    analysis_result = analyze_followup_message(
        db,
        patient.id,
        normalized_message,
        input_source="audio",
        transcript=transcript,
        language_hint=analysis_language_hint,
        audio_filename=payload.audio_filename
    )

    try:
        call_summary = summarize_followup_call_result(
            patient,
            workflow,
            transcript,
            normalized_message,
            analysis_result
        )
    except Exception:
        call_summary = (
            f"{patient.name} completed the automated followup. "
            f"Risk level: {analysis_result.get('risk_level')}."
        )

    try:
        reply_text = generate_followup_call_reply(
            patient,
            workflow,
            transcript,
            normalized_message,
            analysis_result
        )
        reply_audio_base64 = synthesize_followup_call_audio(
            reply_text,
            voice=DEFAULT_TTS_VOICE,
            language_label=analysis_language_hint
        )
    except Exception:
        reply_text = (
            f"Thank you for sharing this update. Our care team has recorded your response. "
            f"Thank you from {CALLER_NAME} at {HOSPITAL_NAME}."
        )
        reply_audio_base64 = None

    completed_call = crud.complete_followup_call(
        db,
        call_id,
        transcript=transcript,
        normalized_message=normalized_message,
        linked_followup_id=analysis_result["followup"]["id"],
        linked_report_id=analysis_result["report"]["id"],
        call_summary=call_summary
    )
    return {
        "call": serialize_followup_call(db, completed_call),
        "analysis": analysis_result,
        "patient_reply": {
            "text": reply_text,
            "tts_audio_base64": reply_audio_base64
        }
    }


@router.post("/reports/{report_id}/send")
def send_patient_report(report_id: int, payload: schemas.ReportSendRequest, db: Session = Depends(get_db)):
    report = crud.send_report(db, report_id, payload.recipient)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return serialize_report(db, report)


@router.get("/reports/inbox")
def read_report_inbox(db: Session = Depends(get_db)):
    reports = crud.get_reports(db)
    return [serialize_report(db, report) for report in reports]


@router.post("/reports/{report_id}/status")
def update_patient_report_status(report_id: int, payload: schemas.ReportStatusUpdate, db: Session = Depends(get_db)):
    report = crud.update_report_status(db, report_id, payload.status)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return serialize_report(db, report)
