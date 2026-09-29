"""Grad-CAM on the deployed ONNX feature map with an autograd classifier head.

No separately trained weights: both features and head weights come from the
same ONNX artifact. Verify head logits against ONNX on every explanation.
"""
import base64
from functools import lru_cache
import os
from pathlib import Path

import cv2
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto
import onnxruntime as ort
import torch

from preprocessing import preprocess_fundus


@lru_cache(maxsize=2)
def _explainer(path, modified):
    graph = onnx.load(path)
    pool = [node for node in graph.graph.node if node.op_type == "GlobalAveragePool"][-1]
    feature_name = pool.input[0]
    head = graph.graph.node[-1]
    if head.op_type != "Gemm":
        raise RuntimeError("Grad-CAM requires the exported GAP/linear classifier head")
    weights = {item.name: numpy_helper.to_array(item).copy() for item in graph.graph.initializer}
    attrs = {attr.name: helper.get_attribute_value(attr) for attr in head.attribute}
    graph.graph.output.append(helper.make_tensor_value_info(feature_name, TensorProto.FLOAT, [1, 1280, 7, 7]))
    session = ort.InferenceSession(graph.SerializeToString(), providers=["CPUExecutionProvider"])
    return session, feature_name, weights[head.input[1]], weights[head.input[2]], attrs


def _png_uri(rgb):
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise RuntimeError("Unable to encode explanation image")
    return "data:image/png;base64," + base64.b64encode(encoded).decode("ascii")


def explain(image_bytes, target_class=None):
    path = Path(os.getenv("PALM_ONNX_PATH", Path(__file__).resolve().parents[1] / "checkpoints/palm_efficientnet_b0.onnx")).resolve()
    session, feature_name, weight, bias, attrs = _explainer(str(path), path.stat().st_mtime_ns)
    chw = preprocess_fundus(image_bytes)
    onnx_logits, features = session.run([session.get_outputs()[0].name, feature_name], {session.get_inputs()[0].name: chw[None]})
    with torch.enable_grad():
        activation = torch.from_numpy(features).requires_grad_(True)
        pooled = activation.mean(dim=(2, 3))
        matrix = torch.from_numpy(weight)
        if attrs.get("transA", 0):
            pooled = pooled.T
        if attrs.get("transB", 0):
            matrix = matrix.T
        logits = attrs.get("alpha", 1.0) * (pooled @ matrix) + attrs.get("beta", 1.0) * torch.from_numpy(bias)
        reconstructed = logits.detach().numpy()
        if not np.allclose(reconstructed, onnx_logits, rtol=1e-4, atol=1e-5):
            raise RuntimeError("Grad-CAM head does not match deployed ONNX logits")
        target = int(onnx_logits.argmax(axis=1)[0]) if target_class is None else int(target_class)
        if target not in (0, 1):
            raise ValueError("Target class must be 0 or 1")
        gradients = torch.autograd.grad(logits[0, target], activation)[0]
        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * activation).sum(dim=1))[0].detach().numpy()
    maximum = float(cam.max())
    cam = cam / maximum if maximum > 0 else np.zeros_like(cam)
    heat = cv2.resize(cam, (224, 224), interpolation=cv2.INTER_LINEAR)
    rgb = np.clip((chw.transpose(1, 2, 0) * np.array([.229, .224, .225]) + np.array([.485, .456, .406])) * 255, 0, 255).astype(np.uint8)
    colors = cv2.cvtColor(cv2.applyColorMap((heat * 255).astype(np.uint8), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    alpha = (0.5 * heat)[..., None]
    overlay = np.clip(rgb * (1 - alpha) + colors * alpha, 0, 255).astype(np.uint8)
    return {
        "method": "Grad-CAM", "target_class": target,
        "target_label": {0: "Non-PM", 1: "PM"}[target],
        "layer": feature_name, "feature_shape": list(features.shape),
        "logit_max_error": float(np.abs(reconstructed - onnx_logits).max()),
        "heatmap": cam.tolist(), "has_positive_attribution": maximum > 0,
        "overlay": _png_uri(overlay), "model_input": _png_uri(rgb),
        "note": "Attribution on the cropped model input, not a lesion segmentation or macula detector.",
    }
