"""
Demo: Run the Myopia ML Model with real patient input values.
Detection features  (9): age, al, acd, lt, vcd, reading_hours, screen_time, outdoor_activity, parental_myopia
Progression features(6): spheq, al, reading_hours, screen_time, outdoor_activity, parental_myopia
"""
from pathlib import Path
import joblib, numpy as np

MODELS_DIR = Path(__file__).resolve().parent / "models"
clf     = joblib.load(MODELS_DIR / "detection_model.pkl")
reg     = joblib.load(MODELS_DIR / "progression_model.pkl")
scalers = joblib.load(MODELS_DIR / "scaler.pkl")

# ─────────────────────────────────────────
# ✏️ PATIENT INPUT — change these to test!
# ─────────────────────────────────────────
patient = {
    "name":             "Sarvesh",
    "age":              22,
    "al":               25.1,   # Axial Length (mm) — normal ~23.5, myopic > 24
    "acd":              3.2,    # Anterior Chamber Depth (mm)
    "lt":               4.1,    # Lens Thickness (mm)
    "vcd":              17.5,   # Vitreous Chamber Depth (mm)
    "reading_hours":    5.0,    # hrs/day
    "screen_time":      8.0,    # hrs/day
    "outdoor_activity": 0.5,    # hrs/day
    "parental_myopia":  1,      # 0=none, 1=one parent, 2=both
    "spheq":           -2.5,    # Spherical Equivalent (D) — for progression only
}

# Detection: 9 features (spheq excluded — as per training)
X_det = np.array([[
    patient["age"],
    patient["al"],
    patient["acd"],
    patient["lt"],
    patient["vcd"],
    patient["reading_hours"],
    patient["screen_time"],
    patient["outdoor_activity"],
    patient["parental_myopia"],
]])

# Progression: 6 features
X_prog = np.array([[
    patient["spheq"],
    patient["al"],
    patient["reading_hours"],
    patient["screen_time"],
    patient["outdoor_activity"],
    patient["parental_myopia"],
]])

# Scale & predict
X_det_s  = scalers["detection"].transform(X_det)
X_prog_s = scalers["progression"].transform(X_prog)

proba_all   = clf.predict_proba(X_det_s)[0]
classes     = np.asarray(getattr(clf, "classes_", [0, 1]))
pos_idx     = np.where(classes == 1)[0]
probability = float(proba_all[int(pos_idx[0])]) if pos_idx.size else float(proba_all[-1])
myopia      = probability >= 0.5
next_spheq  = float(reg.predict(X_prog_s)[0])
risk        = "HIGH ⚠️" if probability >= 0.70 else "MEDIUM 🔶" if probability >= 0.40 else "LOW ✅"

# ─────────────────────────────────────────
# OUTPUT
# ─────────────────────────────────────────
print()
print("=" * 52)
print("   MYOPIA ML MODEL — PREDICTION RESULT")
print("=" * 52)
print(f"  Patient          : {patient['name']}, Age {patient['age']}")
print()
print("  [ INPUT FACTORS ]")
print(f"  Axial Length     : {patient['al']} mm")
print(f"  ACD / LT / VCD   : {patient['acd']} / {patient['lt']} / {patient['vcd']} mm")
print(f"  Current SPHEQ    : {patient['spheq']} D")
print(f"  Screen Time      : {patient['screen_time']} hrs/day")
print(f"  Reading Hours    : {patient['reading_hours']} hrs/day")
print(f"  Outdoor Activity : {patient['outdoor_activity']} hrs/day")
print(f"  Parental Myopia  : {patient['parental_myopia']} parent(s)")
print()
print("  [ PREDICTION OUTPUT ]")
print(f"  Myopia Detected  : {'YES' if myopia else 'NO'}")
print(f"  Probability      : {probability * 100:.1f}%")
print(f"  Risk Level       : {risk}")
print(f"  Next SPHEQ       : {next_spheq:.2f} D  (predicted for next visit)")
print("=" * 52)
print()
