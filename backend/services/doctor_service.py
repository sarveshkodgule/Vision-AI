import os
import shutil
import logging
from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile, HTTPException
from datetime import datetime, timezone
from database.mongodb import patients_collection, reports_collection, clinical_data_collection
from services.ai_service import predict_fundus_palm, predict_clinical_evaluation
from typing import Optional, Any, Dict, List
from bson import ObjectId

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

async def handle_image_upload(file: UploadFile):
    import cv2
    import numpy as np
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be at most 10 MB")
    decoded = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR) if content else None
    if decoded is None:
        raise HTTPException(status_code=422, detail="Upload a valid image")
    # --- Clinical Image Quality & Resolution Gate ---
    height, width = decoded.shape[:2]
    if height < 100 or width < 100:
        raise HTTPException(
            status_code=422,
            detail="Fundus image resolution is too low (minimum 100x100 px required for reliable AI analysis)."
        )
    if float(np.std(decoded)) < 3.0:
        raise HTTPException(
            status_code=422,
            detail="Image appears blank or uniform; please upload a valid retinal fundus scan."
        )
    suffix = Path(file.filename or "image.jpg").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png"}:
        raise HTTPException(status_code=422, detail="Upload a JPEG or PNG image")
    # --- Magic Byte Validation (defense against disguised malicious files) ---
    MAGIC_BYTES = {
        ".jpg":  [(b"\xff\xd8\xff", 0)],
        ".jpeg": [(b"\xff\xd8\xff", 0)],
        ".png":  [(b"\x89PNG\r\n\x1a\n", 0)],
    }
    valid = any(
        content[offset:offset + len(magic)] == magic
        for magic, offset in MAGIC_BYTES.get(suffix, [])
    )
    if not valid:
        raise HTTPException(
            status_code=422,
            detail="File content does not match its extension. Only real JPEG or PNG images are accepted."
        )
    filename = f"{uuid4().hex}{suffix}"
    (UPLOADS_DIR / filename).write_bytes(content)
    return f"uploads/{filename}"

async def fetch_doctor_patients(doctor_id: str = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch patients assigned to a specific doctor.
    Filters out invalid/incomplete records (where name is missing/empty).
    """
    query = {"name": {"$ne": None, "$gt": ""}}
    if doctor_id:
        # Show patients explicitly assigned to this doctor
        query["assigned_doctor_id"] = doctor_id
    
    patients_cursor = patients_collection.find(query).skip(skip).limit(limit)
    patients = await patients_cursor.to_list(length=limit)

    patient_ids = [str(p.get("_id", "")) for p in patients if p.get("_id")]
    report_map: Dict[str, Dict[str, Any]] = {}
    if patient_ids:
        rep_cursor = reports_collection.find(
            {"patient_id": {"$in": patient_ids}},
            {"patient_id": 1, "review_status": 1, "created_at": 1},
        ).sort("created_at", -1)
        async for rep in rep_cursor:
            pid = str(rep.get("patient_id", ""))
            if pid and pid not in report_map:
                report_map[pid] = rep
            elif pid and rep.get("review_status") == "signed_off":
                report_map[pid] = rep

    result = []
    for p in patients:
        id_str = str(p.get("_id", ""))
        p_data = {k: v for k, v in p.items() if k != "_id"}
        p_data["id"] = id_str
        rep = report_map.get(id_str)
        p_data["has_report"] = rep is not None
        p_data["review_status"] = rep.get("review_status") if rep else None
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
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=422, detail="Invalid patient ID")
    clinical_data = {k: v for k, v in clinical_data.items() if v is not None}
    # 1. Pathologic Myopia prediction via PALM EfficientNet-B0 microservice
    try:
        if not image_path:
            image_bytes = b""
        else:
            resolved_image = (BASE_DIR / image_path).resolve()
            if not resolved_image.is_relative_to(UPLOADS_DIR.resolve()):
                raise HTTPException(status_code=422, detail="Invalid image path")
            image_bytes = resolved_image.read_bytes()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Uploaded image not found")
    palm_result = await predict_fundus_palm(image_bytes)
    
    # 2. Clinical Evaluation (XGBoost biometry model — unchanged)
    # Fetch the patient to get additional context (age, lifestyle) if missing in clinical_data
    patient = await patients_collection.find_one({"_id": ObjectId(patient_id) if len(patient_id) == 24 else patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient:
        # Merge lifestyle factors into clinical_data for the ML model
        for key in ["age", "gender", "reading_time", "screen_time", "outdoor_activity", "sleep_hours", "parental_myopia"]:
            if key not in clinical_data and patient.get(key) is not None:
                clinical_data[key] = patient.get(key)
    
    clinical_ai = predict_clinical_evaluation(clinical_data)
    
    # Save clinical data
    clinical_data["patient_id"] = patient_id
    clinical_data["created_at"] = datetime.now(timezone.utc)
    clinical_result = await clinical_data_collection.insert_one(clinical_data)
    clinical_record_id = str(clinical_result.inserted_id)
    
    # Generate DB report record
    report_record = {
        "patient_id":            patient_id,
        "clinical_record_id":    clinical_record_id,
        "image_url":             image_path,
        # PALM EfficientNet-B0 fundus prediction (binary PM / Non-PM)
        "fundus_pm_prediction":  palm_result["fundus_pm_prediction"],
        "fundus_pm_confidence":  palm_result["fundus_pm_confidence"],
        "gradcam": palm_result.get("gradcam"),
        "fundus_model_version": palm_result.get("model_version"),
        "fundus_review_required": palm_result.get("review_required"),
        "fundus_confidence_threshold": palm_result.get("confidence_threshold"),
        "fundus_checkpoint_sha256": (palm_result.get("gradcam") or {}).get("checkpoint_sha256"),
        "current_spheq": clinical_data.get("refractive_error", clinical_data.get("spheq")),
        # Clinical XGBoost model results (unchanged)
        "severity":              clinical_ai["severity"],
        "confidence":            clinical_ai["confidence"],
        "prediction":            clinical_ai["prediction"],
        "model_source":          "XGBoost clinical + progression",
        "predicted_next_spheq": clinical_ai["predicted_next_spheq"],
        "progression_rate":      clinical_ai["progression_rate"],
        "doctor_verdict":        doctor_verdict,
        "review_status":         "preliminary",
        "created_at":            datetime.now(timezone.utc).isoformat()
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

    # Fetch latest clinical biometry for this patient (if recorded)
    clinical = await clinical_data_collection.find_one(
        {"patient_id": patient_id},
        sort=[("_id", -1)]
    )
    c = clinical or {}

    p = patient or {}
    from database.mongodb import users_collection
    assigned_doc_name = None
    assigned_doc_id = p.get("assigned_doctor_id")
    if assigned_doc_id and ObjectId.is_valid(str(assigned_doc_id)):
        doc_user = await users_collection.find_one({"_id": ObjectId(str(assigned_doc_id)), "role": "doctor"}, {"name": 1})
        if doc_user:
            assigned_doc_name = doc_user.get("name")

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
        "severity":                report.get("severity", "Low"),
        "confidence":              report.get("confidence", 0),
        "predicted_next_spheq":    report.get("predicted_next_spheq", "N/A"),
        "progression_rate":        report.get("progression_rate", "N/A"),
        "doctor_verdict":          report.get("doctor_verdict", "Pending"),
        "review_status":           report.get("review_status", "preliminary"),
        "assigned_doctor_name":    assigned_doc_name,
        "signed_off_by_name":      report.get("signed_off_by_name") or assigned_doc_name,
        "clinical_note":           report.get("clinical_note"),
        "fundus_prediction":       report.get("fundus_prediction", "N/A"),
        "fundus_confidence":       report.get("fundus_confidence"),
        "fundus_review_required":  report.get("fundus_review_required", False),
        "axial_length":            c.get("axial_length") or c.get("al"),
        "current_spheq":           report.get("current_spheq") if report.get("current_spheq") is not None else c.get("refractive_error"),
        "acd":                     c.get("acd"),
        "lt":                      c.get("lt"),
        "vcd":                     c.get("vcd"),
    }

    pdf_path = generate_pdf_report(patient_data, report_data)
    if not pdf_path:
        raise HTTPException(status_code=500, detail="PDF generation failed — check ReportLab installation")

    # Automatically send generated clinical PDF report to patient's registered email
    p_user_id = p.get("user_id")
    if p_user_id:
        try:
            from services.email_service import send_pdf_report_email
            import asyncio

            user = await users_collection.find_one({"_id": ObjectId(p_user_id) if len(str(p_user_id)) == 24 else p_user_id})
            if user and user.get("email"):
                patient_email = user.get("email")
                patient_name = p.get("name", "Patient")
                attending_doctor = report_data.get("signed_off_by_name") or assigned_doc_name or ""

                loop = asyncio.get_running_loop()
                loop.run_in_executor(
                    None,
                    send_pdf_report_email,
                    patient_email,
                    patient_name,
                    pdf_path,
                    attending_doctor,
                )
        except Exception:
            logger.warning("Skipping report email", exc_info=True)

    return pdf_path

async def sign_off_report(
    report_id: str,
    doctor_id: str,
    doctor_name: str,
    doctor_verdict: str,
    clinical_note: Optional[str] = None,
) -> Dict[str, Any]:
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=422, detail="Invalid report ID")
    report = await reports_collection.find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    patient_id = str(report.get("patient_id", ""))
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    assigned = await patients_collection.find_one({
        "_id": ObjectId(patient_id),
        "assigned_doctor_id": doctor_id,
    })
    if not assigned:
        raise HTTPException(status_code=404, detail="Patient not found")

    signed_off_at = datetime.now(timezone.utc).isoformat()
    update_fields: Dict[str, Any] = {
        "doctor_verdict": doctor_verdict,
        "review_status": "signed_off",
        "signed_off_at": signed_off_at,
        "signed_off_by": doctor_id,
        "signed_off_by_name": doctor_name,
    }
    if clinical_note is not None:
        update_fields["clinical_note"] = clinical_note

    await reports_collection.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": update_fields},
    )
    return {
        "id": str(report["_id"]),
        "patient_id": patient_id,
        **update_fields,
    }


async def fetch_patient_clinical_history(patient_id: str) -> List[Dict[str, Any]]:
    """Fetch stored clinical assessments and biometry for one assigned patient."""
    reports = await reports_collection.find({"patient_id": patient_id}).sort("created_at", -1).to_list(length=50)
    clinical_record_ids = []
    for report in reports:
        record_id = report.get("clinical_record_id")
        if isinstance(record_id, str) and ObjectId.is_valid(record_id):
            clinical_record_ids.append(ObjectId(record_id))
        elif record_id is not None:
            clinical_record_ids.append(record_id)
    clinical_records = []
    if clinical_record_ids:
        clinical_records = await clinical_data_collection.find({
            "_id": {"$in": clinical_record_ids},
            "patient_id": patient_id,
        }).to_list(length=50)
    clinical_records_by_id = {str(record["_id"]): record for record in clinical_records}

    history: List[Dict[str, Any]] = []
    for rep in reports:
        clin = clinical_records_by_id.get(str(rep.get("clinical_record_id")), {})
        history.append({
            "id": str(rep.get("_id", "")),
            "patient_id": patient_id,
            "created_at": rep.get("created_at"),
            "prediction": rep.get("prediction"),
            "severity": rep.get("severity"),
            "confidence": rep.get("confidence"),
            "predicted_next_spheq": rep.get("predicted_next_spheq"),
            "progression_rate": rep.get("progression_rate"),
            "fundus_pm_prediction": rep.get("fundus_pm_prediction"),
            "fundus_pm_confidence": rep.get("fundus_pm_confidence"),
            "doctor_verdict": rep.get("doctor_verdict"),
            "review_status": rep.get("review_status", "preliminary"),
            "signed_off_at": rep.get("signed_off_at"),
            "signed_off_by_name": rep.get("signed_off_by_name"),
            "clinical_note": rep.get("clinical_note"),
            "spheq": rep.get("current_spheq") if rep.get("current_spheq") is not None else clin.get("refractive_error", clin.get("spheq")),
            "axial_length": clin.get("axial_length", clin.get("al")),
            "acd": clin.get("acd"),
            "lt": clin.get("lt"),
            "vcd": clin.get("vcd"),
        })
    return history


async def fetch_screening_stats(doctor_id: str):
    all_patients = await patients_collection.find({"assigned_doctor_id": doctor_id}).to_list(1000)
    assigned_ids = [str(p["_id"]) for p in all_patients if p.get("_id") is not None]
    all_reports = (
        await reports_collection.find({"patient_id": {"$in": assigned_ids}}).to_list(1000)
        if assigned_ids
        else []
    )
    
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
