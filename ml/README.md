# Vision-AI — PALM Myopia Prediction Module

## ⚠ Dataset Disclaimer

> This DL model is trained on the **PALM dataset only** (1,200 fundus images, binary Pathologic Myopia classification).  
> It is **not validated** for general clinical screening populations.  
> All predictions must be reviewed by a qualified clinician.  
> Do **not** use this output as a sole diagnostic basis.

---

## What This Module Does

Trains an **EfficientNet-B0** (ImageNet-pretrained) classifier on the PALM fundus dataset to predict:
- `PM` — Pathologic Myopia (label = 1)
- `Non-PM` — Non-Pathologic (label = 0)

The trained model is served as a FastAPI microservice on **port 8001**, called by the main backend at port 8000 whenever a doctor uploads a fundus image.

---

## Dataset Location

Place (or keep) the PALM dataset at:
```
backend/DL dataset/PALM/PALM/
    Training/
        Images/          ← H####.jpg, N####.jpg, P####.jpg
        Classification Labels.xlsx
    Validation/
        Images/
        Classification Labels.xlsx
    Testing/
        Images/
        Classification Labels.xlsx
```

**Class balance (confirmed):**

| Split    | Total | PM   | Non-PM | Ratio     |
|----------|-------|------|--------|-----------|
| Training | 400   | 213  | 187    | 53% / 47% |
| Validation | 400 | 211 | 189    | 53% / 47% |
| Testing  | 400   | 213  | 187    | 53% / 47% |

---

## Setup

### 1. Install training dependencies (one-time)
```bash
cd ml/
pip install -r requirements.txt
```

### 2. Install inference service dependencies (one-time)
```bash
cd ml/inference_service/
pip install -r requirements.txt
```

---

## Training

### Quick smoke-test (1 fold, few epochs — verify everything runs)
```bash
cd Vision-AI/
python ml/train.py --fast
```

### Full training (5-fold CV, two-stage transfer learning)
```bash
python ml/train.py
```

**What this does:**
1. Combines Training + Validation (800 images) → 5-fold stratified CV
2. Each fold: Stage 1 (frozen backbone, 12 epochs) → Stage 2 (unfreeze last 2 blocks, 20 epochs)
3. Early stopping on validation AUC (patience = 6)
4. Saves `checkpoints/best_overall.pth`
5. Evaluates `checkpoints/best_overall.pth` on the fixed **Testing** split (400 images)
6. Outputs CV summary → `results/cv_summary.json`
7. Outputs confusion matrix PNGs → `results/`

**GPU is strongly recommended.** On CPU, full training (~5 folds × ~32 epochs each) will take several hours. Use `--fast` for a quick sanity-check on CPU first.

---

## Export to ONNX

After training completes:
```bash
python ml/export_onnx.py
```

This creates `ml/checkpoints/palm_efficientnet_b0.onnx` and validates the round-trip.

---

## Running the Inference Service

The inference service has **no PyTorch dependency** — it uses ONNX Runtime only.

```bash
# From the repo root:
uvicorn ml.inference_service.main:app --port 8001 --reload

# OR from inside ml/inference_service/:
cd ml/inference_service/
uvicorn main:app --port 8001 --reload
```

Test it:
```bash
curl http://localhost:8001/health
# → {"status": "ok", "model": "palm_efficientnet_b0.onnx"}

curl -X POST http://localhost:8001/predict \
     -F "file=@path/to/fundus_image.jpg"
# → {"status":"success","data":{"prediction":"PM","label":1,"confidence":0.87,...}}
```

---

## Running the Full Stack (for teammates)

Start all three services in separate terminals:

```bash
# Terminal 1 — Main backend (existing)
cd backend/
uvicorn main:app --port 8000 --reload

# Terminal 2 — PALM inference service (new)
uvicorn ml.inference_service.main:app --port 8001 --reload

# Terminal 3 — Frontend dev server (existing)
cd Frontend/
npm run dev
```

> **Note:** The main backend (port 8000) will still work even if the PALM service (8001) is offline.  
> The doctor dashboard will show "DL Service Offline" instead of a prediction — no crash.

---

## File Structure

```
ml/
├── preprocessing.py         ← Shared: border crop + CLAHE + resize + ImageNet normalize
├── dataset.py               ← PALMDataset PyTorch Dataset
├── augmentation.py          ← Train-time augmentation pipeline
├── model.py                 ← EfficientNet-B0 wrapper + freeze/unfreeze helpers
├── train.py                 ← Two-stage training + 5-fold CV
├── evaluate.py              ← AUC, sensitivity, specificity, F1, confusion matrix
├── export_onnx.py           ← .pth → .onnx export + round-trip validation
├── requirements.txt         ← Training dependencies (torch, torchvision, etc.)
├── checkpoints/             ← Gitignored — .pth and .onnx model files
├── results/                 ← CV metrics JSON, confusion matrix PNGs
└── inference_service/
    ├── main.py              ← FastAPI service: GET /health, POST /predict
    ├── predictor.py         ← ONNX Runtime inference (uses preprocessing.py)
    └── requirements.txt     ← Runtime only: no PyTorch needed
```

---

## For Future Dataset Expansion (Phase 2)

The training pipeline is designed to swap in the larger Kaggle myopia dataset without rewriting:
- `PALMDataset.from_split()` → create a new `KaggleMyopiaDataset` subclass with the same `__getitem__` signature
- `preprocessing.py` is shared — same function, same ImageNet normalization
- Pass the new dataset to `DataLoader` in `train.py` — the training loop is dataset-agnostic
