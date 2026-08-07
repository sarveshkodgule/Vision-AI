"""
dataset.py — PyTorch Dataset for the PALM fundus classification dataset.

Label encoding (from Classification Labels.xlsx):
  0 = Non-PM  (Non-Pathologic Myopia)
  1 = PM      (Pathologic Myopia)

The dataset is designed so that swapping in a future, larger dataset (e.g.
Kaggle myopia-image-dataset) requires only subclassing or replacing
PALMDataset — the training loop in train.py is dataset-agnostic.

Usage:
    ds = PALMDataset(
        images_dir  = Path("backend/DL dataset/PALM/PALM/Training/Images"),
        labels_xlsx = Path("backend/DL dataset/PALM/PALM/Training/Classification Labels.xlsx"),
        augment     = get_train_augmentation(),
    )
    loader = DataLoader(ds, batch_size=16, shuffle=True, num_workers=0)
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow importing preprocessing from sibling ml/ package regardless of cwd
sys.path.insert(0, str(Path(__file__).parent))

import torch
from torch.utils.data import Dataset
import numpy as np
import openpyxl
from typing import Callable, Optional, List, Tuple

from preprocessing import preprocess_fundus


class PALMDataset(Dataset):
    """
    PALM fundus classification dataset.

    Parameters
    ----------
    images_dir : Path
        Directory containing the .jpg fundus images.
    labels_xlsx : Path
        Excel file with columns: imgName, Label (0=Non-PM, 1=PM).
    augment : callable, optional
        Augmentation function applied to the (3,224,224) float32 tensor.
        If None, no augmentation is applied (for val/test).
    """

    def __init__(
        self,
        images_dir: Path,
        labels_xlsx: Path,
        augment: Optional[Callable] = None,
    ):
        self.images_dir = Path(images_dir)
        self.augment = augment
        self.samples: List[Tuple[Path, int]] = self._load_labels(labels_xlsx)

    def _load_labels(self, xlsx_path: Path) -> List[Tuple[Path, int]]:
        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
        ws = wb.active
        samples: List[Tuple[Path, int]] = []
        header_skipped = False
        for row in ws.iter_rows(values_only=True):
            if not header_skipped:
                header_skipped = True
                continue
            img_name, label = row[0], row[1]
            if img_name is None or label is None:
                continue
            img_path = self.images_dir / str(img_name)
            if not img_path.exists():
                print(f"[PALMDataset] WARNING: image not found — {img_path}")
                continue
            samples.append((img_path, int(label)))
        wb.close()
        return samples

    # ── Dataset contract ──────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]

        with open(img_path, "rb") as f:
            img_bytes = f.read()

        # Shared preprocessing: border crop → CLAHE → resize → normalise → CHW
        chw = preprocess_fundus(img_bytes)                    # (3, 224, 224) float32
        tensor = torch.from_numpy(chw)                        # torch.Tensor

        # Optional augmentation (train only)
        if self.augment is not None:
            tensor = self.augment(tensor)

        return tensor, label

    # ── Convenience factories ─────────────────────────────────────────────────

    @classmethod
    def from_split(
        cls,
        palm_root: Path,
        split: str,
        augment: Optional[Callable] = None,
    ) -> "PALMDataset":
        """
        Construct from a split name ('Training', 'Validation', 'Testing').

        Example:
            ds = PALMDataset.from_split(
                palm_root = Path("backend/DL dataset/PALM/PALM"),
                split     = "Training",
                augment   = get_train_augmentation(),
            )
        """
        split_dir   = Path(palm_root) / split
        images_dir  = split_dir / "Images"
        labels_xlsx = split_dir / "Classification Labels.xlsx"
        return cls(images_dir=images_dir, labels_xlsx=labels_xlsx, augment=augment)

    def get_labels(self) -> List[int]:
        """Return all labels — used for computing class weights."""
        return [label for _, label in self.samples]
