"""Offline regression checks; no database writes or outbound email."""
import asyncio
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))

from bson import ObjectId
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from PIL import Image
from main import app
from services import ai_service, auth_service, doctor_service, pdf_service
from utils.dependencies import get_current_user
from utils.security import create_access_token, get_password_hash, verify_password


def image_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (120, 65, 30)).save(buf, format="JPEG")
    return buf.getvalue()


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_startup_and_auth_guards(self):
        for path in ("/", "/docs", "/openapi.json"):
            self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.get("/auth/profile").status_code, 401)
        self.assertEqual(self.client.get("/auth/profile", headers={"Authorization": "Bearer invalid"}).status_code, 401)
        token = create_access_token("invalid-object-id")
        self.assertEqual(self.client.get("/auth/profile", headers={"Authorization": f"Bearer {token}"}).status_code, 401)

    def test_reset_requires_otp(self):
        response = self.client.post("/auth/reset-password", json={"email": "test@example.com", "new_password": "secret"})
        self.assertEqual(response.status_code, 422)

    def test_signup_preserves_password_and_rejects_invalid_role(self):
        payload = dict(name="O'Brien", email="test@example.com", password="a<&'\"secret", role="patient", otp_code="123456")
        with patch("routes.auth.create_user", new_callable=AsyncMock) as create:
            create.return_value = {"id": "test"}
            self.assertEqual(self.client.post("/auth/signup", json=payload).status_code, 200)
            self.assertEqual(create.call_args.args[0].password, payload["password"])
        payload["role"] = "admin"
        self.assertEqual(self.client.post("/auth/signup", json=payload).status_code, 422)

    def test_otp_not_returned_to_browser(self):
        with patch("routes.auth.generate_and_save_otp", new_callable=AsyncMock, return_value="123456"):
            response = self.client.post("/auth/request-otp", json={"email": "test@example.com"})
            self.assertEqual(response.status_code, 200)
            self.assertNotIn("123456", response.text)

    def test_patient_cannot_download_another_patients_report(self):
        app.dependency_overrides[get_current_user] = lambda: {"_id": ObjectId()}
        with patch("database.mongodb.patients_collection.find_one", new_callable=AsyncMock, return_value=None):
            response = self.client.get(f"/patient/generate-report/{ObjectId()}")
            self.assertEqual(response.status_code, 404)

    def test_profile_update_route(self):
        user_id = ObjectId()
        app.dependency_overrides[get_current_user] = lambda: {"_id": user_id}
        with patch("routes.auth.update_user_profile", new_callable=AsyncMock, return_value={"name": "Updated"}):
            response = self.client.put("/auth/profile", json={"name": "Updated"})
            self.assertEqual(response.json()["data"]["name"], "Updated")

    def test_login_issues_token(self):
        user_id = ObjectId()
        user = {"_id": user_id, "email": "test@example.com", "password": get_password_hash("secret"), "role": "patient"}
        with patch.object(auth_service.users_collection, "find_one", new_callable=AsyncMock, return_value=user), patch("utils.audit.log_action", new_callable=AsyncMock):
            response = self.client.post("/auth/login", data={"username": "test@example.com", "password": "secret"})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["access_token"])

    def test_static_reports_are_not_public(self):
        self.assertEqual(self.client.get("/reports/example.pdf").status_code, 404)

    def test_simulator_runs_model_without_saving(self):
        app.dependency_overrides[get_current_user] = lambda: {"_id": ObjectId()}
        with patch("database.mongodb.patients_collection.insert_one", new_callable=AsyncMock) as save:
            response = self.client.post('/patient/preview', json=dict(name="Test", gender="Male", age=12, screen_time=2, reading_time=1, work_hours=0, sleep_hours=8, outdoor_activity=2, parental_myopia=0))
            self.assertEqual(response.status_code, 200)
            self.assertTrue(0 <= response.json()["data"]["myopia_probability"] <= 1)
            save.assert_not_awaited()

    def test_password_roundtrip(self):
        password = "a<&'\"" * 30
        hashed = get_password_hash(password)
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("wrong", hashed))


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_image_service_failure_does_not_create_prediction(self):
        import httpx
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.ConnectError("offline")):
            with self.assertRaises(HTTPException) as error:
                await ai_service.predict_fundus_palm(image_bytes())
            self.assertEqual(error.exception.status_code, 503)
    async def test_upload_generates_safe_unique_path(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(doctor_service, "UPLOADS_DIR", Path(tmp)):
            paths = []
            for _ in range(2):
                paths.append(await doctor_service.handle_image_upload(UploadFile(filename="../../escape.jpg", file=io.BytesIO(image_bytes()))))
            self.assertNotEqual(*paths)
            self.assertTrue(all((Path(tmp) / Path(p).name).is_file() for p in paths))

    async def test_upload_rejects_invalid_image(self):
        with self.assertRaises(HTTPException) as error:
            await doctor_service.handle_image_upload(UploadFile(filename="bad.jpg", file=io.BytesIO(b"invalid")))
        self.assertEqual(error.exception.status_code, 422)

    async def test_prediction_rejects_path_outside_uploads(self):
        with self.assertRaises(HTTPException) as error:
            await doctor_service.process_prediction(str(ObjectId()), "../backend/.env", {})
        self.assertEqual(error.exception.status_code, 422)

    async def test_pdf_uses_patient_record(self):
        patient_id = str(ObjectId())
        with patch.object(doctor_service.reports_collection, "find_one", new_callable=AsyncMock, return_value={"severity": "Low"}), patch.object(doctor_service.patients_collection, "find_one", new_callable=AsyncMock, return_value={"name": "Test Patient"}) as find, patch.object(pdf_service, "generate_pdf_report", return_value="test.pdf") as generate:
            self.assertEqual(await doctor_service.create_pdf_report(patient_id), "test.pdf")
            find.assert_awaited_once()
            self.assertEqual(generate.call_args.args[0]["name"], "Test Patient")

    async def test_clinical_only_evaluation_uses_patient_defaults(self):
        patient_id = str(ObjectId())
        report_insert = Mock(inserted_id=ObjectId())
        with patch.object(doctor_service.patients_collection, "find_one", new_callable=AsyncMock, return_value={"age": 12, "reading_time": 0}), patch.object(doctor_service.clinical_data_collection, "insert_one", new_callable=AsyncMock), patch.object(doctor_service.reports_collection, "insert_one", new_callable=AsyncMock, return_value=report_insert), patch.object(doctor_service, "predict_clinical_evaluation", return_value={"severity": "Low", "prediction": "Low", "confidence": 0.1, "predicted_next_spheq": 0, "progression_rate": "Low"}) as predict:
            result = await doctor_service.process_prediction(patient_id, "", {"age": None, "refractive_error": 0})
            self.assertEqual(predict.call_args.args[0]["age"], 12)
            self.assertEqual(result["fundus_pm_prediction"], "No Image")

    async def test_email_failure_is_not_reported_as_success(self):
        with patch.object(auth_service.users_collection, "find_one", new_callable=AsyncMock, return_value=None), patch("database.mongodb.otp_codes_collection.delete_many", new_callable=AsyncMock), patch("database.mongodb.otp_codes_collection.insert_one", new_callable=AsyncMock), patch("services.email_service.send_otp_email", return_value=False):
            with self.assertRaises(HTTPException) as error:
                await auth_service.generate_and_save_otp("test@example.com", is_signup=True)
            self.assertEqual(error.exception.status_code, 503)


class ModelTests(unittest.TestCase):
    def test_patient_model_missing_never_uses_rules(self):
        from services import patient_service
        from schemas.patient import PatientRiskInput
        sample = PatientRiskInput(name="Test", gender="Male", age=12, screen_time=2, reading_time=1, work_hours=0, sleep_hours=8, outdoor_activity=2, parental_myopia=0)
        with patch.object(patient_service, "_load_patient_models", return_value=False):
            with self.assertRaises(HTTPException) as error:
                patient_service.calculate_risk(sample)
            self.assertEqual(error.exception.status_code, 503)

    def test_patient_model_does_not_invent_progression(self):
        from services.patient_service import calculate_risk
        from schemas.patient import PatientRiskInput
        result = calculate_risk(PatientRiskInput(name="Test", gender="Male", age=12, screen_time=2, reading_time=1, work_hours=0, sleep_hours=8, outdoor_activity=2, parental_myopia=0))
        self.assertIsNone(result[3])
        self.assertTrue(0 <= result[2] <= 1)

    def test_gradcam_matches_onnx_and_is_class_specific(self):
        from ml.inference_service.main import app as inference_app
        from ml.inference_service.gradcam import explain
        import numpy as np
        picture = (ROOT / "PALM/PALM/Training/Images/H0001.jpg").read_bytes()
        normal, pm = explain(picture, 0), explain(picture, 1)
        self.assertLess(normal["logit_max_error"], 1e-4)
        self.assertEqual(normal["feature_shape"], [1, 1280, 7, 7])
        self.assertTrue(normal["overlay"].startswith("data:image/png;base64,"))
        self.assertFalse(np.allclose(normal["heatmap"], pm["heatmap"]))
        response = TestClient(inference_app).post('/predict', files={'file': ('image.jpg', picture, 'image/jpeg')}, data={'explain': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["label"], response.json()["data"]["gradcam"]["target_class"])
    def test_zero_and_null_clinical_inputs(self):
        self.assertTrue(ai_service._load_doctor_models())
        data = dict(refractive_error=0, reading_hours=0, axial_length=23, age=None, acd=None)
        with patch.object(ai_service._scaler_doc, "transform", wraps=ai_service._scaler_doc.transform) as transform:
            result = ai_service.predict_clinical_evaluation(data)
            features = transform.call_args.args[0].iloc[0]
            self.assertEqual(features.iloc[11], 0)
            self.assertEqual(features.iloc[2], 0)
            self.assertIn(result["severity"], ["Low", "Moderate", "High"])

    def test_missing_clinical_model_reports_unavailable(self):
        with patch.object(ai_service, "_load_doctor_models", return_value=False):
            with self.assertRaises(HTTPException) as error:
                ai_service.predict_clinical_evaluation({})
            self.assertEqual(error.exception.status_code, 503)

    def test_real_pdf_generation(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(pdf_service, "REPORTS_DIR", Path(tmp)):
            path = pdf_service.generate_pdf_report({"id": "test", "name": "Test", "parental_myopia": 0}, {"severity": "Low", "confidence": 0.1})
            self.assertTrue(Path(path).read_bytes().startswith(b"%PDF"))

    def test_real_onnx_and_invalid_image(self):
        from ml.inference_service.main import app as inference_app
        client = TestClient(inference_app)
        self.assertEqual(client.get("/health").status_code, 200)
        response = client.post("/predict", files={"file": ("image.jpg", image_bytes(), "image/jpeg")})
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertAlmostEqual(data["prob_pm"] + data["prob_non_pm"], 1, places=3)
        self.assertIn(data["label"], [0, 1])
        self.assertEqual(client.post("/predict", files={"file": ("bad.jpg", b"invalid", "image/jpeg")}).status_code, 422)

    def test_missing_onnx_is_not_mocked(self):
        from ml.inference_service.main import predictor
        with patch.object(predictor, "_session", None), patch.dict("os.environ", {"PALM_ONNX_PATH": str(ROOT / "nonexistent.onnx")}):
            with self.assertRaises(FileNotFoundError):
                predictor._get_session()


if __name__ == "__main__":
    unittest.main()
