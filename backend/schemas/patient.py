from pydantic import BaseModel, Field
from typing import Optional

class PatientRiskInput(BaseModel):
    name: str = Field(..., min_length=1, description="Patient's full name")
    gender: str = Field(..., description="Patient's gender (e.g., Male, Female, Other)")
    age: int = Field(..., gt=0, description="Age must be greater than 0")
    screen_time: float = Field(..., ge=0, description="Screen time in hours")
    reading_time: float = Field(..., ge=0, description="Reading time in hours")
    work_hours: float = Field(..., ge=0, description="Work or study hours")
    sleep_hours: float = Field(..., ge=0, description="Sleep hours per day")
    outdoor_activity: float = Field(..., ge=0, description="Outdoor activity in hours")
    parental_myopia: int = Field(..., ge=0, le=2, description="Number of myopic parents (0, 1, or 2)")
    assigned_doctor_id: Optional[str] = Field(None, description="Doctor ID this patient is assigned to")
    # Optional biometry — improves ML model accuracy if provided
    al: Optional[float] = Field(None, description="Axial Length in mm")
    acd: Optional[float] = Field(None, description="Anterior Chamber Depth in mm")
    lt: Optional[float] = Field(None, description="Lens Thickness in mm")
    vcd: Optional[float] = Field(None, description="Vitreous Chamber Depth in mm")
    spheq: Optional[float] = Field(None, description="Spherical Equivalent in diopters")

class PatientRiskResponse(BaseModel):
    risk_level: str
    recommendation: str
    myopia_probability: float = 0.0
    myopia_detected: bool = False
    predicted_next_spheq: Optional[float] = None
