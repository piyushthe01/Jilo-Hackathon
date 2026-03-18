import uuid
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import models
from app.database import SessionLocal
from app.main import app


class BackendSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.patient_ids = []
        self.workflow_ids = []

    def tearDown(self):
        db = SessionLocal()
        try:
            if self.workflow_ids:
                db.query(models.FollowupCall).filter(
                    models.FollowupCall.workflow_id.in_(self.workflow_ids)
                ).delete(synchronize_session=False)
                db.query(models.WorkflowAssignment).filter(
                    models.WorkflowAssignment.workflow_id.in_(self.workflow_ids)
                ).delete(synchronize_session=False)

            if self.patient_ids:
                db.query(models.FollowupCall).filter(
                    models.FollowupCall.patient_id.in_(self.patient_ids)
                ).delete(synchronize_session=False)
                db.query(models.PatientReport).filter(
                    models.PatientReport.patient_id.in_(self.patient_ids)
                ).delete(synchronize_session=False)
                db.query(models.Alert).filter(
                    models.Alert.patient_id.in_(self.patient_ids)
                ).delete(synchronize_session=False)
                db.query(models.FollowUp).filter(
                    models.FollowUp.patient_id.in_(self.patient_ids)
                ).delete(synchronize_session=False)
                db.query(models.WorkflowAssignment).filter(
                    models.WorkflowAssignment.patient_id.in_(self.patient_ids)
                ).delete(synchronize_session=False)
                db.query(models.Patient).filter(
                    models.Patient.id.in_(self.patient_ids)
                ).delete(synchronize_session=False)

            if self.workflow_ids:
                db.query(models.Workflow).filter(
                    models.Workflow.id.in_(self.workflow_ids)
                ).delete(synchronize_session=False)

            db.commit()
        finally:
            db.close()

    def create_patient(self, language):
        token = uuid.uuid4().hex[:8]
        response = self.client.post(
            "/patients",
            json={
                "name": f"Smoke Patient {token}",
                "phone": f"9000{token[:6]}",
                "language": language,
            },
        )
        self.assertEqual(response.status_code, 200)
        patient = response.json()
        self.patient_ids.append(patient["id"])
        return patient

    def create_workflow(self, language):
        token = uuid.uuid4().hex[:8]
        response = self.client.post(
            "/workflows",
            json={
                "name": f"Smoke Workflow {token}",
                "trigger_type": "Post-discharge",
                "audience": "Smoke test patients",
                "language": language,
                "cadence": "24 hours",
                "message_goal": "Check symptoms and medicine adherence",
                "status": "ACTIVE",
            },
        )
        self.assertEqual(response.status_code, 200)
        workflow = response.json()
        self.workflow_ids.append(workflow["id"])
        return workflow

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_language_mismatch_assignment_is_rejected(self):
        patient = self.create_patient("Hindi")
        workflow = self.create_workflow("Odia")

        response = self.client.post(
            f"/workflows/{workflow['id']}/assign-patients",
            json={"patient_ids": [patient["id"]]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

        assignments = self.client.get("/workflow-assignments").json()
        self.assertFalse(
            any(
                assignment["workflow_id"] == workflow["id"]
                and assignment["patient_id"] == patient["id"]
                for assignment in assignments
            )
        )

    def test_automation_only_returns_language_aligned_calls(self):
        matching_patient = self.create_patient("Odia")
        mismatched_patient = self.create_patient("Hindi")
        workflow = self.create_workflow("Odia")

        assign_response = self.client.post(
            f"/workflows/{workflow['id']}/assign-patients",
            json={"patient_ids": [matching_patient["id"]]},
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(len(assign_response.json()), 1)

        db = SessionLocal()
        try:
            db_assignment = models.WorkflowAssignment(
                workflow_id=workflow["id"],
                patient_id=mismatched_patient["id"],
                status="ACTIVE",
            )
            db.add(db_assignment)
            db.commit()
        finally:
            db.close()

        with patch(
            "app.routes.generate_followup_call_script",
            return_value="Hello, this is Arpita from Wellness Hospital.",
        ), patch(
            "app.routes.synthesize_followup_call_audio", return_value="Q" * 512
        ):
            response = self.client.post(
                "/automation/run-active-workflows",
                json={"workflow_id": workflow["id"]},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["created_calls"][0]["patient_id"], matching_patient["id"])
        self.assertEqual(body["created_calls"][0]["script_language"], "Odia")
        self.assertEqual(body["created_calls"][0]["workflow_language"], "Odia")
        self.assertEqual(body["created_calls"][0]["patient_language"], "Odia")

        queue = self.client.get("/followup-calls")
        self.assertEqual(queue.status_code, 200)
        queue_items = queue.json()
        self.assertTrue(
            any(
                item["workflow_id"] == workflow["id"]
                and item["patient_id"] == matching_patient["id"]
                for item in queue_items
            )
        )

    def test_complete_call_audio_creates_followup_and_blocks_repeat_completion(self):
        patient = self.create_patient("Hindi")
        workflow = self.create_workflow("Hindi")

        assign_response = self.client.post(
            f"/workflows/{workflow['id']}/assign-patients",
            json={"patient_ids": [patient["id"]]},
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(len(assign_response.json()), 1)

        with patch(
            "app.routes.generate_followup_call_script",
            return_value="Namaste, this is Arpita from Wellness Hospital.",
        ), patch("app.routes.synthesize_followup_call_audio", return_value="R" * 512):
            run_response = self.client.post(
                "/automation/run-active-workflows",
                json={"workflow_id": workflow["id"]},
            )

        self.assertEqual(run_response.status_code, 200)
        created_call = run_response.json()["created_calls"][0]

        with patch("app.routes.transcribe_patient_audio", return_value="मुझे खांसी है और मैंने दवा नहीं ली"), patch(
            "app.routes.normalize_followup_transcript",
            return_value="I have cough and did not take medicine.",
        ), patch(
            "app.routes.summarize_followup_call_result",
            return_value="Patient reported cough and missed medication.",
        ):
            complete_response = self.client.post(
                f"/followup-calls/{created_call['id']}/complete/audio",
                json={
                    "audio_filename": "reply.mp3",
                    "audio_base64": "data:audio/mpeg;base64,QQ==",
                    "language_hint": None,
                },
            )

        self.assertEqual(complete_response.status_code, 200)
        body = complete_response.json()
        self.assertEqual(body["call"]["status"], "COMPLETED")
        self.assertEqual(body["analysis"]["input_source"], "audio")
        self.assertIsNotNone(body["analysis"]["followup"]["id"])
        self.assertIsNotNone(body["analysis"]["report"]["id"])

        repeat_response = self.client.post(
            f"/followup-calls/{created_call['id']}/complete/audio",
            json={
                "audio_filename": "reply.mp3",
                "audio_base64": "data:audio/mpeg;base64,QQ==",
                "language_hint": None,
            },
        )
        self.assertEqual(repeat_response.status_code, 409)

    def test_run_due_workflows_advances_schedule(self):
        patient = self.create_patient("Hindi")
        workflow = self.create_workflow("Hindi")

        assign_response = self.client.post(
            f"/workflows/{workflow['id']}/assign-patients",
            json={"patient_ids": [patient["id"]]},
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(len(assign_response.json()), 1)

        workflows_before = self.client.get("/workflows").json()
        workflow_before = next(item for item in workflows_before if item["id"] == workflow["id"])
        self.assertTrue(workflow_before["is_due"])

        with patch(
            "app.routes.generate_followup_call_script",
            return_value="Namaste, this is Arpita from Wellness Hospital.",
        ), patch("app.routes.synthesize_followup_call_audio", return_value="S" * 512):
            response = self.client.post("/automation/run-due-workflows")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreaterEqual(body["count"], 1)
        self.assertTrue(any(call["workflow_id"] == workflow["id"] for call in body["created_calls"]))
        self.assertTrue(any(item["workflow_id"] == workflow["id"] and item["advanced_schedule"] for item in body["workflow_results"]))

        workflows_after = self.client.get("/workflows").json()
        workflow_after = next(item for item in workflows_after if item["id"] == workflow["id"])
        self.assertFalse(workflow_after["is_due"])
        self.assertIsNotNone(workflow_after["last_run_at"])
        self.assertIsNotNone(workflow_after["next_run_at"])

    def test_report_send_and_status_update_flow(self):
        patient = self.create_patient("English")

        followup_response = self.client.post(
            "/followup",
            json={
                "patient_id": patient["id"],
                "pain_level": 0,
                "fever": False,
                "medicine_taken": True,
            },
        )
        self.assertEqual(followup_response.status_code, 200)

        report_response = self.client.post(f"/patients/{patient['id']}/reports/generate")
        self.assertEqual(report_response.status_code, 200)
        report = report_response.json()

        send_response = self.client.post(f"/reports/{report['id']}/send", json={"recipient": "Medical Team"})
        self.assertEqual(send_response.status_code, 200)
        self.assertEqual(send_response.json()["status"], "SENT")

        update_response = self.client.post(
            f"/reports/{report['id']}/status",
            json={"status": "REVIEWED"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["status"], "REVIEWED")


if __name__ == "__main__":
    unittest.main()
