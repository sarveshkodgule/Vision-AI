# PALM Grad-CAM++ reconciliation — 2026-10-04

This branch is based on teammate commit `6fcd53f`, retaining its authorization,
validated unique uploads, path restrictions, clinical None handling, PDF generation,
email delivery, dashboard, and API-helper work. The validated-results commit was
carried over separately. No training, export, or full test-set evaluation was run.

## Artifact comparison

| Artifact | SHA-256 |
| --- | --- |
| Local production `best_overall.pth` | `4d59f8fa43e84d21589ac17b0e5188527e113aef79a2f627e2cd9e524953cdd0` |
| Local production `palm_efficientnet_b0.onnx` | `00ef09c8c25f941e08a8cdf92107af6234894c329374e21dfb91fdaa441f49ee` |
| Teammate-audited ONNX | `b01bc2f32913bf2a6907231b0d4c7cfba1467b288661bc5baf157b860eda56f2` |
| Unmodified `ml/xai/gradcam.py` | `ca4759c99a36186e42c77c5eb8b48739895c5d9d8d765f1fc6f5cbd39b7adde2` |

The teammate's ONNX metrics describe a different binary. Their audit contains no
PyTorch checkpoint hash, so that checkpoint cannot be compared. The historical audit
is preserved unchanged; it does not establish the current production export's metrics.

The user confirmed the current `test_metrics.json` and `cv_summary.json` as validated.
The test AUC recorded there is 0.9910. Numerical comparison of the local checkpoint
and export on T0001–T0004 produced maximum absolute logit differences of
2.205e-6, 1.669e-6, 5.484e-6, and 1.788e-6. This is a four-image parity check,
not a rerun of the 400-image evaluation or proof of training provenance.

Deploy the local production pair identified above; substituting the differently
hashed audited ONNX file would invalidate this comparison. Batch-size/opset provenance
is still pending teammate confirmation. The original checkout's uncommitted training,
export, authentication, documentation and staged integration edits remain untouched.

## Explanation contract

The service retains multipart `POST /predict` with `explain=true`, which the existing
backend already sends. ONNX remains authoritative for prediction and confidence.
The returned `data.gradcam` is generated only by `ml/xai/gradcam.py::GradCAMPP`.
The plain Grad-CAM implementation in the service has been replaced, not retained as
a fallback. The research module is copied unchanged.

Existing fields remain: `overlay`, `model_input`, `target_class`, `target_label`,
`feature_shape`, `heatmap`, `has_positive_attribution`, `layer`, and `note`.
`method` is `Grad-CAM++`. `heatmap` is the validated engine's 224x224 normalized map.
The old ONNX-head-specific `logit_max_error` field is removed; parity is documented
above rather than inventing a value. `image_sha256`, `checkpoint_sha256`, and
`crop_box` provide provenance. PNG images use the existing 224x224 cropped/preprocessed
view and the research overlay helper, matching offline visualization conventions.

One PyTorch model is initialized per worker at startup, and a lock serializes shared
hooks and gradients. HTTP inference runs in a worker thread. Missing checkpoints,
computation failures and missing/wrong-method upstream explanations produce explicit
errors. No fabricated prediction or overlay is returned. The teammate's removal of
ONNX mock predictions is sufficient and remains unchanged. Clinical-only assessments
still explicitly report `No Image` with null fundus confidence.

MongoDB keeps the existing `gradcam` field. No migration is needed. The dashboard
keeps the teammate's side-by-side images and displays the method returned by the
service, so historical records are not relabeled as Grad-CAM++.

Install `ml/inference_service/requirements.txt` (now also including torchvision) and
provide both production weights. The existing research model builder requires its
ImageNet weights in the torchvision cache or first-use download access.

## Dataset-path conflict

In the current primary workspace, `PALM/PALM` does not exist; the dataset is at
`backend/DL dataset/PALM/PALM`. Therefore the teammate's default-path change was not
adopted. Training and evaluation defaults remain their previously working values.
No training algorithm or export settings were changed. A separate worktree does not
automatically contain ignored datasets; point sample checks at the original dataset
with `PALM_DATA_ROOT`, or use the existing `--data_root` option for evaluation tools.

## Verification

- All 49 backend tests passed, including PDF content, MIME/email behavior (delivery
  mocked; no outbound messages), ownership, safe uploads, clinical None handling,
  missing-model errors, and rejection of plain/missing Grad-CAM explanations.
- Frontend production build passed.
- Four real samples: T0001/T0004 PM; T0002/T0003 Non-PM. The backend was exercised
  through FastAPI TestClient with real HTTP calls to the inference service on port
  8003 and actual MongoDB in an isolated test database. All four `gradcam` objects
  survived save/retrieval unchanged. Cross-doctor report access returned HTTP 404.
- First request: 1.801 s; warm requests: 0.316, 0.341, 0.338 s, including persistence.
  These are local sample measurements, not a deployment latency guarantee.
- Generated PM overlay visually matches the existing offline Grad-CAM++ attention
  pattern. Browser screenshot/interaction verification remains pending because the
  browser/native automation surfaces were unavailable in the preceding verification.

Reproduce backend tests with the dataset available:

```powershell
$env:PALM_DATA_ROOT = 'D:/Rohan/PROJECT/Vision-AI/backend/DL dataset/PALM/PALM'
python -m unittest discover -s backend/tests -v
```

The test dependency `pypdf>=6.0,<7` is declared in `backend/requirements-dev.txt`.
For this verification it was installed into the primary workspace's
`.local-xai-audit/test-deps` and exposed through `PYTHONPATH`, without changing the
global environment. Existing scikit-learn pickle-version warnings remain.
