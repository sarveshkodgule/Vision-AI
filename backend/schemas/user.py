from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
import re

_XSS_PATTERN = re.compile(r"(<|>|javascript:|on\w+\s*=)", re.I)


def _reject_script_tags(value: Optional[str]) -> Optional[str]:
    if value is not None and _XSS_PATTERN.search(value):
        raise ValueError("Invalid characters or script tags are not allowed")
    return value

class GoogleLogin(BaseModel):
    credential: str = Field(min_length=20, max_length=10000)
    challenge: str = Field(min_length=20, max_length=2000)
    model_config = {"extra": "forbid"}

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Literal["patient", "doctor"] = "patient"
    doctor_passcode: Optional[str] = Field(default=None, max_length=256)
    medical_license_no: Optional[str] = Field(default=None, max_length=64)
    otp_code: str = Field(pattern=r"^\d{6}$")
    # Informed consent — required for healthcare data processing (GDPR / HIPAA compliance)
    consent_data_processing: bool = Field(
        default=False,
        description="Patient must explicitly consent to medical data processing"
    )
    consent_ai_analysis: bool = Field(
        default=False,
        description="Patient must explicitly consent to AI-based diagnosis analysis"
    )
    privacy_policy_accepted: bool = Field(default=False)
    terms_conditions_accepted: bool = Field(default=False)

    @field_validator("name")
    @classmethod
    def validate_safe_name(cls, v: str) -> str:
        return _reject_script_tags(v.strip())

class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None

    @field_validator("name")
    @classmethod
    def validate_safe_name(cls, v: Optional[str]) -> Optional[str]:
        return _reject_script_tags(v.strip()) if v is not None else v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordReset(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=6, max_length=128)
    otp_code: str = Field(pattern=r"^\d{6}$")

class OTPRequest(BaseModel):
    email: EmailStr
    is_signup: Optional[bool] = False

class OTPVerify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    is_signup: bool = True

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str


class DoctorInviteCreate(BaseModel):
    email: EmailStr
    medical_license_no: Optional[str] = Field(default=None, max_length=64)
    expires_hours: int = Field(default=48, ge=1, le=168)
