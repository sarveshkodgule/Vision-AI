# Teammate Setup Guide — Vision-AI Myopia DL Module

Welcome! The **Pathologic Myopia Deep Learning Prediction module** (EfficientNet-B0 trained on the PALM dataset) has been merged into `main`. Follow these steps to run the complete stack on your local machine.

---

## 1. Pull the Latest Code

Make sure your local `main` branch is up to date:

```bash
git checkout main
git pull origin main
```

---

## 2. Install Required Dependencies

Run these commands to install the new backend, machine learning, and frontend dependencies:

```bash
# 1. Main backend dependencies (includes httpx, email-validator, etc.)
pip install -r backend/requirements.txt

# 2. DL Inference service dependencies (lightweight ONNX runtime)
pip install -r ml/inference_service/requirements.txt

# 3. Frontend dependencies
cd Frontend
npm install
cd ..
```

---

## 3. Place Model Weights & Dataset

Because large binary files are excluded from Git repository tracking:

1. **ONNX Model Weights:** Obtain the `palm_efficientnet_b0.onnx` file from your teammate and place it in:
   ```
   ml/checkpoints/palm_efficientnet_b0.onnx
   ```
2. **PALM Dataset (Optional for retraining):** If you wish to run `python ml/train.py`, place the extracted PALM dataset in:
   ```
   backend/DL dataset/PALM/PALM/
   ```

---

## 4. Run the Stack (3 Terminals)

Open **3 separate terminals** in the project root directory (`Vision-AI/`):

### Terminal 1 — PALM Prediction Microservice (Port 8001)
```bash
python -m uvicorn ml.inference_service.main:app --port 8001
```

### Terminal 2 — Main Backend Server (Port 8000)
```bash
cd backend
python -m uvicorn main:app --port 8000 --reload
```

### Terminal 3 — React Frontend Dev Server (Port 5173)
```bash
cd Frontend
npm run dev
```

---

## 5. How to Test the Integration

1. Open your browser and go to [http://localhost:5173](http://localhost:5173).
2. **Register a Doctor Account:** Go to Sign Up and create an account with the role **Doctor**.
3. **Register / Log in as a Patient:** Fill in lifestyle factors and assign your registered doctor.
4. **Log in as Doctor:**
   - Select the patient from your dashboard.
   - Fill in optical biometry or upload a fundus scan (`.jpg`).
   - Click **Synthesize Factors & Evaluate**.
5. You will see both the **XGBoost Clinical Evaluation** and the **PALM EfficientNet-B0 Fundus Analysis Card** live on the screen!
