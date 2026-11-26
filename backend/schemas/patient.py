from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

_XSS_PATTERN = re.compile(r"(<|>|javascript:|on\w+\s*=)", re.I)

class PatientRiskInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Patient's full name")
    gender: str = Field(..., max_length=32, description="Patient's gender (e.g., Male, Female, Other)")
    age: int = Field(..., gt=0, le=120, description="Age must be between 1 and 120")
    screen_time: float = Field(..., ge=0, le=24, description="Screen time in hours (0-24)")
    reading_time: float = Field(..., ge=0, le=24, description="Reading time in hours (0-24)")
    work_hours: float = Field(..., ge=0, le=24, description="Work or study hours (0-24)")
    sleep_hours: float = Field(..., ge=0, le=24, description="Sleep hours per day (0-24)")
    outdoor_activity: float = Field(..., ge=0, le=24, description="Outdoor activity in hours (0-24)")
    parental_myopia: int = Field(..., ge=0, le=2, description="Number of myopic parents (0, 1, or 2)")
    assigned_doctor_id: Optional[str] = Field(None, description="Doctor ID this patient is assigned to")
    # Optional biometry — bounded to physiological clinical limits
    al: Optional[float] = Field(None, ge=15.0, le=40.0, description="Axial Length in mm")
    acd: Optional[float] = Field(None, ge=1.0, le=6.0, description="Anterior Chamber Depth in mm")
    lt: Optional[float] = Field(None, ge=2.0, le=7.0, description="Lens Thickness in mm")
    vcd: Optional[float] = Field(None, ge=10.0, le=30.0, description="Vitreous Chamber Depth in mm")
    spheq: Optional[float] = Field(None, ge=-25.0, le=15.0, description="Spherical Equivalent in diopters")

    @field_validator("name", "gender")
    @classmethod
    def validate_no_scripts(cls, v: str) -> str:
        if _XSS_PATTERN.search(v):
            raise ValueError("Invalid characters or script tags are not allowed")
        return v.strip()

class PatientRiskResponse(BaseModel):
    risk_level: str
    recommendation: str
    myopia_probability: float = 0.0
    myopia_detected: bool = False
    predicted_next_spheq: Optional[float] = None
