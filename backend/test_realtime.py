"""
Real-Time Model Test — 4 Patients
Tests both Patient (Lifestyle) and Doctor (Clinical) ML models with realistic inputs.
"""
import joblib
import numpy as np
from pathlib import Path

MODELS = Path(__file__).resolve().parent / "models"

clf_pat  = joblib.load(MODELS / "detection_patient.pkl")
sc_pat   = joblib.load(MODELS / "scaler_patient.pkl")
clf_doc  = joblib.load(MODELS / "detection_doctor.pkl")
sc_doc   = joblib.load(MODELS / "scaler_doctor.pkl")
reg_prog = joblib.load(MODELS / "progression_model.pkl")
sc_prog  = joblib.load(MODELS / "scaler_progression.pkl")

# ── Define 4 test patients ────────────────────────────────────────────────────
# Features for Patient model: [age, gender_idx, reading_hrs, screen_time, outdoor, sleep, parental]
# Features for Doctor model:  above + [al, acd, lt, vcd, spheq, visit_year]
# gender_idx: 0=Male, 1=Female,  parental_myopia: 0=None, 1=One parent, 2=Both

patients = [
    {
        "name":    "Arjun Sharma", "age": 12, "gender": "Male",
        "reading_hours": 4.5, "screen_time": 6.0, "outdoor_activity": 1.0,
        "sleep_hours": 6.0, "parental_myopia": 2,
        # Clinical (Doctor side)
        "al": 25.1, "acd": 3.1, "lt": 3.9, "vcd": 17.8, "spheq": -3.2, "visit_year": 2024,
    },
    {
        "name":    "Priya Desai",  "age": 9,  "gender": "Female",
        "reading_hours": 1.5, "screen_time": 2.0, "outdoor_activity": 4.0,
        "sleep_hours": 9.0, "parental_myopia": 0,
        "al": 22.0, "acd": 3.6, "lt": 3.7, "vcd": 14.8, "spheq": 0.5, "visit_year": 2025,
    },
    {
        "name":    "Rohan Mehta",  "age": 16, "gender": "Male",
        "reading_hours": 3.0, "screen_time": 5.0, "outdoor_activity": 2.5,
        "sleep_hours": 7.0, "parental_myopia": 1,
        "al": 24.2, "acd": 3.3, "lt": 3.8, "vcd": 16.8, "spheq": -2.0, "visit_year": 2024,
    },
    {
        "name":    "Sneha Kulkarni","age": 7, "gender": "Female",
        "reading_hours": 0.5, "screen_time": 1.0, "outdoor_activity": 5.0,
        "sleep_hours": 10.0,"parental_myopia": 0,
        "al": 21.8, "acd": 3.7, "lt": 3.6, "vcd": 14.2, "spheq": 0.75,"visit_year": 2025,
    },
]

RISK_EMOJI = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}

print("\n" + "★"*65)
print("  MYOPIA DETECTION SYSTEM — Real-Time Test (4 Patients)")
print("★"*65)

for i, p in enumerate(patients, 1):
    g_idx = 1 if p["gender"] == "Female" else 0

    # ── Patient-side inference (lifestyle only) ──────────────────────
    X_pat = np.array([[p["age"], g_idx, p["reading_hours"], p["screen_time"],
                        p["outdoor_activity"], p["sleep_hours"], p["parental_myopia"]]])
    prob_pat = float(clf_pat.predict_proba(sc_pat.transform(X_pat))[0][1])
    risk_pat = "High" if prob_pat >= 0.70 else ("Medium" if prob_pat >= 0.40 else "Low")

    # ── Doctor-side inference (full clinical) ────────────────────────
    X_doc = np.array([[p["age"], g_idx, p["reading_hours"], p["screen_time"],
                        p["outdoor_activity"], p["sleep_hours"], p["parental_myopia"],
                        p["al"], p["acd"], p["lt"], p["vcd"], p["spheq"], p["visit_year"]]])
    prob_doc = float(clf_doc.predict_proba(sc_doc.transform(X_doc))[0][1])
    risk_doc = "High" if prob_doc >= 0.70 else ("Medium" if prob_doc >= 0.40 else "Low")

    # ── Progression inference ────────────────────────────────────────
    X_prog = np.array([[p["age"], g_idx, p["spheq"], p["al"],
                         p["reading_hours"], p["screen_time"], p["outdoor_activity"]]])
    next_spheq     = float(reg_prog.predict(sc_prog.transform(X_prog))[0])
    progression    = p["spheq"] - next_spheq
    prog_label     = "🚨 Fast" if progression > 0.75 else ("⚠️  Moderate" if progression > 0.25 else "✅ Stable")

    print(f"\n{'─'*65}")
    print(f"  Patient {i}: {p['name']}  |  Age: {p['age']}  |  Gender: {p['gender']}")
    print(f"{'─'*65}")
    print(f"  📋 INPUTS (Lifestyle)")
    print(f"     Reading: {p['reading_hours']}h/day  Screen: {p['screen_time']}h/day  "
          f"Outdoor: {p['outdoor_activity']}h/day")
    print(f"     Sleep: {p['sleep_hours']}h  Parental Myopia: {['None','One Parent','Both'][p['parental_myopia']]}")
    print(f"  🔬 INPUTS (Clinical — Doctor Side)")
    print(f"     AL: {p['al']}mm  ACD: {p['acd']}mm  LT: {p['lt']}mm  VCD: {p['vcd']}mm")
    print(f"     SPHEQ: {p['spheq']} D  Year: {p['visit_year']}")
    print()
    print(f"  🧍 PATIENT MODEL  →  {RISK_EMOJI[risk_pat]} {risk_pat} Risk  ({prob_pat*100:.1f}% probability)")
    print(f"  🩺 DOCTOR MODEL   →  {RISK_EMOJI[risk_doc]} {risk_doc} Risk  ({prob_doc*100:.1f}% probability)")
    print(f"  📈 PROGRESSION    →  Next SPHEQ: {next_spheq:.2f} D  |  Rate: {prog_label}")

print(f"\n{'★'*65}\n")
