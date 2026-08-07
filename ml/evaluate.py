"""
evaluate.py — Evaluation utilities for PALM fundus classification.

Computes:
  - AUC-ROC
  - Sensitivity (recall for PM class, label=1)
  - Specificity (recall for Non-PM class, label=0)
  - F1-score (macro)
  - Confusion matrix (printed + optionally saved as PNG)
  - Full classification report

Can be used:
  1. By train.py at the end of each fold / final test evaluation.
  2. Standalone:
       python ml/evaluate.py \
           --checkpoint checkpoints/best_overall.pth \
           --data_root "backend/DL dataset/PALM/PALM" \
           --split Testing
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import argparse
import json
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from sklearn.metrics import (
    roc_auc_score,
    confusion_matrix,
    classification_report,
    f1_score,
)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from dataset import PALMDataset
from model import build_model

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

CLASS_NAMES = ["Non-PM", "PM"]


# ── core evaluation function ─────────────────────────────────────────────────

@torch.no_grad()
def run_evaluation(
    model: torch.nn.Module,
    loader: DataLoader,
    device: torch.device,
    tag: str = "eval",
    save_cm: bool = True,
) -> dict:
    """
    Run inference on a DataLoader and compute all metrics.

    Returns
    -------
    dict with keys:
        auc, sensitivity, specificity, f1, confusion_matrix (2×2 list)
    """
    model.eval()
    all_labels: list[int]  = []
    all_probs:  list[float] = []   # probability of PM (class 1)
    all_preds:  list[int]  = []

    for images, labels in loader:
        images = images.to(device)
        logits = model(images)
        probs  = F.softmax(logits, dim=1)[:, 1].cpu().numpy()  # P(PM)
        preds  = logits.argmax(dim=1).cpu().numpy()

        all_probs.extend(probs.tolist())
        all_preds.extend(preds.tolist())
        all_labels.extend(labels.numpy().tolist())

    all_labels = np.array(all_labels)
    all_probs  = np.array(all_probs)
    all_preds  = np.array(all_preds)

    # ── Metrics ───────────────────────────────────────────────────────────────
    auc = float(roc_auc_score(all_labels, all_probs))

    cm = confusion_matrix(all_labels, all_preds)
    tn, fp, fn, tp = cm.ravel()
    sensitivity = float(tp / (tp + fn + 1e-8))   # recall for PM
    specificity = float(tn / (tn + fp + 1e-8))   # recall for Non-PM
    f1 = float(f1_score(all_labels, all_preds, average="macro"))

    report = classification_report(all_labels, all_preds, target_names=CLASS_NAMES)

    metrics = {
        "auc":           round(auc, 4),
        "sensitivity":   round(sensitivity, 4),
        "specificity":   round(specificity, 4),
        "f1":            round(f1, 4),
        "confusion_matrix": cm.tolist(),
    }

    # ── Print ─────────────────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"Evaluation: {tag}")
    print(f"  AUC-ROC     : {auc:.4f}")
    print(f"  Sensitivity : {sensitivity:.4f}  (PM recall)")
    print(f"  Specificity : {specificity:.4f}  (Non-PM recall)")
    print(f"  F1 (macro)  : {f1:.4f}")
    print(f"\nClassification Report:\n{report}")
    print(f"Confusion Matrix:\n{cm}")

    # ── Save confusion matrix plot ────────────────────────────────────────────
    if save_cm:
        fig, ax = plt.subplots(figsize=(5, 4))
        im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        plt.colorbar(im, ax=ax)
        ax.set(
            xticks=[0, 1], yticks=[0, 1],
            xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
            xlabel="Predicted", ylabel="True",
            title=f"Confusion Matrix — {tag}",
        )
        for i in range(2):
            for j in range(2):
                ax.text(j, i, cm[i, j], ha="center", va="center",
                        color="white" if cm[i, j] > cm.max() / 2 else "black",
                        fontsize=14, fontweight="bold")
        plt.tight_layout()
        cm_path = RESULTS_DIR / f"confusion_matrix_{tag}.png"
        plt.savefig(cm_path, dpi=150)
        plt.close()
        print(f"  Confusion matrix saved → {cm_path}")

    return metrics


# ── standalone CLI ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Evaluate a PALM checkpoint on a given split.")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to .pth checkpoint")
    parser.add_argument("--data_root", type=str,
                        default=str(Path(__file__).parent.parent / "backend" / "DL dataset" / "PALM" / "PALM"),
                        help="Path to PALM/PALM/ root directory")
    parser.add_argument("--split", type=str, default="Testing",
                        choices=["Training", "Validation", "Testing"])
    parser.add_argument("--batch_size", type=int, default=16)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = build_model()
    ckpt = torch.load(args.checkpoint, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt)
    model.to(device)

    ds = PALMDataset.from_split(
        palm_root=Path(args.data_root),
        split=args.split,
        augment=None,   # no augmentation at evaluation time
    )
    loader = DataLoader(ds, batch_size=args.batch_size, shuffle=False, num_workers=0)

    tag = f"{args.split}_{Path(args.checkpoint).stem}"
    metrics = run_evaluation(model, loader, device, tag=tag, save_cm=True)

    out_path = RESULTS_DIR / f"metrics_{tag}.json"
    with open(out_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nMetrics saved → {out_path}")


if __name__ == "__main__":
    main()
