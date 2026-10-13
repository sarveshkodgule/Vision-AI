# Backend health check — 13 October 2026

## Overall result

The main backend and database are reachable, and Groq responds. The complete backend is **not fully operational**: doctor image analysis with Grad-CAM++ is blocked by a missing checkpoint. Email delivery and the new Gmail sender remain unverified as requested.

Full command: `backend/venv/Scripts/python.exe -m unittest discover -s tests -v` (run from `backend`, using `./venv/Scripts/python.exe`). Result: **77 tests: 74 passed, 1 failure, 2 errors**. These tests use mocked database/mail dependencies except local model/PDF checks. No emails or real patient records were created during this audit.

## Verified

| Component | Evidence | Limit |
| --- | --- | --- |
| Main API, port 8000 | `/` and `/openapi.json` return 200 | Root endpoint is not comprehensive dependency readiness |
| Access guards | `/auth/profile`, `/doctor/patients`, `/patient/history` return 401 without credentials | Not a live login as a real patient/doctor |
| MongoDB | Live read-only authenticated ping passed | No patient data queried or changed |
| Groq | Live service call returned a nonempty response | This audit avoided the public chat route because it stores history; that route returned 200 in the preceding chatbot check |
| Patient/clinical models | Local model inference and input handling tests passed | Functional inference, not a clinical accuracy evaluation |
| Reports | PDF generation, ownership guards and report route tests passed | No actual report email sent |
| ONNX image model | Loaded successfully; synthetic-image `/predict` with `explain=false` returned 200 | A blank synthetic image checks execution only, not diagnostic validity |
| Invalid image handling | Invalid image request returned 422 | Correct rejection |
| Google configuration | `/auth/google/config` returned 200; verification unit tests passed | Actual Google popup sign-in/origin approval was not tested |
| Dependencies | `pip check`: no broken requirements | A FastAPI/Starlette test-client deprecation warning remains; it did not fail tests |

## Problems, causes and remedies

### 1. Missing Grad-CAM++ checkpoint — blocks full doctor image analysis

- Missing file: `ml/checkpoints/best_overall.pth`.
- `http://127.0.0.1:8001/health` returns 503 with the missing checkpoint message.
- `/predict` with `explain=true` returns 503, while `explain=false` returns 200.
- The main backend requires a valid Grad-CAM++ explanation for image results, so this blocks that workflow even though the ONNX classifier itself works.
- Why: ONNX weights are present, but the explanation code loads a separate PyTorch checkpoint for gradients. `ml/.gitignore` excludes both checkpoint formats, so a repository checkout alone does not restore these assets. The audit cannot determine when or why this particular file went missing.
- Remedy: restore the original matching `best_overall.pth` from the training output/backup. It must correspond to the deployed ONNX weights. Restart the image service and rerun class-specific explanation/parity tests. Do not substitute an unrelated checkpoint or remove the explanation requirement to hide the failure.

### 2. Missing PALM test image — blocks the explanation validation test

- Missing file: `backend/DL dataset/PALM/PALM/Testing/Images/T0001.jpg`.
- `test_gradcam_matches_onnx_and_is_class_specific` errors before inference.
- Why: the test expects a local dataset image, and the dataset is not present at that location.
- Remedy: restore the dataset or set `PALM_DATA_ROOT` to the actual directory containing `Testing/Images/T0001.jpg`. This fixture is not required for patient questionnaire screening.

### 3. One explanation unit test depends on a real checkpoint

- `test_failed_initialization_does_not_retry_per_request` errors with `FileNotFoundError` instead of the mocked loader's `RuntimeError`.
- Why: the test mocks the model loader but not the preceding checkpoint existence/read operations. With no checkpoint, the code never reaches the mock.
- Remedy: isolate the file prerequisite in that unit test using a temporary checkpoint and mock loader. Keep the separate real-checkpoint integration test. This is distinct from the runtime missing-model problem.
- The third failing test, `test_real_onnx_and_invalid_image`, fails its health assertion because health requires Grad-CAM++ readiness; it does not establish that ONNX prediction itself is broken.

### 4. Email/OTP delivery — setup deferred, not verified

- Active SMTP sender does not match `visionaisystemss@gmail.com`.
- SMTP credentials are present, but no authentication or sending test was performed for them. Presence is not evidence of validity.
- The requested Gmail account previously had 2-Step Verification off, preventing App Password setup. Setup and test sending were then deferred at your request.
- OTP generation, expiry, single use and delivery-failure handling passed offline tests. Actual inbox delivery is not proven.
- Resume by configuring that Gmail account's App Password and sender, then performing an explicitly authorised delivery test. Existing email hooks were not disabled; pausing setup does not remove them.

### 5. Doctor self-registration — configuration required

- `HOSPITAL_DOCTOR_CODE` is absent, so doctor self-registration is deliberately rejected with a configuration message.
- Existing doctor accounts can still use their personal password or matching Google account; those authentication paths pass isolated tests.
- Prefer administrator-provisioned doctor accounts. Alternatively configure a private registration code for the existing signup flow. This code is not a WebAuthn passkey.

## Audit scope

No application fixes, dataset changes, checkpoint replacements, real patient writes or emails were performed. Network-restricted MongoDB testing initially timed out; the authorised test outside the sandbox passed, so that initial timeout is not reported as a database outage. Live Google login, SMTP delivery, real doctor image analysis and clinical model accuracy remain outside the verified set above.
