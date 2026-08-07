"""
augmentation.py — Augmentation pipelines for PALM training.

NOTE: Augmentation is applied AFTER preprocessing (border-crop, CLAHE, resize).
The input to these transforms is a (3, 224, 224) torch.Tensor already
normalised with ImageNet stats — so we only apply geometric & photometric
distortions that are safe post-normalisation.

Train augmentations (mild — dataset is small, avoid over-augmenting):
  - Horizontal flip
  - Rotation ±12°
  - Brightness/contrast jitter
  - Random resized crop (slight zoom variation)

Val/Test augmentations:
  - None (preprocessing already handles resize + normalise).
"""

import torch
import torchvision.transforms as T
import torchvision.transforms.functional as TF
import random


class DenormalizeRenormalize:
    """
    Helper: temporarily de-normalise → apply colour jitter → re-normalise.
    Applied to a CHW float32 tensor.
    """
    _MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
    _STD  = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)

    def __init__(self, brightness=0.2, contrast=0.2):
        self.jitter = T.ColorJitter(brightness=brightness, contrast=contrast)
        self._mean = self._MEAN.clone()
        self._std  = self._STD.clone()

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        # De-normalise to [0,1]
        img = tensor * self._std + self._mean
        img = img.clamp(0, 1)
        # Apply colour jitter (expects CHW tensor)
        img = self.jitter(img)
        # Re-normalise
        return (img - self._mean) / self._std


class TrainAugmentation:
    """
    Compose-compatible augmentation callable for training.
    Operates on a (3, 224, 224) float32 torch.Tensor.
    """
    def __init__(
        self,
        hflip_prob: float = 0.5,
        rotation_degrees: float = 12.0,
        brightness: float = 0.2,
        contrast: float = 0.2,
        crop_scale: tuple = (0.85, 1.0),
        target_size: int = 224,
    ):
        self._hflip_prob = hflip_prob
        self._rotation   = rotation_degrees
        self._crop_scale = crop_scale
        self._target_size = target_size
        self._color_jitter = DenormalizeRenormalize(brightness=brightness, contrast=contrast)

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        # 1. Horizontal flip
        if random.random() < self._hflip_prob:
            tensor = TF.hflip(tensor)

        # 2. Random rotation
        angle = random.uniform(-self._rotation, self._rotation)
        tensor = TF.rotate(tensor, angle)

        # 3. Colour jitter (de-norm → jitter → re-norm)
        tensor = self._color_jitter(tensor)

        # 4. Random resized crop (zoom variation)
        i, j, h, w = T.RandomResizedCrop.get_params(
            tensor,
            scale=self._crop_scale,
            ratio=(0.9, 1.1),
        )
        tensor = TF.resized_crop(tensor, i, j, h, w, [self._target_size, self._target_size])

        return tensor


def get_train_augmentation(**kwargs) -> TrainAugmentation:
    """Returns the training augmentation pipeline."""
    return TrainAugmentation(**kwargs)


def get_val_augmentation():
    """Validation/test: no augmentation (returns tensor unchanged)."""
    return lambda x: x
