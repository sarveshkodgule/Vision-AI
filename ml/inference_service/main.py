"""
main.py — FastAPI inference service for PALM EfficientNet-B0.

Runs on port 8001 (main backend is on 8000).

Endpoints:
  GET  /health   → {"status": "ok", "model": "palm_efficientnet_b0.onnx"}
  POST /predict  → multipart image → {prediction, confidence, label, prob_pm, prob_non_pm}

Start with:
  uvicorn ml.inference_service.main:app --port 8001 --reload
  OR from inside ml/inference_service/:
  uvicorn main:app --port 8001 --reload
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure ml/ is on the path so predictor.py can import preprocessing.py
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import predictor

app = FastAPI(
    title="PALM Myopia Prediction Service",
    description=(
        "EfficientNet-B0 inference service for binary Pathologic Myopia detection. "
        "Trained on the PALM dataset (1,200 fundus images). "
        "⚠ Trained on PALM only — clinical validation pending."
    ),
    version="1.0.0",
)

# Allow calls from the main backend (127.0.0.1:8000) and frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000",
                   "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Liveness check — also confirms the ONNX model can be loaded."""
    try:
        predictor._get_session()   # will raise if model file missing
        return {"status": "ok", "model": "palm_efficientnet_b0.onnx"}
    except FileNotFoundError as e:
        return JSONResponse(
            status_code=503,
            content={"status": "model_not_found", "detail": str(e)},
        )


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Accepts a fundus image (JPEG/PNG), returns PM vs Non-PM prediction.

    Response schema:
      {
        "prediction":  "PM" | "Non-PM",
        "label":       1 | 0,
        "confidence":  float,   // confidence in predicted class
        "prob_pm":     float,   // raw probability of Pathologic Myopia
        "prob_non_pm": float    // raw probability of Non-PM
      }
    """
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=f"Expected an image file, got content-type: {content_type}"
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Empty file received.")

    try:
        result = predictor.predict(image_bytes)
        return {
            "status": "success",
            "data": result,
            "disclaimer": (
                "Model trained on PALM dataset (1,200 fundus images). "
                "Pathologic Myopia binary classification only. "
                "Not validated for general clinical use."
            ),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
