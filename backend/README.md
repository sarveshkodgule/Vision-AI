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
    JWT_SECRET_KEY=supersecretkey_please_change_in_production
    ```

### Running the Server

Start the development server with Uvicorn:

```bash
uvicorn main:app --reload
```

The server will be available at: `http://127.0.0.1:8000`

### API Documentation

FastAPI auto-generates interactive Swagger UI documentation.
Visit: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

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
