from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
import re

_XSS_PATTERN = re.compile(r"(<|>|javascript:|on\w+\s*=)", re.I)

class ClinicalDataInput(BaseModel):
    patient_id: str = Field(..., min_length=1, max_length=64)
    axial_length: float = Field(..., ge=15.0, le=40.0)
    refractive_error: float = Field(..., ge=-25.0, le=15.0)
    acd: Optional[float] = Field(None, ge=1.0, le=6.0)
    lt: Optional[float] = Field(None, ge=2.0, le=7.0)
    vcd: Optional[float] = Field(None, ge=10.0, le=30.0)
    age: Optional[int] = Field(None, gt=0, le=120)
    visit_year: Optional[int] = Field(None, ge=1990, le=2100)
    reading_hours: Optional[float] = Field(None, ge=0, le=24)
    screen_time: Optional[float] = Field(None, ge=0, le=24)
    outdoor_activity: Optional[float] = Field(None, ge=0, le=24)
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    parental_myopia: Optional[int] = Field(None, ge=0, le=2)
    image_url: str = Field(..., min_length=1, max_length=512)
    doctor_verdict: Optional[str] = Field(None, max_length=500)

    @field_validator("doctor_verdict")
    @classmethod
    def validate_safe_verdict(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and _XSS_PATTERN.search(v):
            raise ValueError("Invalid characters or script tags are not allowed")
        return v.strip() if v is not None else v

class PredictionResponse(BaseModel):
    prediction: str
    severity: str
    confidence: float
    predicted_next_spheq: float
    progression_rate: str

class ReportResponse(BaseModel):
    id: str
    patient_id: str
    image_url: Optional[str] = None
    prediction: str
    severity: str
    confidence: float
    predicted_next_spheq: Optional[float] = None
    progression_rate: Optional[str] = None
    pdf_url: Optional[str] = None
    created_at: str

class DoctorSignOffInput(BaseModel):
    doctor_verdict: Literal["Low", "Medium", "High"]
    clinical_note: Optional[str] = Field(None, max_length=1000)

    @field_validator("clinical_note")
    @classmethod
    def validate_safe_note(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and _XSS_PATTERN.search(v):
            raise ValueError("Invalid characters or script tags are not allowed")
        cleaned = v.strip() if v is not None else None
        return cleaned or None
