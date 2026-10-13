from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal

class GoogleLogin(BaseModel):
    credential: str = Field(min_length=20, max_length=10000)
    challenge: str = Field(min_length=20, max_length=2000)
    model_config = {"extra": "forbid"}

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["patient"] = "patient"
    otp_code: str = Field(pattern=r"^\d{6}$")

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordReset(BaseModel):
    email: EmailStr
    new_password: str
    otp_code: str = Field(pattern=r"^\d{6}$")

class OTPRequest(BaseModel):
    email: EmailStr
    is_signup: Optional[bool] = False

class OTPVerify(BaseModel):
    email: EmailStr
    code: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str
