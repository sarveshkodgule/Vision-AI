import os
import shutil
from fastapi import UploadFile, HTTPException
from datetime import datetime
from database.mongodb import patients_collection, reports_collection, clinical_data_collection
from services.ai_service import predict_fundus_palm, predict_clinical_evaluation
from typing import Optional, Any, Dict, List
from bson import ObjectId

UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

async def handle_image_upload(file: UploadFile):
    file_location = os.path.join(UPLOADS_DIR, file.filename)
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    
    return file_location

async def fetch_doctor_patients(doctor_id: str = None) -> List[Dict[str, Any]]:
    """
    Fetch patients assigned to a specific doctor.
    Filters out invalid/incomplete records (where name is missing/empty).
    """
    query = {"name": {"$ne": None, "$gt": ""}}
    if doctor_id:
        # Show patients explicitly assigned to this doctor
        query["assigned_doctor_id"] = doctor_id
    
    patients_cursor = patients_collection.find(query)
    patients = await patients_cursor.to_list(length=1000)
    
    result = []
    for p in patients:
        id_str = str(p.get("_id", ""))
        p_data = {k: v for k, v in p.items() if k != "_id"}
        p_data["id"] = id_str
        result.append(p_data)
    return result

async def fetch_report(report_id: str) -> Optional[Dict[str, Any]]:
    try:
        report = await reports_collection.find_one({"_id": ObjectId(report_id)})
        if report:
            id_str = str(report.get("_id", ""))
            report_data = {k: v for k, v in report.items() if k != "_id"}
            report_data["id"] = id_str
            return report_data
    except Exception:
        pass
    return None

async def process_prediction(patient_id: str, image_path: str, clinical_data: dict, doctor_verdict: Optional[str] = None):
    # 1. Pathologic Myopia prediction via PALM EfficientNet-B0 microservice
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
    except FileNotFoundError:
        image_bytes = b"dummy"
    palm_result = await predict_fundus_palm(image_bytes)
    
    # 2. Clinical Evaluation (XGBoost biometry model — unchanged)
    # Fetch the patient to get additional context (age, lifestyle) if missing in clinical_data
    patient = await patients_collection.find_one({"_id": ObjectId(patient_id) if len(patient_id) == 24 else patient_id})
    if patient:
        # Merge lifestyle factors into clinical_data for the ML model
        for key in ["age", "gender", "reading_time", "screen_time", "outdoor_activity", "sleep_hours", "parental_myopia"]:
            if key not in clinical_data:
                clinical_data[key] = patient.get(key)
    
    clinical_ai = predict_clinical_evaluation(clinical_data)
    
    # Save clinical data
    clinical_data["patient_id"] = patient_id
    await clinical_data_collection.insert_one(clinical_data)
    
    # Generate DB report record
    report_record = {
        "patient_id":            patient_id,
        "image_url":             image_path,
        # PALM EfficientNet-B0 fundus prediction (binary PM / Non-PM)
        "fundus_pm_prediction":  palm_result["fundus_pm_prediction"],
        "fundus_pm_confidence":  palm_result["fundus_pm_confidence"],
        # Clinical XGBoost model results (unchanged)
        "severity":              clinical_ai["severity"],
        "confidence":            clinical_ai["confidence"],
        "predicted_next_spheq": clinical_ai["predicted_next_spheq"],
        "progression_rate":      clinical_ai["progression_rate"],
        "doctor_verdict":        doctor_verdict,
        "created_at":            datetime.now().isoformat()
    }
    
    result = await reports_collection.insert_one(report_record)
    report_record["id"] = str(result.inserted_id)
    if "_id" in report_record: 
        report_record["id"] = str(report_record["_id"])
        del report_record["_id"]
    
    return report_record

async def create_pdf_report(patient_id: str) -> str:
    """Generate a real ReportLab PDF for the latest clinical report of a patient."""
    from services.pdf_service import generate_pdf_report

    report = await reports_collection.find_one(
        {"patient_id": patient_id},
        sort=[("created_at", -1)]
    )
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this patient. Run an evaluation first.")

    # Fetch the patient record for lifestyle details
    patient = None
    try:
        patient = await patients_collection.find_one(
            {"_id": ObjectId(patient_id)},
            sort=[("created_at", -1)]
        )
    except Exception:
        try:
            patient = await patients_collection.find_one(
                {"id": patient_id},
                sort=[("created_at", -1)]
            )
        except Exception:
            pass

    p = patient or {}
    patient_data = {
        "id":               patient_id,
        "name":             p.get("name", "Patient"),
        "age":              p.get("age", "N/A"),
        "gender":           p.get("gender", "N/A"),
        "screen_time":      p.get("screen_time", "N/A"),
        "reading_time":     p.get("reading_time", "N/A"),
        "outdoor_activity": p.get("outdoor_activity", "N/A"),
        "sleep_hours":      p.get("sleep_hours", "N/A"),
        "parental_myopia":  p.get("parental_myopia", 0),
        "work_hours":       p.get("work_hours", "N/A"),
    }

    report_data = {
        "severity":             report.get("severity", "Low"),
        "confidence":           report.get("confidence", 0),
        "predicted_next_spheq": report.get("predicted_next_spheq", "N/A"),
        "progression_rate":     report.get("progression_rate", "N/A"),
        "doctor_verdict":       report.get("doctor_verdict", "Pending"),
    }

    pdf_path = generate_pdf_report(patient_data, report_data)
    if not pdf_path:
        raise HTTPException(status_code=500, detail="PDF generation failed — check ReportLab installation")

    return pdf_path

async def fetch_screening_stats():
    all_patients = await patients_collection.find().to_list(1000)
    all_reports = await reports_collection.find().to_list(1000)
    
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    stats: Dict[str, Any] = {
        "today": {"total": 0, "High": 0, "Medium": 0, "Low": 0},
        "week": {"total": 0, "High": 0, "Medium": 0, "Low": 0},
        "month": {"total": 0, "High": 0, "Medium": 0, "Low": 0},
        "all_time": {"total": len(all_patients), "High": 0, "Medium": 0, "Low": 0},
        "validation_accuracy": 0.0
    }

    valid_reports = [r for r in all_reports if r.get("doctor_verdict")]
    if valid_reports:
        matches = sum(1 for r in valid_reports if str(r.get("severity", "")).lower() == str(r.get("doctor_verdict", "")).lower())
        stats["validation_accuracy"] = float(round((float(matches) / float(len(valid_reports))) * 100.0, 1))
    
    for p in all_patients:
        risk = str(p.get("risk_level", "Low"))
        if risk not in ["High", "Medium", "Low"]: risk = "Low"
        
        stats["all_time"][risk] += 1
        
        created_at = p.get("created_at")
        if created_at:
            try:
                created_dt = datetime.fromisoformat(created_at)
                diff = (now - created_dt).days
                
                if created_dt >= today_start:
                    stats["today"]["total"] += 1
                    stats["today"][risk] += 1
                    
                if diff <= 7:
                    stats["week"]["total"] += 1
                    stats["week"][risk] += 1
                    
                if diff <= 30:
                    stats["month"]["total"] += 1
                    stats["month"][risk] += 1
            except Exception:
                pass
                
    return stats
