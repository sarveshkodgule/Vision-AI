# AI-Based Myopia Screening Backend

This is the FastAPI backend for the "AI-Based Myopia Screening and Doctor Decision Support System".

## Features

- **Authentication Module**: Secure signup and login using JWT and bcrypt.
- **Patient Module**: Submit screening data (age, screen time, etc.) to get risk assessments.
- **Doctor Module**: Upload fundus images, run clinical XGBoost and PALM ONNX predictions, fetch patient lists.
- **Report Generation**: Dynamically generate PDF reports using ReportLab for clinical records.
- **Chatbot Module**: Rule-based virtual assistant to answer Myopia-related queries.

## Tech Stack
- **Framework**: FastAPI
- **Database**: MongoDB (motor asynchronous driver)
- **Security**: PyJWT, bcrypt
- **PDF Generation**: ReportLab
- **Data Validation**: Pydantic
- **Operations**: structured logs, MongoDB indexes, MongoDB-backed rate limiting, readiness checks

## Getting Started

### Prerequisites

1.  Python 3.12 (tested)
2.  MongoDB Server (Running locally on default port 27017, or update the `.env` file)

### Installation

1.  Navigate to the `backend` folder where this code resides:
    ```bash
    cd backend
    ```

2.  Create a virtual environment:
    ```bash
    python -m venv venv
    ```

3.  Activate the virtual environment:
    - **Windows**: `.\venv\Scripts\activate`
    - **Mac/Linux**: `source venv/bin/activate`

4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

5.  Make sure the `.env` file exists with DB variables:
    ```env
    MONGODB_URI=mongodb://localhost:27017
    DB_NAME=myopia_db
    JWT_SECRET_KEY=generate-a-random-secret-at-least-32-characters-long
    HOSPITAL_DOCTOR_CODE=configure-a-private-staff-registration-code
    PALM_SERVICE_URL=http://127.0.0.1:8001
    PALM_MODEL_VERSION=palm-efficientnet-b0-v1
    PALM_REVIEW_THRESHOLD=0.80
    # Optional shared rate limiter for multiple backend workers:
    ```

`JWT_SECRET_KEY` and `HOSPITAL_DOCTOR_CODE` are required for their respective
features. The backend fails closed if the JWT secret is missing or shorter than
32 characters; never use the example values in production.

Rate-limit counters are stored in MongoDB and automatically expire through a
TTL index, so the limiter works across multiple backend workers without Redis.
If MongoDB is temporarily unavailable, the API uses a process-local fallback and
logs the degraded state. Predictions below `PALM_REVIEW_THRESHOLD` are marked
for clinician review and reports include the configured model version.

### Running the Server

Start the development server with Uvicorn:

```bash
uvicorn main:app --reload
```

The server will be available at: `http://127.0.0.1:8000`

### API Documentation

FastAPI auto-generates interactive Swagger UI documentation.
Visit: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Dependency readiness is available at
[http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready). It checks
MongoDB and the PALM inference service separately.

You can test all endpoints, authorize using the "Authorize" button (entering the JWT Token received from login), and simulate requests.

### Project Structure
- `main.py`: Entrypoint and FastAPI configuration.
- `database/`: MongoDB connection setup.
- `routes/`: API endpoint definitions (controllers).
- `services/`: Business logic, ML inference, and DB operations.
- `schemas/`: Pydantic models for request/response validation.
- `utils/`: JWT, security, and dependencies.
- `uploads/`: Directory for uploaded images.
- `reports/`: Directory for generated PDFs.

See [project checks and full-stack startup](../PROJECT_CHECKS.md) for regression tests, SMTP setup, model versions, and the development launcher.

### Running regression tests on Windows

Run the supplied script from a normal PowerShell terminal:

```powershell
.\run-tests.ps1
```

It runs Grad-CAM on CPU and limits OpenBLAS-related thread pools, preventing
GPU out-of-memory and OpenBLAS allocation failures during the combined suite.
The application also now uses CPU for Grad-CAM by default. To use a GPU
deliberately, set `PALM_DEVICE=cuda` before launching the ML service; use
`PALM_DEVICE=auto` to select CUDA only when it is available.

### Operational checklist

- Start MongoDB before the backend so startup can verify indexes.
- Start the PALM service on port 8001 and confirm `/health` is ready.
- Keep MongoDB available before running more than one backend worker because it
  stores shared rate-limit counters.
- Keep the matching `best_overall.pth` checkpoint and ONNX artifact available.
- Review low-confidence predictions clinically; the model is not a diagnosis.
