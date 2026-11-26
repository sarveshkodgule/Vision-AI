"""Offline unit tests for doctor sign-off persistence, patient history, and scoped stats."""
import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))

from bson import ObjectId
from fastapi import HTTPException
from routes import doctor as doctor_routes
from schemas.doctor import DoctorSignOffInput
from services import doctor_service
from utils.dependencies import get_current_doctor, get_current_user
from utils.security import create_access_token


class _AsyncCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, length=None):
        return list(self._docs)


class DoctorClinicalWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.doctor_id = ObjectId()
        self.doctor_user = {
            "_id": self.doctor_id,
            "id": str(self.doctor_id),
            "name": "Dr. Hemant Anaspure",
            "role": "doctor",
            "is_active": True,
        }

    def test_doctor_role_guard_rejects_patient(self):
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_current_doctor({"_id": ObjectId(), "role": "patient", "is_active": True}))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_stale_token_version_is_rejected_after_password_reset(self):
        uid = ObjectId()
        stale_token = create_access_token(str(uid), role="patient", token_version=0)
        with patch("database.mongodb.blacklist_tokens_collection.find_one", new_callable=AsyncMock, return_value=None), \
             patch("utils.dependencies.users_collection.find_one", new_callable=AsyncMock, return_value={"_id": uid, "role": "patient", "is_active": True, "token_version": 1}):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(get_current_user(stale_token))
            self.assertEqual(ctx.exception.status_code, 401)

    def test_sign_off_persists_verdict_and_rejects_unassigned_patient(self):
        report_id = ObjectId()
        patient_id = ObjectId()
        report_doc = {"_id": report_id, "patient_id": str(patient_id)}

        # Unassigned patient -> 404
        with patch.object(doctor_service.reports_collection, "find_one", new_callable=AsyncMock, return_value=report_doc), \
             patch.object(doctor_service.patients_collection, "find_one", new_callable=AsyncMock, return_value=None):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(
                    doctor_routes.sign_off_clinical_report(
                        str(report_id),
                        DoctorSignOffInput(doctor_verdict="High"),
                        current_user=self.doctor_user,
                    )
                )
            self.assertEqual(ctx.exception.status_code, 404)

        # Assigned patient -> persists verdict, status, timestamp, and doctor identity
        update_mock = AsyncMock()
        audit_mock = AsyncMock()
        with patch.object(doctor_service.reports_collection, "find_one", new_callable=AsyncMock, return_value=report_doc), \
             patch.object(doctor_service.patients_collection, "find_one", new_callable=AsyncMock, return_value={"_id": patient_id, "assigned_doctor_id": str(self.doctor_id)}), \
             patch.object(doctor_service.reports_collection, "update_one", update_mock), \
             patch("utils.audit.log_action", audit_mock):
            res = asyncio.run(
                doctor_routes.sign_off_clinical_report(
                    str(report_id),
                    DoctorSignOffInput(doctor_verdict="High", clinical_note="Follow up in 3 months"),
                    current_user=self.doctor_user,
                )
            )
            self.assertEqual(res["status"], "success")
            body = res["data"]
            self.assertEqual(body["doctor_verdict"], "High")
            self.assertEqual(body["review_status"], "signed_off")
            self.assertEqual(body["signed_off_by"], str(self.doctor_id))
            self.assertEqual(body["signed_off_by_name"], "Dr. Hemant Anaspure")
            self.assertEqual(body["clinical_note"], "Follow up in 3 months")
            self.assertTrue(body["signed_off_at"])
            update_mock.assert_awaited_once()
            audit_mock.assert_awaited_once()

    def test_patient_clinical_history_retrieval_and_authorization(self):
        patient_id = ObjectId()

        # Unassigned patient -> 404
        with patch("database.mongodb.patients_collection.find_one", new_callable=AsyncMock, return_value=None):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(
                    doctor_routes.get_patient_clinical_history(
                        str(patient_id),
                        current_user=self.doctor_user,
                    )
                )
            self.assertEqual(ctx.exception.status_code, 404)

        # Assigned patient -> returns real stored records without dummy values
        rep_id = ObjectId()
        older_rep_id = ObjectId()
        current_clinical_id = ObjectId()
        older_clinical_id = ObjectId()
        reports_docs = [{
            "_id": rep_id,
            "patient_id": str(patient_id),
            "clinical_record_id": str(current_clinical_id),
            "created_at": "2026-11-26T00:00:00+00:00",
            "prediction": "Myopia Severity: Moderate (55.0%)",
            "severity": "Moderate",
            "confidence": 0.55,
            "current_spheq": -2.25,
            "doctor_verdict": "Medium",
            "review_status": "signed_off",
        }, {
            "_id": older_rep_id,
            "patient_id": str(patient_id),
            "clinical_record_id": str(older_clinical_id),
            "created_at": "2026-11-25T00:00:00+00:00",
            "prediction": "Myopia Severity: Low (20.0%)",
            "severity": "Low",
            "confidence": 0.2,
            "current_spheq": -1.25,
        }]
        clin_docs = [{
            "_id": older_clinical_id,
            "patient_id": str(patient_id),
            "axial_length": 23.8,
            "refractive_error": -1.25,
            "acd": 3.2,
            "lt": 3.7,
            "vcd": 15.9,
        }, {
            "_id": current_clinical_id,
            "patient_id": str(patient_id),
            "axial_length": 24.6,
            "refractive_error": -2.25,
            "acd": 3.4,
            "lt": 3.9,
            "vcd": 16.5,
        }]

        with patch("database.mongodb.patients_collection.find_one", new_callable=AsyncMock, return_value={"_id": patient_id, "assigned_doctor_id": str(self.doctor_id)}), \
             patch.object(doctor_service.reports_collection, "find", return_value=_AsyncCursor(reports_docs)), \
             patch.object(doctor_service.clinical_data_collection, "find", return_value=_AsyncCursor(clin_docs)):
            res = asyncio.run(
                doctor_routes.get_patient_clinical_history(
                    str(patient_id),
                    current_user=self.doctor_user,
                )
            )
            self.assertEqual(res["status"], "success")
            data = res["data"]
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]["spheq"], -2.25)
            self.assertEqual(data[0]["axial_length"], 24.6)
            self.assertEqual(data[0]["doctor_verdict"], "Medium")
            self.assertEqual(data[0]["review_status"], "signed_off")
            self.assertEqual(data[1]["spheq"], -1.25)
            self.assertEqual(data[1]["axial_length"], 23.8)

    def test_screening_stats_are_scoped_to_authenticated_doctor(self):
        pid = ObjectId()
        patients_find = MagicMock(return_value=_AsyncCursor([
            {"_id": pid, "assigned_doctor_id": str(self.doctor_id), "risk_level": "High", "created_at": "2026-11-26T00:00:00"}
        ]))
        reports_find = MagicMock(return_value=_AsyncCursor([
            {"patient_id": str(pid), "severity": "High", "doctor_verdict": "High"}
        ]))

        with patch.object(doctor_service.patients_collection, "find", patients_find), \
             patch.object(doctor_service.reports_collection, "find", reports_find):
            res = asyncio.run(doctor_routes.get_screening_stats(current_user=self.doctor_user))
            patients_find.assert_called_once_with({"assigned_doctor_id": str(self.doctor_id)})
            reports_find.assert_called_once_with({"patient_id": {"$in": [str(pid)]}})
            self.assertEqual(res["data"]["all_time"]["total"], 1)
            self.assertEqual(res["data"]["validation_accuracy"], 100.0)


if __name__ == "__main__":
    unittest.main()
