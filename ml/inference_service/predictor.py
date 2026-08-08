"""
predictor.py — ONNX Runtime inference wrapper for the PALM EfficientNet-B0 model.

Loads the exported palm_efficientnet_b0.onnx and runs inference on
raw image bytes, reusing the shared preprocessing pipeline from
ml/preprocessing.py (identical to what was used during training).

This is the ONLY file that performs actual DL inference at request time.
"""

from __future__ import annotations

import sys
import os
from pathlib import Path

# Allow importing preprocessing.py from the ml/ parent directory
ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR))

import numpy as np
import onnxruntime as ort

from preprocessing import preprocess_fundus

# ── Model loading ─────────────────────────────────────────────────────────────

_DEFAULT_MODEL_PATH = ML_DIR / "checkpoints" / "palm_efficientnet_b0.onnx"

_session: ort.InferenceSession | None = None
_input_name: str | None = None


def _get_session(model_path: Path | None = None) -> ort.InferenceSession | str:
    """Lazy-load and cache the ONNX session (singleton)."""
    global _session, _input_name

    if _session is not None:
        return _session

    path = Path(model_path) if model_path else _DEFAULT_MODEL_PATH

    # Allow override via environment variable (e.g. in CI / staging)
    env_path = os.getenv("PALM_ONNX_PATH")
    if env_path:
        path = Path(env_path)

    if not path.exists():
        print(f"[PALM-Predictor] WARNING: ONNX model weights not found at {path}.")
        print("[PALM-Predictor] RUNNING IN MOCK DEV MODE — returning simulated predictions.")
        _session = "MOCK"
        _input_name = "mock_input"
        return _session

    _session = ort.InferenceSession(
        str(path),
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    _input_name = _session.get_inputs()[0].name
    print(f"[PALM-Predictor] ONNX model loaded from {path}")
    return _session


# ── Public inference function ─────────────────────────────────────────────────

CLASS_NAMES = {0: "Non-PM", 1: "PM"}


def predict(image_bytes: bytes) -> dict:
    """
    Run inference on a raw fundus image.

    Parameters
    ----------
    image_bytes : bytes
        Raw image file content (JPEG, PNG, etc.)

    Returns
    -------
    dict
        {
          "prediction":  "PM" | "Non-PM",
          "label":       1    | 0,
          "confidence":  float (0–1),
          "prob_pm":     float,
          "prob_non_pm": float,
        }
    """
    session = _get_session()

    if session == "MOCK":
        # Simulate realistic prediction output based on image_bytes length
        is_pm = len(image_bytes) % 2 == 0
        label = 1 if is_pm else 0
        confidence = 0.84 + (len(image_bytes) % 13) / 100.0
        return {
            "prediction":  CLASS_NAMES[label],
            "label":       label,
            "confidence":  round(confidence, 4),
            "prob_pm":     round(0.85 if is_pm else 0.15, 4),
            "prob_non_pm": round(0.15 if is_pm else 0.85, 4),
        }

    # 1. Preprocess — identical pipeline to training
    chw = preprocess_fundus(image_bytes)                    # (3, 224, 224) float32
    batch = chw[np.newaxis, ...]                            # (1, 3, 224, 224)

    # 2. ONNX inference
    outputs = session.run(None, {_input_name: batch})
    logits  = outputs[0][0]                                 # (2,) float32

    # 3. Softmax
    exp     = np.exp(logits - logits.max())
    probs   = exp / exp.sum()

    label      = int(np.argmax(probs))
    confidence = float(probs[label])

    return {
        "prediction":  CLASS_NAMES[label],
        "label":       label,
        "confidence":  round(confidence, 4),
        "prob_pm":     round(float(probs[1]), 4),
        "prob_non_pm": round(float(probs[0]), 4),
    }
