"""
preprocessing.py — Shared fundus image preprocessing pipeline.

This is the SINGLE source of truth for all image preprocessing in this project.
It is imported identically by:
  - ml/dataset.py       (training & evaluation)
  - ml/evaluate.py      (standalone evaluation)
  - ml/inference_service/predictor.py  (live inference)

Pipeline:
  1. Decode input (bytes | PIL.Image | np.ndarray) → BGR uint8 numpy
  2. Crop black borders (find largest circular ROI in the image)
  3. CLAHE contrast enhancement on L-channel of LAB colour space
  4. Resize to 224×224 (EfficientNet-B0 native input size)
  5. Convert BGR → RGB, normalise with ImageNet mean/std as float32
  6. Return CHW float32 numpy array (ready to wrap in torch.tensor)
"""

from __future__ import annotations

import io
import cv2
import numpy as np
from PIL import Image
from typing import Union

# ImageNet normalisation constants
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

TARGET_SIZE = 224  # EfficientNet-B0 native input


# ── helpers ──────────────────────────────────────────────────────────────────

def _to_bgr(source: Union[bytes, "Image.Image", np.ndarray]) -> np.ndarray:
    """Convert any supported input to a BGR uint8 numpy array."""
    if isinstance(source, bytes):
        arr = np.frombuffer(source, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes.")
        return img
    if isinstance(source, Image.Image):
        return cv2.cvtColor(np.array(source.convert("RGB")), cv2.COLOR_RGB2BGR)
    if isinstance(source, np.ndarray):
        if source.ndim == 2:                       # grayscale
            return cv2.cvtColor(source, cv2.COLOR_GRAY2BGR)
        if source.shape[2] == 4:                   # RGBA
            return cv2.cvtColor(source, cv2.COLOR_RGBA2BGR)
        return source.copy()
    raise TypeError(f"Unsupported input type: {type(source)}")


def _crop_black_border(img: np.ndarray) -> np.ndarray:
    """
    Remove the dark circular border typical of fundus photographs.

    Strategy:
      - Convert to greyscale, threshold at a low value.
      - Find the largest external contour (the fundus circle).
      - Crop the image to the bounding rectangle of that contour.
    Falls back to returning the original image if no suitable contour is found.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)

    # Morphological close to fill small holes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img

    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)

    # Sanity-check: crop must cover at least 50% of image area
    img_area = img.shape[0] * img.shape[1]
    if w * h < 0.50 * img_area:
        return img

    return img[y : y + h, x : x + w]


def _apply_clahe(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE on the L-channel of LAB colour space."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


# ── public API ────────────────────────────────────────────────────────────────

def preprocess_fundus(
    source: Union[bytes, "Image.Image", np.ndarray],
    target_size: int = TARGET_SIZE,
) -> np.ndarray:
    """
    Full preprocessing pipeline for a single fundus image.

    Parameters
    ----------
    source : bytes | PIL.Image.Image | np.ndarray
        Raw image in any supported format.
    target_size : int
        Square output dimension (default 224 for EfficientNet-B0).

    Returns
    -------
    np.ndarray
        Float32 array of shape (3, target_size, target_size) in CHW format,
        normalised with ImageNet mean/std.  Ready for torch.tensor().
    """
    img = _to_bgr(source)
    img = _crop_black_border(img)
    img = _apply_clahe(img)
    img = cv2.resize(img, (target_size, target_size), interpolation=cv2.INTER_LINEAR)

    # BGR → RGB, scale to [0, 1], normalise
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    img_norm = (img_rgb - _MEAN) / _STD          # HWC float32

    # HWC → CHW
    return img_norm.transpose(2, 0, 1)           # (3, H, W)
