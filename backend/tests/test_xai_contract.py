"""Explanation errors cannot be reported or persisted as successful predictions."""
import sys
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
sys.path.insert(0, str(ROOT))
from fastapi import HTTPException
from fastapi.testclient import TestClient
from ml.inference_service.main import app, predictor, gradcam
from services import ai_service


class ApiErrors(unittest.TestCase):
    def test_explanation_failure_returns_no_prediction(self):
        for error, status in [(FileNotFoundError('checkpoint unavailable'), 503), (RuntimeError('backward failed'), 500)]:
            with patch.object(predictor, 'predict', return_value={'prediction': 'PM', 'label': 1, 'confidence': .8}), patch.object(gradcam, 'explain', side_effect=error):
                response = TestClient(app).post('/predict', files={'file': ('a.png', b'image', 'image/png')}, data={'explain': 'true'})
                self.assertEqual(response.status_code, status)
                self.assertEqual(set(response.json()), {'detail'})

    def test_failed_initialization_does_not_retry_per_request(self):
        with patch.object(gradcam, '_cam', None), patch.object(gradcam, 'load_baseline_model', side_effect=RuntimeError('load failed')) as load:
            with self.assertRaises(RuntimeError):
                gradcam.initialize()
            for _ in range(2):
                with self.assertRaises(FileNotFoundError):
                    gradcam.explain(b'image')
            self.assertEqual(load.call_count, 1)


class BackendContract(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_plain_gradcam_or_missing_explanation(self):
        for explanation in (None, {'method': 'Grad-CAM'}):
            reply = Mock()
            reply.json.return_value = {'data': {'prediction': 'PM', 'label': 1, 'confidence': .9, 'gradcam': explanation}}
            with patch('httpx.AsyncClient.post', new_callable=AsyncMock, return_value=reply):
                with self.assertRaises(HTTPException) as caught:
                    await ai_service.predict_fundus_palm(b'image')
                self.assertEqual(caught.exception.status_code, 503)
