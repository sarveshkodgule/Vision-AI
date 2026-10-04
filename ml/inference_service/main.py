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
from contextlib import asynccontextmanager
import logging
from starlette.concurrency import run_in_threadpool

# Ensure ml/ is on the path so predictor.py can import preprocessing.py
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

if __package__:
    from . import predictor, gradcam
else:
    import predictor
    import gradcam


@asynccontextmanager
async def lifespan(app):
    try:
        await run_in_threadpool(predictor._get_session)
        await run_in_threadpool(gradcam.initialize)
    except Exception:
        logging.exception('Model initialization failed; readiness and explanation requests will fail.')
    try:
        yield
    finally:
        gradcam.shutdown()

app = FastAPI(
    lifespan=lifespan,
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
        await run_in_threadpool(predictor._get_session)
        gradcam.require_ready()
        return {"status": "ok", "model": "palm_efficientnet_b0.onnx"}
    except FileNotFoundError as e:
        return JSONResponse(
            status_code=503,
            content={"status": "model_not_found", "detail": str(e)},
        )


@app.post("/predict")
async def predict(file: UploadFile = File(...), explain: bool = Form(False)):
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

    image_bytes = await file.read(10 * 1024 * 1024 + 1)
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be at most 10 MB")
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Empty file received.")

    try:
        result = await run_in_threadpool(predictor.predict, image_bytes)
        if explain:
            result["gradcam"] = await run_in_threadpool(gradcam.explain, image_bytes, result["label"])
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
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
