"""
model.py — EfficientNet-B0 classifier for PALM binary fundus classification.

Architecture:
  Backbone : torchvision EfficientNet-B0 (ImageNet pretrained)
  Head     : Dropout(0.4) → Linear(1280, 2)

Two-stage transfer learning helpers:
  freeze_backbone(model)          → freeze entire backbone, train head only
  unfreeze_last_blocks(model, n)  → unfreeze the last n MBConv block groups
  unfreeze_all(model)             → unfreeze everything (not recommended on 400 imgs)
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights


def build_model(num_classes: int = 2, dropout: float = 0.4) -> nn.Module:
    """
    Build an EfficientNet-B0 model with a custom classification head.

    Parameters
    ----------
    num_classes : int
        Number of output classes (2 for PM / Non-PM).
    dropout : float
        Dropout probability before the final linear layer.

    Returns
    -------
    nn.Module
        Model with ImageNet-pretrained backbone and randomly initialised head.
    """
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)

    # Replace the default classifier head
    in_features = model.classifier[1].in_features   # 1280 for EfficientNet-B0
    model.classifier = nn.Sequential(
        nn.Dropout(p=dropout, inplace=True),
        nn.Linear(in_features, num_classes),
    )
    return model


# ── Two-stage training helpers ───────────────────────────────────────────────

def freeze_backbone(model: nn.Module) -> None:
    """
    Stage 1: Freeze ALL backbone parameters — only the classifier head trains.
    """
    for param in model.features.parameters():
        param.requires_grad = False
    for param in model.classifier.parameters():
        param.requires_grad = True


def unfreeze_last_blocks(model: nn.Module, n: int = 2) -> None:
    """
    Stage 2: Unfreeze the last n MBConv block groups in EfficientNet-B0's
    features Sequential.

    EfficientNet-B0 `features` has 9 children (indices 0–8):
      0 = Conv stem
      1 = MBConv stage 1
      2 = MBConv stage 2
      3 = MBConv stage 3
      4 = MBConv stage 4
      5 = MBConv stage 5
      6 = MBConv stage 6
      7 = MBConv stage 7
      8 = Conv top

    Unfreezing the last 2 stages (indices 7 and 8 by default) gives a good
    balance between fine-tuning signal and overfitting risk on ~800 images.
    """
    features = list(model.features.children())
    # Keep frozen: all but the last n
    for block in features[:-n]:
        for param in block.parameters():
            param.requires_grad = False
    # Unfreeze last n
    for block in features[-n:]:
        for param in block.parameters():
            param.requires_grad = True
    # Always train the classifier head
    for param in model.classifier.parameters():
        param.requires_grad = True


def unfreeze_all(model: nn.Module) -> None:
    """Unfreeze all parameters (not recommended for this dataset size)."""
    for param in model.parameters():
        param.requires_grad = True


def count_trainable(model: nn.Module) -> int:
    """Return count of trainable parameters."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
