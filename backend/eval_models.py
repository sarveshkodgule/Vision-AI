import joblib, pandas as pd, numpy as np
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from pathlib import Path

BASE = Path(__file__).resolve().parent

df = pd.read_csv(BASE / "balanced_dataset.csv")
df["gender_idx"] = (df["gender"].astype(str).str.lower() == "female").astype(int)
df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
y = df["myopia"].astype(int)

pat_feat = ["age","gender_idx","reading_hours","screen_time","outdoor_activity","sleep_hours","parental_myopia"]
doc_feat = pat_feat + ["al","acd","lt","vcd","spheq","visit_year"]

configs = [
    ("PATIENT (Lifestyle)", pat_feat, "detection_patient.pkl", "scaler_patient.pkl"),
    ("DOCTOR (Clinical)",   doc_feat, "detection_doctor.pkl",  "scaler_doctor.pkl"),
]

for name, feat, mk, sk in configs:
    X = df[feat].astype(float)
    sc  = joblib.load(BASE / "models" / sk)
    clf = joblib.load(BASE / "models" / mk)
    X_s = sc.transform(X)

    cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
    cv_scores = cross_val_score(clf, X_s, y, cv=cv, scoring="accuracy")

    _, X_te, _, y_te = train_test_split(X_s, y, test_size=0.2, random_state=42)
    pred = clf.predict(X_te)

    print(f"\n{'='*50}")
    print(f" MODEL: {name}")
    print(f"{'='*50}")
    print(f" 10-Fold CV Accuracy : {cv_scores.mean()*100:.2f}% +/- {cv_scores.std()*100:.2f}%")
    print(f" Per-Fold Scores     : {[round(s*100,1) for s in cv_scores]}")
    print(f" Hold-Out Accuracy   : {accuracy_score(y_te, pred)*100:.2f}%")
    print()
    print(classification_report(y_te, pred, target_names=["Healthy","Myopic"]))
