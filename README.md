# VisionAssistant: Clinical Myopia Screening & Decision Support System

VisionAssistant is a clinical decision support application designed to assist eye care professionals and patient directories in screening, tracking, and evaluating myopia progression risk. By combining interactive diagnostic tools, automated report exports, client-side progression tracking, and built-in security protocols, the application serves as a comprehensive assistance portal for modern clinical management.

---

## 🏗️ System Architecture & Technologies

The system is structured as a decoupled full-stack architecture built to modern software standards:

*   **Frontend Client:** Built using **React 18** and **Vite** for high-performance rendering. Features responsive UI dashboards, Framer Motion transitions, and interactive progression tracking.
*   **Backend Server:** Powered by **FastAPI** (Python 3.10+) running a local Uvicorn process to handle API requests, database queries, and document generation.
*   **Database Store:** Managed via **MongoDB Atlas** (Cloud NoSQL database) for storing patient details, clinical biometry, doctor reports, and logs.
*   **Inference & AI Pipelines:**
    *   **Morphological Imaging:** PyTorch custom Convolutional Network (`FundusCNN`) to classify fundus scans and overlay heatmaps.
    *   **Tabular Evaluation:** Analyzes lifestyle variables and clinical measurements to calculate progression rates and refractive estimates.

---

## 📊 Core Application Modules

### 👨‍⚕️ 1. Doctor Directory & Form Auto-Fill
*   **Patient Directory:** An active patient search directory listing clinical statuses (e.g. *Needs Review*, *Monitoring*, *Cleared*).
*   **Automatic Parameter Pre-Population:** Form fields automatically populate with selected patients' reported lifestyle variables (screen time, reading hours, outdoor activity, parental myopia) to streamline clinical data entry.

### 📈 2. Patient Portal & Progress Visualizations
*   **Lifestyle Logging:** Patients can easily log lifestyle parameters and view their assigned doctor's feedback.
*   **Refractive Progression Trend Charts:** Renders interactive timelines showing patient progression rates, spherical equivalent histories, and axial length trends.

### 📄 3. One-Click Clinical PDF Exports
*   Allows both doctors and patients to export complete diagnostic sheets with a single click.
*   Generates a print-ready PDF containing clinics' headers, patient metadata, lifestyle factors, clinical biometry, severity indicators, and doctor verdicts.

### 💬 4. Clinical Support AI Chatbot
*   A responsive generative support widget available on the landing page and patient dashboard.
*   Helps answer routine patient queries regarding myopia, explains complex biometry terms, and suggests preventive habits.

---

## 🔒 Security Specifications

To protect patient records and maintain system integrity, the platform integrates the following security features:

1.  **Bcrypt Hashing:** Passwords undergo SHA-256 pre-hashing and Bcrypt salting to block brute-force and dictionary attacks.
2.  **JWT Authorization Guards:** Sensitive endpoints are secured via JSON Web Tokens.
3.  **Active Token Blacklisting:** Upon logout, tokens are blacklisted in MongoDB and immediately revoked to prevent session replay.
4.  **Payload Input Sanitization:** Intercepts JSON inputs to escape HTML tags (XSS mitigation) and remove keys starting with `$` (NoSQL injection block).
5.  **API Rate Limiting:** Limits connections to **150 requests per 15 minutes** per IP address (with loopback bypass for local development).
6.  **Temporal OTP Code Expiry:** Strict **10-minute constraint** on random 6-digit verification codes.
7.  **Uncaught Error Boundary Sanitization:** Suppresses verbose backend tracebacks, returning clean JSON errors to clients to prevent system configuration leaks.
8.  **Action Audit Logging:** Logs system events in an `audit_logs` collection with timezone-aware UTC timestamps.

---

## 🚀 Setup & Execution Guide

### Prerequisites
*   Node.js (v18+)
*   Python (v3.10+)
*   MongoDB Atlas Account

### 1. Start Backend Server
1.  Navigate to the backend folder:
    ```bash
    cd backend
    ```
2.  Set up the Python virtual environment:
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure your environment variables in `backend/.env`:
    ```env
    MONGODB_URI=your_mongodb_atlas_connection_string
    JWT_SECRET_KEY=your_secret_key
    ```
5.  Start the FastAPI server:
    ```bash
    uvicorn main:app --reload
    ```

### 2. Start Frontend Server
1.  Navigate to the frontend folder:
    ```bash
    cd Frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:5173` in your browser.

---
*For investigational and clinical support demonstration purposes only.*
