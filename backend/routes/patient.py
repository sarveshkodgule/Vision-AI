from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from fastapi.responses import FileResponse
from schemas.patient import PatientRiskInput
from utils.dependencies import get_current_user
from services.patient_service import assess_patient_risk, get_patient_history
import os

router = APIRouter(prefix="/patient", tags=["Patient"])

@router.post("/risk", response_model=dict)
async def calculate_patient_risk(data: PatientRiskInput, current_user: dict = Depends(get_current_user)):
    result = await assess_patient_risk(str(current_user["_id"]), data)
    return {
        "status": "success",
        "data": result,
        "message": "Risk assessment completed successfully"
    }

@router.get("/history", response_model=dict)
async def get_screening_history(current_user: dict = Depends(get_current_user)):
    """Returns all past screening submissions for the logged-in patient."""
    history = await get_patient_history(str(current_user["_id"]))
    return {
        "status": "success",
        "data": history,
        "message": f"{len(history)} screening(s) found"
    }

@router.get("/reports", response_model=dict)
async def get_patient_reports(current_user: dict = Depends(get_current_user)):
    """Fetch all doctor-generated diagnostic reports for this patient."""
    from database.mongodb import patients_collection, reports_collection, clinical_data_collection
    user_id = str(current_user["_id"])
    
    # 1. Get all screenings of this patient
    screenings = await patients_collection.find({"user_id": user_id}).to_list(length=100)
    screening_ids = [str(s["_id"]) for s in screenings]
    
    # 2. Get all reports corresponding to these screenings
    cursor = reports_collection.find({"patient_id": {"$in": screening_ids}}).sort("created_at", -1)
    reports = await cursor.to_list(length=100)
    
    # 3. Get all clinical data records for these screenings
    clinical_records = await clinical_data_collection.find({"patient_id": {"$in": screening_ids}}).sort("_id", -1).to_list(length=100)
    
    # Format IDs and merge data
    for r in reports:
        r["id"] = str(r.pop("_id", ""))
        matching_s = next((s for s in screenings if str(s["_id"]) == r["patient_id"]), None)
        if matching_s:
            r["patient_name"] = matching_s.get("name", "Patient")
            r["age"] = matching_s.get("age")
            r["gender"] = matching_s.get("gender")
            
        matching_c = next((c for c in clinical_records if c.get("patient_id") == r["patient_id"]), None)
        if matching_c:
            r["axial_length"] = matching_c.get("axial_length") or matching_c.get("al") or 24.0
            r["refractive_error"] = matching_c.get("refractive_error") if matching_c.get("refractive_error") is not None else matching_c.get("spheq")
            
    return {
        "status": "success",
        "data": reports,
        "message": f"{len(reports)} diagnostic reports found"
    }

@router.get("/generate-report/{patient_id}")
async def generate_patient_report(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Allows patient to download their doctor-generated clinical PDF report."""
    from services.doctor_service import create_pdf_report
    from database.mongodb import patients_collection
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=422, detail="Invalid patient ID")
    patient = await patients_collection.find_one({"_id": ObjectId(patient_id), "user_id": str(current_user["_id"])})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    pdf_path = await create_pdf_report(patient_id)
    filename = os.path.basename(pdf_path)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview", response_model=dict)
async def preview_risk(data: PatientRiskInput, current_user: dict = Depends(get_current_user)):
    """Model-only what-if prediction; does not save a screening or send email."""
    from services.patient_service import calculate_risk
    risk, advice, probability, _ = calculate_risk(data)
    return {"status": "success", "data": {"risk_level": risk, "myopia_probability": probability, "recommendation": advice}}
