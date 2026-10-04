"""
gradcam.py — Reusable Grad-CAM and Grad-CAM++ explainability (XAI) engine
for the PALM-only EfficientNet-B0 Pathologic Myopia classifier.

Supports:
  - Grad-CAM (Selvaraju et al., 2017)
  - Grad-CAM++ (Chattopadhay et al., 2018)
  - Full heatmap upsampling & publication-ready overlay generation
  - Exact spatial mapping aligning with preprocessing bounding-box crop
"""

from __future__ import annotations

import os
import sys
from typing import Optional, Tuple, Union

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

# Add ml/ directory to path
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from model import build_model
from preprocessing import _to_bgr, _apply_clahe, _crop_black_border, TARGET_SIZE, _MEAN, _STD

DEFAULT_CHECKPOINT = os.path.join(_ML_DIR, "checkpoints", "best_overall.pth")


class GradCAMBase:
    """Base class for Gradient-weighted Class Activation Mapping."""

    def __init__(self, model: nn.Module, target_layer: Optional[nn.Module] = None, device: Optional[torch.device] = None):
        self.model = model
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device).eval()

        # Default target layer is the final 1x1 conv layer before global pooling
        # In torchvision EfficientNet-B0, this is model.features[-1] (index 8)
        self.target_layer = target_layer or self.model.features[-1]

        self.activations: Optional[torch.Tensor] = None
        self.gradients: Optional[torch.Tensor] = None

        # Register forward and backward hooks
        self._fwd_hook = self.target_layer.register_forward_hook(self._save_activations)
        self._bwd_hook = self.target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, inp, out):
        self.activations = out.detach()

    def _save_gradients(self, module, grad_in, grad_out):
        self.gradients = grad_out[0].detach()

    def remove_hooks(self):
        self._fwd_hook.remove()
        self._bwd_hook.remove()

    def __del__(self):
        try:
            self.remove_hooks()
        except Exception:
            pass


class GradCAM(GradCAMBase):
    """Grad-CAM implementation (Selvaraju et al., 2017)."""

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class: Optional[int] = None,
    ) -> Tuple[np.ndarray, int, float]:
        """
        Generate Grad-CAM heatmap for a single image tensor [1, 3, 224, 224].

        Returns
        -------
        heatmap : np.ndarray
            2D float32 array in [0, 1] of shape (224, 224).
        pred_class : int
            Predicted class index (0 = Non-PM, 1 = PM).
        confidence : float
            Softmax probability for the predicted class.
        """
        input_tensor = input_tensor.to(self.device)
        self.model.zero_grad()

        # Enable grad for backward pass
        with torch.enable_grad():
            input_tensor.requires_grad_(True)
            logits = self.model(input_tensor)
            probs = F.softmax(logits, dim=1)
            pred_class = int(logits.argmax(dim=1).item())
            confidence = float(probs[0, pred_class].item())

            target_idx = target_class if target_class is not None else pred_class
            score = logits[0, target_idx]
            score.backward(retain_graph=True)

        # Activations A: [1, C, H, W]
        # Gradients dY/dA: [1, C, H, W]
        grads = self.gradients[0]       # [C, H, W]
        acts = self.activations[0]      # [C, H, W]

        # Global average pool gradients -> channel weights alpha_k
        alpha = grads.mean(dim=(1, 2), keepdim=True)  # [C, 1, 1]

        # Weighted combination of feature maps
        cam = torch.sum(alpha * acts, dim=0)          # [H, W]
        cam = F.relu(cam)                             # ReLU: only positive contributions

        # Normalize to [0, 1]
        cam_np = cam.cpu().numpy()
        cam_max = cam_np.max()
        cam_min = cam_np.min()
        if cam_max - cam_min > 1e-8:
            cam_norm = (cam_np - cam_min) / (cam_max - cam_min)
        else:
            cam_norm = np.zeros_like(cam_np)

        # Resize to input spatial resolution (224, 224)
        heatmap = cv2.resize(cam_norm, (input_tensor.shape[3], input_tensor.shape[2]), interpolation=cv2.INTER_LINEAR)
        return heatmap, pred_class, confidence


class GradCAMPP(GradCAMBase):
    """Grad-CAM++ implementation (Chattopadhay et al., 2018)."""

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class: Optional[int] = None,
    ) -> Tuple[np.ndarray, int, float]:
        """
        Generate Grad-CAM++ heatmap using higher-order gradients.
        """
        input_tensor = input_tensor.to(self.device)
        self.model.zero_grad()

        with torch.enable_grad():
            input_tensor.requires_grad_(True)
            logits = self.model(input_tensor)
            probs = F.softmax(logits, dim=1)
            pred_class = int(logits.argmax(dim=1).item())
            confidence = float(probs[0, pred_class].item())

            target_idx = target_class if target_class is not None else pred_class
            score = logits[0, target_idx]
            score.backward(retain_graph=True)

        grads = self.gradients[0]       # [C, H, W]
        acts = self.activations[0]      # [C, H, W]

        # Grad-CAM++ closed-form weighting
        # w^kc_ij = (d^2 Y / dA^2) / (2 * d^2 Y / dA^2 + sum(A * d^3 Y / dA^3) + eps)
        # For piecewise linear models (ReLU/SiLU), d^2 Y / dA^2 ≈ grads^2, d^3 Y / dA^3 ≈ grads^3
        grads_power_2 = grads ** 2
        grads_power_3 = grads ** 3
        sum_acts = acts.sum(dim=(1, 2), keepdim=True)

        eps = 1e-7
        denom = 2.0 * grads_power_2 + sum_acts * grads_power_3
        denom = torch.where(denom != 0.0, denom, torch.ones_like(denom) * eps)

        aij = grads_power_2 / denom
        aij = torch.where(grads != 0.0, aij, torch.zeros_like(aij))

        # Channel weights alpha_k = sum_ij ( aij * ReLU(grads) )
        weights = torch.maximum(grads, torch.zeros_like(grads)) * aij
        alpha = weights.sum(dim=(1, 2), keepdim=True)  # [C, 1, 1]

        cam = torch.sum(alpha * acts, dim=0)
        cam = F.relu(cam)

        cam_np = cam.cpu().numpy()
        cam_max = cam_np.max()
        cam_min = cam_np.min()
        if cam_max - cam_min > 1e-8:
            cam_norm = (cam_np - cam_min) / (cam_max - cam_min)
        else:
            cam_norm = np.zeros_like(cam_np)

        heatmap = cv2.resize(cam_norm, (input_tensor.shape[3], input_tensor.shape[2]), interpolation=cv2.INTER_LINEAR)
        return heatmap, pred_class, confidence


# ── Helper functions for spatial registration and visualization ──────────────

def preprocess_with_crop_coords(source: Union[str, np.ndarray, Image.Image]) -> Tuple[torch.Tensor, np.ndarray, Tuple[int, int, int, int]]:
    """
    Apply standard preprocessing while tracking exact crop coordinates (x, y, w, h)
    so ground-truth segmentation masks can be spatially aligned with the heatmap.

    Returns
    -------
    tensor : torch.Tensor
        [1, 3, 224, 224] normalised model input.
    cropped_bgr : np.ndarray
        (224, 224, 3) uint8 image before normalisation (for visualization).
    crop_box : (x, y, w, h)
        Bounding box of the black border crop on the raw image.
    """
    if isinstance(source, str):
        raw_bgr = cv2.imread(source)
        if raw_bgr is None:
            raise FileNotFoundError(f"Cannot read image: {source}")
    else:
        raw_bgr = _to_bgr(source)

    # Detect black border bounding box
    gray = cv2.cvtColor(raw_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    img_area = raw_bgr.shape[0] * raw_bgr.shape[1]
    if contours:
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)
        if w * h < 0.50 * img_area:
            x, y, w, h = 0, 0, raw_bgr.shape[1], raw_bgr.shape[0]
    else:
        x, y, w, h = 0, 0, raw_bgr.shape[1], raw_bgr.shape[0]

    cropped = raw_bgr[y : y + h, x : x + w]
    enhanced = _apply_clahe(cropped)
    resized_bgr = cv2.resize(enhanced, (TARGET_SIZE, TARGET_SIZE), interpolation=cv2.INTER_LINEAR)

    # Normalise
    rgb = cv2.cvtColor(resized_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    norm = (rgb - _MEAN) / _STD
    tensor = torch.from_numpy(norm.transpose(2, 0, 1)).unsqueeze(0)  # [1, 3, 224, 224]

    return tensor, resized_bgr, (x, y, w, h)


def align_mask_to_model_space(raw_mask: np.ndarray, crop_box: Tuple[int, int, int, int], target_size: int = TARGET_SIZE) -> np.ndarray:
    """
    Crop the raw ground-truth segmentation mask using the exact same bounding box
    as the fundus photo, and resize to (target_size, target_size) with nearest-neighbour interpolation.
    """
    x, y, w, h = crop_box
    cropped = raw_mask[y : y + h, x : x + w]
    resized = cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_NEAREST)
    return (resized == 0).astype(np.uint8)


def overlay_heatmap_on_image(
    bgr_img: np.ndarray,
    heatmap: np.ndarray,
    alpha: float = 0.5,
    colormap: int = cv2.COLORMAP_JET,
) -> np.ndarray:
    """
    Overlay a [0, 1] float32 heatmap on a uint8 BGR image.
    Returns RGB uint8 image for display/saving.
    """
    cam_uint8 = np.uint8(255 * heatmap)
    colored_cam = cv2.applyColorMap(cam_uint8, colormap)
    blend_bgr = cv2.addWeighted(bgr_img, 1.0 - alpha, colored_cam, alpha, 0)
    return cv2.cvtColor(blend_bgr, cv2.COLOR_BGR2RGB)


def load_baseline_model(checkpoint_path: str = DEFAULT_CHECKPOINT, device: Optional[torch.device] = None) -> nn.Module:
    """Load the confirmed production PALM-only baseline model."""
    device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(num_classes=2)
    ckpt = torch.load(checkpoint_path, map_location=device)
    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        model.load_state_dict(ckpt["model_state_dict"])
    else:
        model.load_state_dict(ckpt)
    model.to(device).eval()
    return model
