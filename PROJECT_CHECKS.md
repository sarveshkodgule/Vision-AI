# Development and verification

Use Python 3.12 (the checked environment) and install:

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r backend/requirements.txt -r ml/inference_service/requirements.txt
cd Frontend
npm ci
cd ..
.\start-dev.ps1
```

The launcher runs the backend on port 8000, ONNX inference on 8001, and Vite in the foreground. It stops the Python services when the foreground command exits. Stop existing servers on those ports before using it.

## Checks from the repository root

```powershell
.\backend\venv\Scripts\python.exe -X utf8 -m unittest discover -s backend/tests -v
.\backend\venv\Scripts\python.exe -X utf8 backend/run_ml_test.py
.\backend\venv\Scripts\python.exe backend/test_deps.py
cd Frontend
npm run lint
npm run build
```

Regression checks mock database operations and email delivery. They exercise API validation, authentication guards, report access, password handling, uploads, model failure handling, real clinical inference, real ONNX inference, and PDF generation. They do not establish clinical accuracy or verify live SMTP delivery.

Latest verification: 20 regression tests passed; frontend lint and production build passed; dependency consistency passed; all four bundled clinical/lifestyle examples completed. Temporary Uvicorn servers returned HTTP 200 for the backend and inference health endpoints, and the backend successfully called ONNX inference using `PALM/PALM/Training/Images/H0001.jpg`. Those temporary servers were stopped after testing. Browser interaction and external chatbot providers were not verified. Non-blocking Browserslist age, build timing, and TestClient deprecation warnings remain.

## Configuration

### Patient screening PDF and email (October 2026)

- A completed patient assessment now queues a Vision AI email with a detailed PDF attached. The recipient is resolved from the registered account on the server. `SMTP_EMAIL` is the sender; configure that setting with the Vision AI Gmail account and use its SMTP credentials. Secrets remain in `backend/.env`.
- Results and screening history offer **Download PDF report**, independent of a doctor evaluation. Existing doctor-generated clinical reports remain separate.
- The branded three-page report contains patient details, saved model probability, risk-specific interpretation and next steps, eye-care habits, treatment discussion topics, urgent symptoms, appointment preparation, and assigned-doctor contact when available. Guidance cites NEI and AAPOS. High screening risk is explicitly distinguished from diagnosed high myopia, and low risk does not certify normal vision.
- `GET /patient/screening-report/{screening_id}` downloads the PDF; `GET /patient/screening-report/{screening_id}/status` checks mail status; `POST /patient/screening-report/{screening_id}/email` sends or retries. All three require authentication and screening ownership. The browser cannot choose an arbitrary email recipient. Downloads do not send mail.
- Status is `queued`, `sending`, `sent`, `failed`, or `not_sent` for older records. `sent` means SMTP acceptance, not verified inbox delivery. Failed emails can be retried. Atomic claims suppress duplicate requests for active or sent reports. Historical records can be emailed manually.
- Delivery uses FastAPI background tasks, not a durable job queue. A restart can interrupt pending work; **Check / retry email** can reclaim a job after five minutes. As with ordinary SMTP, a process failure immediately after acceptance can cause uncertain delivery or a duplicate on retry. A durable worker and provider delivery tracking would be needed for stronger production guarantees.
- Report tests use synthetic patients and mock MongoDB/SMTP. No real patient received test mail. Live Gmail credentials, inbox delivery, and browser interaction have not been verified.
- Verification: 16 report-specific tests passed, the existing 30 backend checks passed, and frontend lint/build passed. Low, moderate and high synthetic PDFs each have three pages; the high-risk example was visually reviewed.

To try it: restart the backend, sign into the patient portal, submit a screening, download the PDF, and check the registered inbox/spam folder. If email fails, the PDF remains available and the portal offers a retry.

Test dependencies and synthetic previews (from repository root):

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\backend\venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_patient_reports.py -v
.\backend\venv\Scripts\python.exe backend/preview_patient_reports.py
```

Preview files are generated under `backend/reports/previews/` and contain sample data only. Optional `--render` needs `pymupdf` and produces PNGs for visual review. It is not a runtime requirement.

### Existing application settings

- Keep MongoDB, JWT and SMTP settings in `backend/.env`.
- Signup and password reset require a six-digit email code. Failed email delivery returns HTTP 503; codes are never returned by the API.
- Set `VITE_API_BASE_URL` in `Frontend/.env` for a deployed API. Local development defaults to the current hostname on port 8000.
- The bundled pickle models require scikit-learn 1.8.0 and XGBoost 3.2.0; these versions are pinned in backend requirements.
- The ONNX model is `ml/checkpoints/palm_efficientnet_b0.onnx`. Missing weights return HTTP 503, with no simulated prediction.
- Fundus scans are optional for clinical-only evaluations. Supplied scans must be valid JPEG/PNG images of at most 10 MB.
- Report downloads require patient ownership or doctor assignment. Clinical files are not exposed through public static routes.
- PALM training defaults to `PALM/PALM`. `backend/retrain_balanced.py` needs the original myopic-only CSV via `MYOPIA_TRAINING_DATA`; that original external dataset is not bundled. Do not substitute the balanced dataset because the script labels every source row as myopic.
- Full training is separate from runtime checks; it can overwrite model artifacts and take hours. The legacy `train_cnn.py` model is not used by the ONNX service.

## Model-only predictions and explainability

Patient screening and the what-if simulator now require XGBoost; no rule-based prediction is used. Supplied images require successful ONNX inference. Real Grad-CAM uses the same ONNX weights and a verified autograd head. The dashboard shows actual recorded probabilities and measured/model-predicted SPHEQ, with no invented history. See [presentation guide](ML_DL_PRESENTATION.md) and `ml/results/artifact_audit.json` for the 400-image evaluation and limitations. Install updated inference requirements for Grad-CAM. Historical database records were preserved and their model provenance cannot be retroactively guaranteed.

## Chatbot (OpenAI GPT)

Both chatbot endpoints use OpenAI only. Set `OPENAI_API_KEY` in `backend/.env` and select `OPENAI_MODEL` (default `gpt-4o`), then restart the backend. The key must stay server-side. No alternate-provider or canned-response fallback is used. Missing credentials, provider errors, and timeouts return explicit errors. Chat requests currently send only the latest message; database history is stored but not sent as conversation context. Provider calls use the OpenAI Chat Completions endpoint at `https://api.openai.com/v1/chat/completions`.
