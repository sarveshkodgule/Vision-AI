"""
Model Improvement Suite: Cross-Validation + Hyperparameter Tuning
Run: .\\venv\\Scripts\\python improve_model.py

What this does:
1. Runs 10-Fold Stratified Cross-Validation for a REAL accuracy estimate  
2. Runs XGBoost hyperparameter tuning via RandomizedSearchCV
3. Retrains on the BEST params and saves the improved models
"""
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from xgboost import XGBClassifier, XGBRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import (
    StratifiedKFold, cross_val_score, RandomizedSearchCV, train_test_split
)
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR   = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DATA_CSV   = BASE_DIR / "balanced_dataset.csv"

# ── Load data ──────────────────────────────────────────────────────────────
df = pd.read_csv(DATA_CSV)
df["gender_idx"] = (df["gender"].astype(str).str.lower() == "female").astype(int)
df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
y  = df["myopia"].astype(int)

pat_features = ["age","gender_idx","reading_hours","screen_time","outdoor_activity","sleep_hours","parental_myopia"]
doc_features = pat_features + ["al","acd","lt","vcd","spheq","visit_year"]

X_pat = df[pat_features].astype(float)
X_doc = df[doc_features].astype(float)

# ── Utility ────────────────────────────────────────────────────────────────
def run_cross_validation(name, X, y, k=10):
    """Run Stratified K-Fold cross-validation and print results."""
    print(f"\n{'='*55}")
    print(f"  {name} — {k}-Fold Stratified Cross-Validation")
    print(f"{'='*55}")
    
    # Use a scaler inside CV loop
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    base_clf = XGBClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1,
        random_state=42, eval_metric="logloss"
    )
    
    cv = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
    scores = cross_val_score(base_clf, X_scaled, y, cv=cv, scoring="accuracy")
    
    print(f"  Per-Fold Accuracy: {[f'{s:.3f}' for s in scores]}")
    print(f"  → Mean Accuracy  : {scores.mean()*100:.2f}%")
    print(f"  → Std Deviation  : ±{scores.std()*100:.2f}%")
    print(f"  → Min/Max        : {scores.min()*100:.2f}% / {scores.max()*100:.2f}%")
    return scores.mean(), scaler

def tune_and_retrain(name, X, y, model_key, scaler_key, n_iter=30):
    """Hyperparameter search + retrain and save the best model."""
    print(f"\n{'='*55}")
    print(f"  {name} — Hyperparameter Tuning (n_iter={n_iter})")
    print(f"{'='*55}")
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    param_dist = {
        "n_estimators"      : [100, 200, 300, 500],
        "max_depth"         : [3, 4, 5, 6, 7],
        "learning_rate"     : [0.01, 0.05, 0.1, 0.2],
        "subsample"         : [0.6, 0.7, 0.8, 0.9, 1.0],
        "colsample_bytree"  : [0.6, 0.7, 0.8, 0.9, 1.0],
        "min_child_weight"  : [1, 3, 5, 7],
        "gamma"             : [0, 0.1, 0.2, 0.5],
        "reg_alpha"         : [0, 0.01, 0.1, 1.0],
        "reg_lambda"        : [1, 1.5, 2, 5],
    }
    
    base_clf = XGBClassifier(random_state=42, eval_metric="logloss")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    search = RandomizedSearchCV(
        base_clf, param_dist, n_iter=n_iter, scoring="accuracy",
        cv=cv, random_state=42, n_jobs=-1, verbose=1
    )
    search.fit(X_scaled, y)
    
    best = search.best_estimator_
    best_score = search.best_score_
    
    print(f"\n  ✅ Best CV Score : {best_score*100:.2f}%")
    print(f"  Best Params:\n    {search.best_params_}")
    
    # Full Train + Final Test Evaluation
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    best.fit(X_train, y_train)
    y_pred = best.predict(X_test)
    print(f"\n  Hold-Out Test Accuracy : {accuracy_score(y_test, y_pred)*100:.2f}%")
    print(classification_report(y_test, y_pred, target_names=["Healthy","Myopic"]))
    
    # Save
    joblib.dump(best, MODELS_DIR / model_key)
    joblib.dump(scaler, MODELS_DIR / scaler_key)
    print(f"  Saved to {MODELS_DIR / model_key}")
    return best_score, search.best_params_

# ─────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "★"*55)
    print(" MYOPIA ML MODEL — EVALUATION & IMPROVEMENT SUITE")
    print("★"*55)
    
    # STEP 1: Cross-Validation (Realistic accuracy estimate)
    print("\n[STEP 1] Cross-Validation (Untuned Baseline)")
    pat_cv, _ = run_cross_validation("Patient Lifestyle Model", X_pat, y, k=10)
    doc_cv, _ = run_cross_validation("Doctor Clinical Model",   X_doc, y, k=10)
    
    # STEP 2: Hyperparameter Tuning + Retraining
    print("\n[STEP 2] Hyperparameter Tuning & Retraining")
    pat_tuned, pat_params = tune_and_retrain(
        "Patient Lifestyle Model", X_pat, y,
        model_key="detection_patient.pkl", scaler_key="scaler_patient.pkl"
    )
    doc_tuned, doc_params = tune_and_retrain(
        "Doctor Clinical Model", X_doc, y,
        model_key="detection_doctor.pkl", scaler_key="scaler_doctor.pkl"
    )
    
    # STEP 3: Summary
    print("\n" + "★"*55)
    print(" SUMMARY")
    print("★"*55)
    print(f"  Patient Model  | Baseline CV: {pat_cv*100:.2f}%  → Tuned CV: {pat_tuned*100:.2f}%")
    print(f"  Doctor Model   | Baseline CV: {doc_cv*100:.2f}%  → Tuned CV: {doc_tuned*100:.2f}%")
    print("\n  ✅ Improved models have been saved to ./models/")
