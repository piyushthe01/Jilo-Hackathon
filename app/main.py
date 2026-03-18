from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from .database import Base, engine

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .routes import router

Base.metadata.create_all(bind=engine)


def ensure_schema():
    migrations = [
        (
            "patients",
            "created_at",
            "ALTER TABLE patients ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "followups",
            "created_at",
            "ALTER TABLE followups ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "alerts",
            "created_at",
            "ALTER TABLE alerts ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "followups",
            "input_source",
            "ALTER TABLE followups ADD COLUMN input_source VARCHAR NOT NULL DEFAULT 'text'"
        ),
        (
            "followups",
            "transcript",
            "ALTER TABLE followups ADD COLUMN transcript VARCHAR"
        ),
        (
            "followups",
            "normalized_message",
            "ALTER TABLE followups ADD COLUMN normalized_message VARCHAR"
        ),
        (
            "followups",
            "language_hint",
            "ALTER TABLE followups ADD COLUMN language_hint VARCHAR"
        ),
        (
            "followups",
            "audio_filename",
            "ALTER TABLE followups ADD COLUMN audio_filename VARCHAR"
        ),
        (
            "workflows",
            "created_at",
            "ALTER TABLE workflows ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "workflows",
            "cadence_hours",
            "ALTER TABLE workflows ADD COLUMN cadence_hours INTEGER NOT NULL DEFAULT 24"
        ),
        (
            "workflows",
            "next_run_at",
            "ALTER TABLE workflows ADD COLUMN next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "workflows",
            "last_run_at",
            "ALTER TABLE workflows ADD COLUMN last_run_at TIMESTAMPTZ"
        ),
        (
            "workflow_assignments",
            "status",
            "ALTER TABLE workflow_assignments ADD COLUMN status VARCHAR NOT NULL DEFAULT 'ACTIVE'"
        ),
        (
            "workflow_assignments",
            "created_at",
            "ALTER TABLE workflow_assignments ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "patient_reports",
            "status",
            "ALTER TABLE patient_reports ADD COLUMN status VARCHAR NOT NULL DEFAULT 'DRAFT'"
        ),
        (
            "patient_reports",
            "recipient",
            "ALTER TABLE patient_reports ADD COLUMN recipient VARCHAR"
        ),
        (
            "patient_reports",
            "sent_at",
            "ALTER TABLE patient_reports ADD COLUMN sent_at TIMESTAMPTZ"
        ),
        (
            "patient_reports",
            "created_at",
            "ALTER TABLE patient_reports ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "followup_calls",
            "linked_followup_id",
            "ALTER TABLE followup_calls ADD COLUMN linked_followup_id INTEGER REFERENCES followups(id)"
        ),
        (
            "followup_calls",
            "linked_report_id",
            "ALTER TABLE followup_calls ADD COLUMN linked_report_id INTEGER REFERENCES patient_reports(id)"
        ),
        (
            "followup_calls",
            "status",
            "ALTER TABLE followup_calls ADD COLUMN status VARCHAR NOT NULL DEFAULT 'PREPARED'"
        ),
        (
            "followup_calls",
            "script_language",
            "ALTER TABLE followup_calls ADD COLUMN script_language VARCHAR NOT NULL DEFAULT 'English'"
        ),
        (
            "followup_calls",
            "tts_voice",
            "ALTER TABLE followup_calls ADD COLUMN tts_voice VARCHAR NOT NULL DEFAULT 'shimmer'"
        ),
        (
            "followup_calls",
            "script_text",
            "ALTER TABLE followup_calls ADD COLUMN script_text VARCHAR NOT NULL DEFAULT ''"
        ),
        (
            "followup_calls",
            "tts_audio_base64",
            "ALTER TABLE followup_calls ADD COLUMN tts_audio_base64 VARCHAR"
        ),
        (
            "followup_calls",
            "transcript",
            "ALTER TABLE followup_calls ADD COLUMN transcript VARCHAR"
        ),
        (
            "followup_calls",
            "normalized_message",
            "ALTER TABLE followup_calls ADD COLUMN normalized_message VARCHAR"
        ),
        (
            "followup_calls",
            "call_summary",
            "ALTER TABLE followup_calls ADD COLUMN call_summary VARCHAR"
        ),
        (
            "followup_calls",
            "scheduled_for",
            "ALTER TABLE followup_calls ADD COLUMN scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ),
        (
            "followup_calls",
            "completed_at",
            "ALTER TABLE followup_calls ADD COLUMN completed_at TIMESTAMPTZ"
        ),
        (
            "followup_calls",
            "created_at",
            "ALTER TABLE followup_calls ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        )
    ]

    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, column_name, statement in migrations:
            if table_name not in inspector.get_table_names():
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            if column_name in existing_columns:
                continue

            connection.execute(text(statement))
            inspector = inspect(connection)

        if "followup_calls" in inspector.get_table_names():
            connection.execute(
                text("ALTER TABLE followup_calls ALTER COLUMN tts_voice SET DEFAULT 'nova'")
            )
        if "workflows" in inspector.get_table_names():
            connection.execute(
                text("UPDATE workflows SET cadence_hours = 24 WHERE cadence_hours IS NULL OR cadence_hours < 1")
            )
            connection.execute(
                text("UPDATE workflows SET next_run_at = COALESCE(created_at, NOW()) WHERE next_run_at IS NULL")
            )


ensure_schema()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

_SEED_FOLLOWUPS_PER_PATIENT = [
    # (days_ago, pain_level, fever, medicine_taken, language_hint, normalized_message)
    (
        14, 3, False, True, "English",
        "Patient reports mild discomfort in the lower back. No fever. Medicine taken on time."
    ),
    (
        12, 6, True, False, "English",
        "Moderate pain in the chest area. Fever of 38.4 °C. Missed afternoon dose of medication."
    ),
    (
        10, 4, False, True, "English",
        "Experiencing occasional headache. No fever. All medicines taken as instructed."
    ),
    (
        8, 8, True, False, "English",
        "Severe abdominal pain since last evening. High fever — 39.1 °C. Was unable to take medicine."
    ),
    (
        6, 5, False, True, "English",
        "Body pain is moderate. Fever absent. Patient confirms medicine adherence."
    ),
    (
        4, 2, False, True, "English",
        "Feeling much better. Mild body ache only. No fever. Medicines taken regularly."
    ),
    (
        2, 7, True, True, "English",
        "Chest tightness and high fever (38.9 °C) reported. Medicine taken. Request for earlier review."
    ),
    (
        1, 4, False, True, "English",
        "Moderate stomach pain after meals. No fever. Completed prescribed medicine course."
    ),
]

_SAMPLE_PATIENTS = [
    {"name": "Ananya Banerjee", "phone": "+919110000001", "language": "Bengali"},
    {"name": "Vikram Deshmukh", "phone": "+919110000002", "language": "Marathi"},
    {"name": "Harpreet Kaur", "phone": "+919110000003", "language": "Punjabi"},
    {"name": "Nazia Rahman", "phone": "+919110000004", "language": "Urdu"},
]


def seed_multilingual_patients():
    """Ensure the demo has a few sample patients across multiple Indian languages."""
    from .database import SessionLocal
    from . import models

    db = SessionLocal()
    try:
        existing_phones = {
            (patient.phone or "").strip()
            for patient in db.query(models.Patient).all()
        }

        created_any = False
        for sample in _SAMPLE_PATIENTS:
            if sample["phone"] in existing_phones:
                continue

            db.add(
                models.Patient(
                    name=sample["name"],
                    phone=sample["phone"],
                    language=sample["language"],
                )
            )
            created_any = True

        if created_any:
            db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()


def seed_language_workflows_and_assignments():
    """Create one demo workflow per patient language and attach matching patients."""
    from datetime import datetime, timezone

    from .database import SessionLocal
    from . import models

    db = SessionLocal()
    try:
        patients = db.query(models.Patient).all()
        if not patients:
            return

        workflows_by_language = {}
        for workflow in db.query(models.Workflow).all():
            language = (workflow.language or "").strip().lower()
            if language and language not in workflows_by_language:
                workflows_by_language[language] = workflow

        patient_language_assignment = {}
        assignments = db.query(models.WorkflowAssignment).filter(
            models.WorkflowAssignment.status == "ACTIVE"
        ).all()
        workflow_lookup = {workflow.id: workflow for workflow in db.query(models.Workflow).all()}
        for assignment in assignments:
            workflow = workflow_lookup.get(assignment.workflow_id)
            if not workflow:
                continue
            patient_language_assignment[(assignment.patient_id, (workflow.language or "").strip().lower())] = True

        created_any = False
        for patient in patients:
            language = (patient.language or "").strip()
            normalized_language = language.lower()
            if not normalized_language:
                continue

            workflow = workflows_by_language.get(normalized_language)
            if workflow is None:
                workflow = models.Workflow(
                    name=f"Automated {language} Followup",
                    trigger_type="Post-discharge",
                    audience=f"{language}-speaking patients",
                    language=language,
                    cadence="Daily",
                    cadence_hours=24,
                    message_goal="Check symptoms, medicine adherence, and whether escalation is needed.",
                    status="ACTIVE",
                    next_run_at=datetime.now(timezone.utc),
                )
                db.add(workflow)
                db.flush()
                workflows_by_language[normalized_language] = workflow
                workflow_lookup[workflow.id] = workflow
                created_any = True

            assignment_key = (patient.id, normalized_language)
            if patient_language_assignment.get(assignment_key):
                continue

            db.add(
                models.WorkflowAssignment(
                    workflow_id=workflow.id,
                    patient_id=patient.id,
                    status="ACTIVE",
                )
            )
            patient_language_assignment[assignment_key] = True
            created_any = True

        if created_any:
            db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()


def seed_followups():
    """Insert seed follow-up rows for every patient that has fewer than 3 follow-ups.
    This runs once on startup and is safe to call repeatedly (idempotent via the check).
    """
    from .database import SessionLocal
    from . import models
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        patients = db.query(models.Patient).all()
        if not patients:
            return

        base_time = datetime.now(timezone.utc)

        for patient in patients:
            existing_count = (
                db.query(models.FollowUp)
                .filter(models.FollowUp.patient_id == patient.id)
                .count()
            )
            if existing_count >= 3:
                continue  # already has enough data, skip

            for days_ago, pain_level, fever, medicine_taken, lang_hint, message in _SEED_FOLLOWUPS_PER_PATIENT:
                created = base_time - timedelta(days=days_ago)
                followup = models.FollowUp(
                    patient_id=patient.id,
                    pain_level=pain_level,
                    fever=fever,
                    medicine_taken=medicine_taken,
                    input_source="text",
                    transcript=None,
                    normalized_message=message,
                    language_hint=patient.language or lang_hint,
                    audio_filename=None,
                    created_at=created,
                )
                db.add(followup)

        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()


seed_multilingual_patients()
seed_language_workflows_and_assignments()
seed_followups()

from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager

def scheduled_automation_job():
    from .database import SessionLocal
    from .routes import run_workflow_automation_batch
    db = SessionLocal()
    try:
        print("Running scheduled background automation...")
        run_workflow_automation_batch(db, due_only=True, advance_schedule=True)
    except Exception as e:
        print(f"Periodic background automation job failed: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_automation_job, 'interval', hours=1)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(
    title="Indic Voice AI Patient Engagement Platform",
    description="API for patient outreach, AI-assisted followups, and risk alerts.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
