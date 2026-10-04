"""Service adapter for the validated PALM Grad-CAM++ research engine.

Retains the public gradcam field used by the dashboard and reports.
"""
import base64
import hashlib
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
from xai.gradcam import GradCAMPP, load_baseline_model, preprocess_with_crop_coords, overlay_heatmap_on_image

CHECKPOINT = Path(__file__).resolve().parents[1] / 'checkpoints' / 'best_overall.pth'
_cam = None
_error = 'Grad-CAM++ has not been initialized.'
_lock = Lock()
_checkpoint_sha256 = None


def initialize():
    """Load once per worker at application startup."""
    global _cam, _error, _checkpoint_sha256
    with _lock:
        if _cam is not None:
            return
        try:
            if not CHECKPOINT.is_file():
                raise FileNotFoundError(f'Missing explanation checkpoint: {CHECKPOINT}')
            _checkpoint_sha256 = hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest()
            _cam = GradCAMPP(load_baseline_model(str(CHECKPOINT)))
            _error = None
        except Exception as exc:
            _error = f'Grad-CAM++ initialization failed: {exc}'
            raise


def require_ready():
    if _cam is None:
        raise FileNotFoundError(_error or 'Grad-CAM++ is unavailable.')


def shutdown():
    global _cam
    with _lock:
        if _cam is not None:
            _cam.remove_hooks()
            _cam = None


def _png_uri(rgb):
    ok, encoded = cv2.imencode('.png', cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise RuntimeError('Unable to encode explanation image')
    return 'data:image/png;base64,' + base64.b64encode(encoded).decode('ascii')


def explain(image_bytes, target_class=None):
    require_ready()
    if target_class is not None and target_class not in (0, 1):
        raise ValueError('Target class must be 0 or 1')
    tensor, bgr, crop = preprocess_with_crop_coords(image_bytes)
    # Hooks and gradients are shared; serialize forward/backward passes.
    with _lock:
        require_ready()
        try:
            heat, predicted, _ = _cam.generate(tensor, target_class=target_class)
            feature_shape = list(_cam.activations.shape)
        finally:
            _cam.model.zero_grad(set_to_none=True)
            _cam.activations = None
            _cam.gradients = None
    if not np.isfinite(heat).all():
        raise RuntimeError('Grad-CAM++ generated non-finite attribution')
    target = predicted if target_class is None else target_class
    return {
        'method': 'Grad-CAM++', 'target_class': target,
        'target_label': {0: 'Non-PM', 1: 'PM'}[target],
        'layer': 'features.8', 'feature_shape': feature_shape,
        'heatmap': heat.tolist(), 'has_positive_attribution': bool(heat.max() > 0),
        'overlay': _png_uri(overlay_heatmap_on_image(bgr, heat, alpha=0.5)),
        'model_input': _png_uri(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)),
        'crop_box': list(crop),
        'image_sha256': hashlib.sha256(image_bytes).hexdigest(),
        'checkpoint_sha256': _checkpoint_sha256,
        'note': 'Grad-CAM++ on the cropped, preprocessed input; not a lesion boundary.',
    }
