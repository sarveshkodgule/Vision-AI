"""
train.py — Two-stage transfer learning + 5-fold cross-validation for PALM.

Training Strategy:
  Stage 1 (~12 epochs): Freeze backbone → train classifier head only
                         lr = 1e-3, weight_decay = 1e-4
  Stage 2 (~20 epochs): Unfreeze last 2 EfficientNet blocks → fine-tune
                         lr = 1e-5, weight_decay = 1e-4

Cross-validation:
  - Combines Training + Validation splits (800 images) into a pool
  - Runs stratified 5-fold CV on this pool
  - Reports mean ± std AUC, sensitivity, specificity, F1 across folds
  - Also evaluates the best overall checkpoint on the fixed Testing split

Usage:
  python ml/train.py
  python ml/train.py --data_root "backend/DL dataset/PALM/PALM" --folds 5
  python ml/train.py --fast      # 1 fold, fewer epochs — for quick smoke-test
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import argparse
import json
import copy
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset, ConcatDataset
from sklearn.model_selection import StratifiedKFold

from dataset import PALMDataset
from augmentation import get_train_augmentation, get_val_augmentation
from model import build_model, freeze_backbone, unfreeze_last_blocks, count_trainable
from evaluate import run_evaluation, RESULTS_DIR

CHECKPOINTS_DIR = Path(__file__).parent / "checkpoints"
CHECKPOINTS_DIR.mkdir(exist_ok=True)

DEFAULT_DATA_ROOT = str(
    Path(__file__).parent.parent / "backend" / "DL dataset" / "PALM" / "PALM"
)


# ── training helpers ─────────────────────────────────────────────────────────

def compute_class_weights(labels: list[int], device: torch.device) -> torch.Tensor:
    """Inverse-frequency class weights for CrossEntropyLoss."""
    counts = np.bincount(labels, minlength=2).astype(float)
    weights = 1.0 / (counts + 1e-6)
    weights = weights / weights.sum() * len(counts)
    return torch.tensor(weights, dtype=torch.float32, device=device)


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
) -> float:
    """Run one training epoch. Returns mean loss."""
    model.train()
    total_loss = 0.0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * images.size(0)
    return total_loss / len(loader.dataset)


def eval_auc(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    """Quick AUC evaluation for early-stopping check. Returns AUC."""
    from sklearn.metrics import roc_auc_score
    import torch.nn.functional as F

    model.eval()
    all_probs, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            logits = model(images)
            probs = F.softmax(logits, dim=1)[:, 1].cpu().numpy()
            all_probs.extend(probs.tolist())
            all_labels.extend(labels.numpy().tolist())
    try:
        return float(roc_auc_score(all_labels, all_probs))
    except Exception:
        return 0.0


def train_stage(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    scheduler,
    device: torch.device,
    num_epochs: int,
    patience: int,
    stage_name: str,
    checkpoint_path: Path,
) -> nn.Module:
    """
    Train for up to num_epochs with early stopping on validation AUC.
    Returns the model restored to the best checkpoint.
    """
    best_auc = -1.0
    epochs_no_improve = 0
    best_state = copy.deepcopy(model.state_dict())

    print(f"\n  ── {stage_name} ──  (trainable params: {count_trainable(model):,})")

    for epoch in range(1, num_epochs + 1):
        t0 = time.time()
        train_loss = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_auc    = eval_auc(model, val_loader, device)
        scheduler.step()

        elapsed = time.time() - t0
        print(f"  Epoch {epoch:3d}/{num_epochs} | loss={train_loss:.4f} | val_AUC={val_auc:.4f} | {elapsed:.1f}s")

        if val_auc > best_auc:
            best_auc = val_auc
            epochs_no_improve = 0
            best_state = copy.deepcopy(model.state_dict())
            torch.save(
                {"model_state_dict": best_state, "val_auc": best_auc},
                checkpoint_path,
            )
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                print(f"  Early stopping at epoch {epoch} (patience={patience})")
                break

    model.load_state_dict(best_state)
    print(f"  Best val AUC: {best_auc:.4f}")
    return model


# ── 5-fold cross-validation ───────────────────────────────────────────────────

def run_cv(args) -> list[dict]:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*60}")
    print(f"PALM EfficientNet-B0 — 5-Fold Cross-Validation")
    print(f"Device : {device}")
    print(f"Data   : {args.data_root}")
    print(f"Folds  : {args.folds}")
    print(f"{'='*60}\n")

    palm_root = Path(args.data_root)

    # Load Training + Validation splits (no augmentation for building index)
    # We re-apply augmentation per fold below using a wrapper.
    ds_train_full = PALMDataset.from_split(palm_root, "Training",   augment=None)
    ds_val_full   = PALMDataset.from_split(palm_root, "Validation", augment=None)
    ds_pool       = ConcatDataset([ds_train_full, ds_val_full])

    # Collect labels for stratified splitting
    labels_pool   = ds_train_full.get_labels() + ds_val_full.get_labels()
    labels_arr    = np.array(labels_pool)
    indices       = np.arange(len(labels_arr))

    skf = StratifiedKFold(n_splits=args.folds, shuffle=True, random_state=42)
    fold_metrics: list[dict] = []

    global_best_auc = -1.0
    global_best_state = None

    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(indices, labels_arr), start=1):
        print(f"\n{'─'*50}")
        print(f"  FOLD {fold_idx}/{args.folds}   |  train={len(train_idx)}  val={len(val_idx)}")

        # Build subsets
        train_subset = Subset(ds_pool, train_idx)
        val_subset   = Subset(ds_pool, val_idx)

        # Wrap train_subset to apply augmentation on the fly
        class AugmentedSubset(torch.utils.data.Dataset):
            def __init__(self, subset, aug):
                self.subset = subset
                self.aug = aug
            def __len__(self): return len(self.subset)
            def __getitem__(self, i):
                x, y = self.subset[i]
                return self.aug(x), y

        aug_fn = get_train_augmentation()
        aug_train = AugmentedSubset(train_subset, aug_fn)

        train_labels_fold = labels_arr[train_idx]
        class_weights = compute_class_weights(train_labels_fold.tolist(), device)

        train_loader = DataLoader(aug_train,   batch_size=args.batch_size, shuffle=True,  num_workers=0, pin_memory=False)
        val_loader   = DataLoader(val_subset,  batch_size=args.batch_size, shuffle=False, num_workers=0, pin_memory=False)

        model     = build_model(num_classes=2, dropout=args.dropout).to(device)
        criterion = nn.CrossEntropyLoss(weight=class_weights)

        # ── Stage 1: frozen backbone ──────────────────────────────────────────
        freeze_backbone(model)
        optimizer_s1 = optim.Adam(
            filter(lambda p: p.requires_grad, model.parameters()),
            lr=args.lr_stage1, weight_decay=args.weight_decay
        )
        scheduler_s1 = optim.lr_scheduler.CosineAnnealingLR(optimizer_s1, T_max=args.epochs_stage1)

        ckpt_path = CHECKPOINTS_DIR / f"fold_{fold_idx}_stage1.pth"
        model = train_stage(
            model, train_loader, val_loader, criterion,
            optimizer_s1, scheduler_s1, device,
            num_epochs=args.epochs_stage1, patience=args.patience,
            stage_name=f"Stage 1 (head only)", checkpoint_path=ckpt_path,
        )

        # ── Stage 2: unfreeze last blocks ─────────────────────────────────────
        unfreeze_last_blocks(model, n=args.unfreeze_blocks)
        optimizer_s2 = optim.Adam(
            filter(lambda p: p.requires_grad, model.parameters()),
            lr=args.lr_stage2, weight_decay=args.weight_decay
        )
        scheduler_s2 = optim.lr_scheduler.CosineAnnealingLR(optimizer_s2, T_max=args.epochs_stage2)

        ckpt_path2 = CHECKPOINTS_DIR / f"fold_{fold_idx}_best.pth"
        model = train_stage(
            model, train_loader, val_loader, criterion,
            optimizer_s2, scheduler_s2, device,
            num_epochs=args.epochs_stage2, patience=args.patience,
            stage_name=f"Stage 2 (last {args.unfreeze_blocks} blocks unfrozen)", checkpoint_path=ckpt_path2,
        )

        # ── Fold evaluation ───────────────────────────────────────────────────
        metrics = run_evaluation(model, val_loader, device, tag=f"fold_{fold_idx}", save_cm=True)
        fold_metrics.append(metrics)

        ckpt = torch.load(ckpt_path2, map_location=device)
        fold_auc = ckpt.get("val_auc", metrics["auc"])
        if fold_auc > global_best_auc:
            global_best_auc = fold_auc
            global_best_state = copy.deepcopy(model.state_dict())

    # ── Save global best checkpoint ───────────────────────────────────────────
    best_ckpt_path = CHECKPOINTS_DIR / "best_overall.pth"
    torch.save({"model_state_dict": global_best_state, "val_auc": global_best_auc}, best_ckpt_path)
    print(f"\n✓ Best overall checkpoint saved → {best_ckpt_path}  (AUC={global_best_auc:.4f})")

    # ── CV summary ────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("5-FOLD CROSS-VALIDATION SUMMARY")
    print(f"{'='*60}")
    for metric in ["auc", "sensitivity", "specificity", "f1"]:
        vals = [m[metric] for m in fold_metrics]
        print(f"  {metric.upper():12s}: {np.mean(vals):.4f} ± {np.std(vals):.4f}")

    cv_summary = {
        "folds": args.folds,
        "per_fold": fold_metrics,
        "mean": {k: round(float(np.mean([m[k] for m in fold_metrics])), 4) for k in ["auc","sensitivity","specificity","f1"]},
        "std":  {k: round(float(np.std( [m[k] for m in fold_metrics])), 4) for k in ["auc","sensitivity","specificity","f1"]},
    }
    with open(RESULTS_DIR / "cv_summary.json", "w") as f:
        json.dump(cv_summary, f, indent=2)
    print(f"\n  CV summary saved → {RESULTS_DIR / 'cv_summary.json'}")

    return fold_metrics


# ── Fixed test-set evaluation ─────────────────────────────────────────────────

def evaluate_on_test(args, device: torch.device) -> dict:
    print(f"\n{'='*60}")
    print("FIXED TEST-SET EVALUATION (best_overall.pth)")
    print(f"{'='*60}")

    palm_root  = Path(args.data_root)
    ckpt_path  = CHECKPOINTS_DIR / "best_overall.pth"
    if not ckpt_path.exists():
        print("  No best_overall.pth found — skipping test evaluation.")
        return {}

    model = build_model().to(device)
    ckpt  = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt)

    ds_test  = PALMDataset.from_split(palm_root, "Testing", augment=None)
    loader   = DataLoader(ds_test, batch_size=args.batch_size, shuffle=False, num_workers=0)

    metrics = run_evaluation(model, loader, device, tag="test_set", save_cm=True)

    with open(RESULTS_DIR / "test_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  Test metrics saved → {RESULTS_DIR / 'test_metrics.json'}")
    return metrics


# ── entry point ───────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Train EfficientNet-B0 on PALM dataset")
    p.add_argument("--data_root",       type=str, default=DEFAULT_DATA_ROOT)
    p.add_argument("--folds",           type=int, default=5)
    p.add_argument("--batch_size",      type=int, default=16)
    p.add_argument("--epochs_stage1",   type=int, default=12)
    p.add_argument("--epochs_stage2",   type=int, default=20)
    p.add_argument("--patience",        type=int, default=6)
    p.add_argument("--lr_stage1",       type=float, default=1e-3)
    p.add_argument("--lr_stage2",       type=float, default=1e-5)
    p.add_argument("--weight_decay",    type=float, default=1e-4)
    p.add_argument("--dropout",         type=float, default=0.4)
    p.add_argument("--unfreeze_blocks", type=int, default=2)
    p.add_argument("--fast", action="store_true",
                   help="Fast smoke-test: 1 fold, 3+5 epochs, small batch")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.fast:
        print("⚡ FAST mode: 1 fold, reduced epochs for quick smoke-test")
        args.folds         = 1
        args.epochs_stage1 = 3
        args.epochs_stage2 = 5
        args.batch_size    = 8

    fold_metrics = run_cv(args)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    evaluate_on_test(args, device)

    print("\n✅ Training complete. Run export_onnx.py to export the model.")
