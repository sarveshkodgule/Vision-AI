from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from utils.dependencies import get_current_doctor
from schemas.doctor import ClinicalDataInput, PredictionResponse, ReportResponse
from services.doctor_service import (
    handle_image_upload, 
    process_prediction, 
    fetch_doctor_patients,
    fetch_report,
    create_pdf_report,
    fetch_screening_stats
)

router = APIRouter(prefix="/doctor", tags=["Doctor Dashboard"])

async def require_assigned_patient(patient_id: str, doctor: dict):
    from bson import ObjectId
    from database.mongodb import patients_collection
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=422, detail="Invalid patient ID")
    patient = await patients_collection.find_one({
        "_id": ObjectId(patient_id), "assigned_doctor_id": str(doctor["_id"])
    })
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_doctor)):
    file_path = await handle_image_upload(file)
    return {
        "status": "success",
        "data": {"image_url": file_path},
        "message": "Image uploaded successfully"
    }

@router.post("/predict")
async def predict(data: ClinicalDataInput, current_user: dict = Depends(get_current_doctor)):
    await require_assigned_patient(data.patient_id, current_user)
    report = await process_prediction(
        data.patient_id,
        data.image_url,
        data.model_dump(),
        doctor_verdict=data.doctor_verdict
    )
    return {
        "status": "success",
        "data": report,
        "message": "Prediction generated successfully"
    }

@router.get("/patients")
async def get_patients(current_user: dict = Depends(get_current_doctor)):
    doctor_id = str(current_user.get("_id", current_user.get("id", "")))
    patients = await fetch_doctor_patients(doctor_id=doctor_id)
    return {
        "status": "success",
        "data": patients,
        "message": "Patients fetched successfully"
    }

@router.get("/report/{id}")
async def get_report(id: str, current_user: dict = Depends(get_current_doctor)):
    report = await fetch_report(id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await require_assigned_patient(report["patient_id"], current_user)
    return {
        "status": "success",
        "data": report,
        "message": "Report fetched successfully"
    }

@router.post("/generate-report/{patient_id}")
async def generate_report(patient_id: str, current_user: dict = Depends(get_current_doctor)):
    """Generate a real PDF report and stream it as a download."""
    import os
    await require_assigned_patient(patient_id, current_user)
    pdf_path = await create_pdf_report(patient_id)
    filename  = os.path.basename(pdf_path)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/screening-stats")
async def get_screening_stats(current_user: dict = Depends(get_current_doctor)):
    stats = await fetch_screening_stats()
    return {
        "status": "success",
        "data": stats,
        "message": "Screening stats fetched successfully"
    }
