from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal

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
    otp_code: str = Field(pattern=r"^\d{6}$")

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

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
