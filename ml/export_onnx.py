"""
export_onnx.py — Export the best PALM checkpoint to ONNX format.

The exported ONNX model is what the inference service loads at runtime.
This keeps the inference service lean (no PyTorch dependency needed).

Usage:
  python ml/export_onnx.py
  python ml/export_onnx.py --checkpoint checkpoints/best_overall.pth
  python ml/export_onnx.py --checkpoint checkpoints/fold_1_best.pth --output checkpoints/fold1.onnx
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import argparse
import numpy as np
import torch

from model import build_model

CHECKPOINTS_DIR = Path(__file__).parent / "checkpoints"


def export_onnx(checkpoint_path: Path, output_path: Path) -> None:
    device = torch.device("cpu")   # ONNX export must be on CPU

    print(f"Loading checkpoint: {checkpoint_path}")
    model = build_model(num_classes=2)
    ckpt  = torch.load(checkpoint_path, map_location=device)
    state = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
    model.load_state_dict(state)
    model.eval()

    # Dummy input: batch=1, C=3, H=224, W=224
    dummy_input = torch.randn(1, 3, 224, 224, device=device)

    print(f"Exporting to ONNX: {output_path}")
    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input":  {0: "batch_size"},
            "output": {0: "batch_size"},
        },
    )
    print("  [OK] ONNX export complete.")

    # ── Round-trip validation ─────────────────────────────────────────────────
    print("Validating round-trip (PyTorch vs ONNX)...")
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(str(output_path), providers=["CPUExecutionProvider"])
        input_name = sess.get_inputs()[0].name

        dummy_np = dummy_input.numpy()
        ort_out  = sess.run(None, {input_name: dummy_np})[0]
        with torch.no_grad():
            pt_out = model(dummy_input).numpy()

        max_diff = float(np.abs(ort_out - pt_out).max())
        print(f"  Max output diff (PyTorch vs ONNX): {max_diff:.2e}")
        if max_diff < 1e-4:
            print("  [OK] Round-trip validated -- outputs match within tolerance.")
        else:
            print("  [WARN] Outputs differ more than expected. Check opset compatibility.")

    except ImportError:
        print("  [INFO] onnxruntime not installed -- skipping round-trip check.")
        print("    Install with: pip install onnxruntime")


def main():
    p = argparse.ArgumentParser(description="Export PALM checkpoint to ONNX")
    p.add_argument("--checkpoint", type=str,
                   default=str(CHECKPOINTS_DIR / "best_overall.pth"),
                   help="Path to .pth checkpoint")
    p.add_argument("--output", type=str,
                   default=str(CHECKPOINTS_DIR / "palm_efficientnet_b0.onnx"),
                   help="Output .onnx file path")
    args = p.parse_args()

    ckpt_path = Path(args.checkpoint)
    out_path  = Path(args.output)

    if not ckpt_path.exists():
        print(f"ERROR: checkpoint not found: {ckpt_path}")
        sys.exit(1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    export_onnx(ckpt_path, out_path)
    print(f"\nDone -> {out_path}")
    print("Next step: start the inference service:")
    print(f"  uvicorn ml.inference_service.main:app --port 8001 --reload")


if __name__ == "__main__":
    main()
