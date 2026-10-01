"""Patient risk assessment — powered by XGBoost ML model.
Uses ONLY lifestyle factors to provide a patient-friendly screening.
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime
import time
from typing import Optional, Tuple, Any, Dict

from fastapi import HTTPException
from schemas.patient import PatientRiskInput
from database.mongodb import patients_collection

MODELS_DIR = Path(__file__).parent.parent / "models"

# ── Lazy model loading ───────────────────────────────────────────────────────
_clf_pat: Any = None
_scaler_pat: Any = None

def _load_patient_models() -> bool:
    global _clf_pat, _scaler_pat
    if _clf_pat is not None and _scaler_pat is not None:
        return True
    try:
        import joblib
        _clf_pat    = joblib.load(MODELS_DIR / "detection_patient.pkl")
        _scaler_pat = joblib.load(MODELS_DIR / "scaler_patient.pkl")
        return True
    except Exception as e:
        print(f"[ML-Patient] Load error: {e}")
        return False


def _ml_predict(data: PatientRiskInput) -> Optional[Tuple[str, str, float, Optional[float]]]:
    import numpy as np
    import pandas as pd
    if not _load_patient_models():
        raise HTTPException(status_code=503, detail="Patient model unavailable")
        
    try:
        # Patient Features: [age, gender_idx, reading, screen, outdoor, sleep, parental]
        gender_idx = 1.0 if str(data.gender).lower() == "female" else 0.0
        X = np.array([[
            float(data.age),
            gender_idx,
            float(data.reading_time),
            float(data.screen_time),
            float(data.outdoor_activity),
            float(data.sleep_hours),
            float(data.parental_myopia)
        ]])

        X_scaled = _scaler_pat.transform(pd.DataFrame(X, columns=_scaler_pat.feature_names_in_))
        probability = float(_clf_pat.predict_proba(X_scaled)[0][1])

        if probability >= 0.70:
            risk, rec = "High", "High probability based on lifestyle factors. Clinical exam recommended."
        elif probability >= 0.40:
            risk, rec = "Medium", "Moderate risk. Balance screen time with outdoor activities."
        else:
            risk, rec = "Low", "Low lifestyle risk. Continue healthy habits."

        return risk, rec, float(round(probability, 4)), None # No progression model is run for lifestyle-only screening

    except Exception as e:
        print(f"[ML-Patient] Prediction error: {e}")
        raise HTTPException(status_code=503, detail="Patient model inference failed") from e


def calculate_risk(data: PatientRiskInput) -> Tuple[str, str, float, Optional[float]]:
    return _ml_predict(data)


async def assess_patient_risk(user_id: str, data: PatientRiskInput):
    risk_level, recommendation, probability, next_spheq = calculate_risk(data)

    patient_record = data.model_dump()
    patient_record["user_id"]              = user_id
    patient_record["prediction_source"] = "detection_patient.pkl"
    patient_record["risk_level"]           = risk_level
    patient_record["recommendation"]       = recommendation
    patient_record["myopia_probability"]   = probability
    patient_record["predicted_next_spheq"] = next_spheq
    patient_record["myopia_detected"]      = probability >= 0.5
    patient_record["created_at"]           = datetime.now().isoformat()
    # assigned_doctor_id is already in data.model_dump() from the schema field

    patient_record["report_email"] = {"status": "queued", "updated_at": time.time()}
    inserted = await patients_collection.insert_one(patient_record)

    # ── Send high-risk email alert to assigned doctor (best-effort) ──────────
    if risk_level == "High" and data.assigned_doctor_id:
        try:
            from database.mongodb import users_collection
            from bson import ObjectId
            from services.email_service import send_high_risk_alert
            import asyncio
            doc = await users_collection.find_one({"_id": ObjectId(data.assigned_doctor_id)})
            if doc and doc.get("email"):
                # Fire-and-forget in a thread (smtplib is blocking)
                loop = asyncio.get_event_loop()
                loop.run_in_executor(
                    None,
                    send_high_risk_alert,
                    doc["email"],
                    doc.get("name", "Doctor"),
                    data.name,
                    data.age,
                    probability
                )
        except Exception as e:
            print(f"[Email] Alert skipped: {e}")

    return {
        "screening_id": str(inserted.inserted_id),
        "report_email": patient_record["report_email"],
        "risk_level":           risk_level,
        "recommendation":       recommendation,
        "myopia_probability":   probability,
        "myopia_detected":      probability >= 0.5,
        "predicted_next_spheq": next_spheq,
    }


async def get_patient_history(user_id: str) -> list:
    """
    Returns all past screenings for a given patient (by user_id), newest first.
    Used to display screening history in the Patient Dashboard.
    """
    cursor = patients_collection.find(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )
    records = await cursor.to_list(length=50)
    result = []
    for r in records:
        r["id"] = str(r.pop("_id", ""))
        result.append(r)
    return result
