"""Read-only model inspection and evaluation of the shipped ONNX artifact.

Writes a separate audit JSON; does not train or replace models or old metrics.
Run from the repository root with backend/venv/Scripts/python.exe ml/audit_models.py.
"""
import hashlib
import json
from pathlib import Path
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, roc_auc_score, confusion_matrix, f1_score

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from ml.inference_service.predictor import predict


def main():
    report = {"models": {}, "datasets": {}, "scope": "Artifact inspection and bundled PALM Testing split; training provenance and patient independence not established."}
    for model, scaler in [("detection_patient", "scaler_patient"), ("detection_doctor", "scaler_doctor"), ("progression_model", "scaler_progression")]:
        path = ROOT / "backend/models" / f"{model}.pkl"
        estimator = joblib.load(path)
        transform = joblib.load(path.with_name(f"{scaler}.pkl"))
        params = {k: v for k, v in estimator.get_params().items() if v is not None and not (isinstance(v, float) and not np.isfinite(v))}
        report["models"][model] = {"type": type(estimator).__name__, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "parameters": params, "features": list(transform.feature_names_in_), "trees": len(estimator.get_booster().get_dump())}
    for filename in ("balanced_dataset.csv", "balanced_dataset_v2.csv"):
        frame = pd.read_csv(ROOT / "backend" / filename)
        report["datasets"][filename] = {"rows": len(frame), "class_counts": frame.myopia.value_counts().to_dict()}
    for split in ("Training", "Validation", "Testing"):
        frame = pd.read_excel(ROOT / "PALM/PALM" / split / "Classification Labels.xlsx")
        report["datasets"][split] = {"rows": len(frame), "class_counts": frame.Label.value_counts().to_dict()}
    frame = pd.read_excel(ROOT / "PALM/PALM/Testing/Classification Labels.xlsx")
    labels, predictions, probabilities = [], [], []
    for index, row in frame.iterrows():
        result = predict((ROOT / "PALM/PALM/Testing/Images" / row.imgName).read_bytes())
        labels.append(int(row.Label)); predictions.append(result["label"]); probabilities.append(result["prob_pm"])
        if (index + 1) % 50 == 0:
            print(f"Evaluated {index + 1}/{len(frame)} images", flush=True)
    cm = confusion_matrix(labels, predictions, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    report["onnx_test"] = {"accuracy": accuracy_score(labels, predictions), "auc": roc_auc_score(labels, probabilities), "sensitivity": float(tp / (tp + fn)), "specificity": float(tn / (tn + fp)), "f1": f1_score(labels, predictions), "confusion_matrix": cm.tolist(), "sha256": hashlib.sha256((ROOT / "ml/checkpoints/palm_efficientnet_b0.onnx").read_bytes()).hexdigest()}
    output = ROOT / "ml/results/artifact_audit.json"
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["onnx_test"], indent=2))


if __name__ == "__main__":
    main()
