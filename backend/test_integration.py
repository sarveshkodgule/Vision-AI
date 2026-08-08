"""
Direct Backend Integration Test
Calls the EXACT same service functions the Patient and Doctor portals use.
This proves the ML models are live inside the backend.
"""
import asyncio, sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.patient_service import calculate_risk
from services.ai_service import predict_clinical_evaluation
from schemas.patient import PatientRiskInput

DIVIDER = "─" * 62
STAR    = "★" * 62
RISK_ICON = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}

# ── 4 Test Patients ───────────────────────────────────────────────────────────
test_patients = [
    {
        "name": "Arjun Sharma  (High Risk Profile)",
        "lifestyle": dict(name="Arjun Sharma", age=12, gender="Male", reading_time=4.5,
                         screen_time=6.0, outdoor_activity=1.0, sleep_hours=6.0,
                         parental_myopia=2, work_hours=5),
        "clinical":  dict(age=12, gender="Male", al=25.1, acd=3.1, lt=3.9, vcd=17.8,
                         spheq=-3.2, visit_year=2024, reading_time=4.5, screen_time=6.0,
                         outdoor_activity=1.0, sleep_hours=6.0, parental_myopia=2),
    },
    {
        "name": "Priya Desai   (Low Risk Profile)",
        "lifestyle": dict(name="Priya Desai", age=9, gender="Female", reading_time=1.5,
                         screen_time=2.0, outdoor_activity=4.0, sleep_hours=9.0,
                         parental_myopia=0, work_hours=0),
        "clinical":  dict(age=9, gender="Female", al=22.0, acd=3.6, lt=3.7, vcd=14.8,
                         spheq=0.5, visit_year=2025, reading_time=1.5, screen_time=2.0,
                         outdoor_activity=4.0, sleep_hours=9.0, parental_myopia=0),
    },
    {
        "name": "Rohan Mehta   (Medium→High Escalation)",
        "lifestyle": dict(name="Rohan Mehta", age=16, gender="Male", reading_time=3.0,
                         screen_time=5.0, outdoor_activity=2.5, sleep_hours=7.0,
                         parental_myopia=1, work_hours=4),
        "clinical":  dict(age=16, gender="Male", al=24.2, acd=3.3, lt=3.8, vcd=16.8,
                         spheq=-2.0, visit_year=2024, reading_time=3.0, screen_time=5.0,
                         outdoor_activity=2.5, sleep_hours=7.0, parental_myopia=1),
    },
    {
        "name": "Sneha Kulkarni (Very Healthy, 7y/o)",
        "lifestyle": dict(name="Sneha Kulkarni", age=7, gender="Female", reading_time=0.5,
                         screen_time=1.0, outdoor_activity=5.0, sleep_hours=10.0,
                         parental_myopia=0, work_hours=0),
        "clinical":  dict(age=7, gender="Female", al=21.8, acd=3.7, lt=3.6, vcd=14.2,
                         spheq=0.75, visit_year=2025, reading_time=0.5, screen_time=1.0,
                         outdoor_activity=5.0, sleep_hours=10.0, parental_myopia=0),
    },
]

print(f"\n{STAR}")
print("  LIVE BACKEND INTEGRATION TEST — Patient & Doctor Portals")
print(f"{STAR}")

for i, p in enumerate(test_patients, 1):
    print(f"\n{DIVIDER}")
    print(f"  Patient {i}: {p['name']}")
    print(DIVIDER)

    # ── PATIENT PORTAL (lifestyle ML model) ──────────────────────────────────
    inp = PatientRiskInput(**p["lifestyle"])
    risk, rec, prob, _ = calculate_risk(inp)
    print(f"\n  🧍 PATIENT PORTAL  (Lifestyle Model — /patient/risk)")
    print(f"     Inputs : Age={p['lifestyle']['age']}, Screen={p['lifestyle']['screen_time']}h, "
          f"Outdoor={p['lifestyle']['outdoor_activity']}h, Parental={p['lifestyle']['parental_myopia']}")
    print(f"     Result : {RISK_ICON[risk]} {risk} Risk  |  Probability: {prob*100:.1f}%")
    print(f"     Advice : {rec}")

    # ── DOCTOR PORTAL (clinical ML model) ────────────────────────────────────
    clin = predict_clinical_evaluation(p["clinical"])
    sev = str(clin.get("severity", "Low")).split()[0]
    sev_icon = RISK_ICON.get(sev, "⚪")
    conf = clin.get("confidence", 0)
    if isinstance(conf, float):
        conf_pct = f"{conf*100:.1f}%"
    else:
        conf_pct = str(conf)
    print(f"\n  🩺 DOCTOR PORTAL   (Clinical Model — /doctor/evaluate)")
    print(f"     Inputs : AL={p['clinical']['al']}mm, SPHEQ={p['clinical']['spheq']}D, "
          f"ACD={p['clinical']['acd']}mm")
    print(f"     Result : {sev_icon} {sev} Severity  |  Confidence: {conf_pct}")
    print(f"     Next SPHEQ: {clin.get('predicted_next_spheq', 'N/A')}  |  "
          f"Progression: {clin.get('progression_rate', 'N/A')}")

print(f"\n{STAR}")
print("  ✅ ALL 4 PATIENTS PROCESSED — Backend Integration Confirmed")
print(f"{STAR}\n")
