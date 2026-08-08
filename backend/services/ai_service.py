"""Doctor-side AI Diagnostics — powered by Clinical ML and EfficientNet-B0 Deep Learning.

Fundus image analysis:
  predict_fundus_palm()         — calls the PALM EfficientNet-B0 inference service (port 8001)
  (replaces the retired FundusCNN placeholder that used random weights)

Clinical biometry analysis:
  predict_clinical_evaluation() — XGBoost model on doctor-entered biometry (unchanged)
"""
import os
from pathlib import Path
from typing import Any, Dict
import numpy as np
import httpx

MODELS_DIR = Path(__file__).parent.parent / "models"

# ── PALM Inference Service (EfficientNet-B0) ─────────────────────────────────
# The trained model runs as a separate FastAPI service on port 8001.
# Start it with:  uvicorn ml.inference_service.main:app --port 8001

PALM_SERVICE_URL = os.getenv("PALM_SERVICE_URL", "http://127.0.0.1:8001")


async def predict_fundus_palm(image_bytes: bytes) -> dict:
    """
    Call the PALM EfficientNet-B0 inference microservice and return the result.

    Returns a dict with keys:
        fundus_pm_prediction : "PM" | "Non-PM" | "Service Unavailable"
        fundus_pm_confidence : float  (0.0 – 1.0)
        fundus_pm_label      : int    (1=PM, 0=Non-PM, -1=error)
    """
    # Skip HTTP call if we only have a dummy/empty image
    if not image_bytes or image_bytes == b"dummy":
        return {
            "fundus_pm_prediction": "No Image",
            "fundus_pm_confidence": 0.0,
            "fundus_pm_label": -1,
        }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{PALM_SERVICE_URL}/predict",
                files={"file": ("fundus.jpg", image_bytes, "image/jpeg")},
            )
            response.raise_for_status()
            body = response.json()
            data = body.get("data", body)   # handle {status, data, ...} wrapper
            return {
                "fundus_pm_prediction": data.get("prediction", "Unknown"),
                "fundus_pm_confidence": float(data.get("confidence", 0.0)),
                "fundus_pm_label":      int(data.get("label", -1)),
            }
    except httpx.ConnectError:
        print("[PALM-Service] Connection refused — is the inference service running on :8001?")
    except httpx.TimeoutException:
        print("[PALM-Service] Request timed out after 30s.")
    except Exception as e:
        print(f"[PALM-Service] Unexpected error: {e}")

    # Graceful fallback — backend continues to work even if PALM service is down
    return {
        "fundus_pm_prediction": "Service Unavailable",
        "fundus_pm_confidence": 0.0,
        "fundus_pm_label": -1,
    }


# ── Lazy loading for doctor clinical model ───────────────────────────────────
_clf_doc: Any = None
_reg_prog: Any = None
_scaler_doc: Any = None
_scaler_prog: Any = None

def _load_doctor_models():
    global _clf_doc, _reg_prog, _scaler_doc, _scaler_prog
    if _clf_doc is not None:
        return True
    try:
        import joblib
        _clf_doc     = joblib.load(MODELS_DIR / "detection_doctor.pkl")
        _scaler_doc  = joblib.load(MODELS_DIR / "scaler_doctor.pkl")
        _reg_prog    = joblib.load(MODELS_DIR / "progression_model.pkl")
        _scaler_prog = joblib.load(MODELS_DIR / "scaler_progression.pkl")
        return True
    except Exception as e:
        print(f"[AI-Doctor] Load error: {e}")
        return False

def predict_clinical_evaluation(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates REAL-TIME clinical biometry provided by the doctor.
    Accepts both alias names: axial_length/al, refractive_error/spheq, reading_hours/reading_time.
    """
    # Support both ClinicalDataInput schema names AND direct field names
    al    = float(data.get("axial_length") or data.get("al") or 23.5)
    spheq = float(data.get("refractive_error") or data.get("spheq") or -1.0)
    reading = float(data.get("reading_hours") or data.get("reading_time") or 1.5)

    if not _load_doctor_models():
        return {
            "severity": "Moderate",
            "confidence": 0.5,
            "predicted_next_spheq": round(spheq - 0.5, 2),
            "progression_rate": "Low",
            "prediction": "Myopia Severity: Moderate (50.0%)"
        }
        
    try:
        gender_idx = 1.0 if str(data.get("gender", "")).lower() == "female" else 0.0
        
        # Features: [age, gender_idx, reading, screen, outdoor, sleep, parental, al, acd, lt, vcd, spheq, visit_year]
        X_doc = np.array([[
            float(data.get("age", 20)),
            gender_idx,
            reading,
            float(data.get("screen_time", 2)),
            float(data.get("outdoor_activity", 2)),
            float(data.get("sleep_hours", 8)),
            float(data.get("parental_myopia", 0)),
            al,
            float(data.get("acd", 3.5)),
            float(data.get("lt", 4.0)),
            float(data.get("vcd", 16.0)),
            spheq,
            float(data.get("visit_year", 2024))
        ]])
        
        # Detection
        X_doc_s = _scaler_doc.transform(X_doc)
        probability = float(_clf_doc.predict_proba(X_doc_s)[0][1])
        
        if probability >= 0.70: severity = "High"
        elif probability >= 0.40: severity = "Moderate"
        else: severity = "Low"
        
        # Progression: [age, gender_idx, spheq, al, reading, screen, outdoor]
        X_prog = np.array([[
            float(data.get("age", 20)),
            gender_idx,
            spheq,
            al,
            reading,
            float(data.get("screen_time", 2)),
            float(data.get("outdoor_activity", 2))
        ]])
        X_prog_s = _scaler_prog.transform(X_prog)
        next_spheq = float(_reg_prog.predict(X_prog_s)[0])
        
        # Progression rate
        diff = next_spheq - spheq
        if diff < -0.75: rate = "High"
        elif diff < -0.25: rate = "Normal"
        else: rate = "Low"
        
        return {
            "severity": severity,
            "confidence": round(probability, 3),
            "predicted_next_spheq": round(next_spheq, 2),
            "progression_rate": rate,
            "prediction": f"Myopia Severity: {severity} ({probability*100:.1f}%)"
        }
        
    except Exception as e:
        print(f"[AI-Doctor] Inference error: {e}")
        return {
            "severity": "Low",
            "confidence": 0.0,
            "predicted_next_spheq": round(spheq - 0.25, 2),
            "progression_rate": "Low",
            "prediction": "Error"
        }

