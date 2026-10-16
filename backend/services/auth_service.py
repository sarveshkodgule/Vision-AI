import os
import re
import secrets
from fastapi import HTTPException, status
from schemas.user import UserCreate, UserLogin
from utils.security import get_password_hash, verify_password, create_access_token
from database.mongodb import users_collection
from bson import ObjectId

def validate_doctor_registration_code(passcode: str | None):
    """Temporary staff-registration gate, not a WebAuthn passkey or login factor."""
    configured = os.getenv("HOSPITAL_DOCTOR_CODE", "SARVESHWAR2026").strip()
    if not configured:
        raise HTTPException(
            status_code=503,
            detail="Doctor self-registration is not configured. Contact hospital administration to create your staff account."
        )
    if not passcode or not secrets.compare_digest(passcode.strip().encode(), configured.encode()):
        raise HTTPException(
            status_code=403,
            detail="Invalid hospital registration code. Check it with hospital administration; your email verification code has not been used."
        )

async def create_user(user: UserCreate):
    # Check staff authorisation BEFORE consuming a single-use email OTP.
    if user.role == "doctor":
        validate_doctor_registration_code(user.doctor_passcode)
    clean_email = user.email.strip()
    existing_user = await users_collection.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Verify OTP if provided for signup flow
    await verify_otp_code(user.email, user.otp_code)

    user_data = user.model_dump(exclude={"otp_code", "doctor_passcode"})
    user_data["email"] = clean_email.lower()
    user_data["password"] = get_password_hash(user.password)
    
    result = await users_collection.insert_one(user_data)
    
    return {"id": str(result.inserted_id), "name": user.name, "email": user_data["email"], "role": user.role}

import time
from collections import defaultdict

FAILED_LOGIN_ATTEMPTS = defaultdict(list)

async def authenticate_user(email: str, password: str):
    clean_email = email.strip()
    
    db_user = await users_collection.find_one({
        "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}
    })
    if not db_user or not db_user.get("password") or not verify_password(password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password. Please try again.")
    
    if clean_email.lower() in FAILED_LOGIN_ATTEMPTS:
        del FAILED_LOGIN_ATTEMPTS[clean_email.lower()]

    user_role = (db_user.get("role") or "patient").lower()
    access_token = create_access_token(subject=str(db_user["_id"]), role=user_role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "role": user_role
        }
    }

async def update_user_profile(user_id: str, profile_data: dict):
    update_data = {k: v for k, v in profile_data.items() if v is not None}
    if "email" in update_data:
        existing = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not existing or update_data["email"].lower() != existing.get("email", "").lower():
            raise HTTPException(400, "Your email is linked to your sign-in account. Contact the hospital to change it.")
        update_data.pop("email")
    if not update_data:
        return None
    
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return {
        "id": str(updated_user["_id"]),
        "name": updated_user.get("name"),
        "email": updated_user.get("email"),
        "role": updated_user.get("role")
    }

async def reset_password(email: str, new_password: str, otp_code: str = None):
    clean_email = email.strip()
    db_user = await users_collection.find_one({
        "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}
    })
    if not db_user:
        raise HTTPException(status_code=404, detail="Email not found")
        
    # If otp_code is provided, verify it first before resetting
    if not otp_code:
        raise HTTPException(status_code=400, detail="Verification code required")
    await verify_otp_code(clean_email, otp_code, purpose="reset")
        
    hashed_password = get_password_hash(new_password.strip())
    await users_collection.update_one(
        {"_id": db_user["_id"]},
        {"$set": {"password": hashed_password}}
    )
    if clean_email.lower() in FAILED_LOGIN_ATTEMPTS:
        del FAILED_LOGIN_ATTEMPTS[clean_email.lower()]
    return True

def _otp_digest(email, code):
    import hashlib
    import hmac
    from utils.security import SECRET_KEY
    return hmac.new(SECRET_KEY.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


async def generate_and_save_otp(email: str, is_signup: bool = False) -> str:
    import asyncio
    from datetime import datetime, timezone
    from database.mongodb import otp_codes_collection
    from services.email_service import send_otp_email

    clean_email = email.strip().lower()
    purpose = "signup" if is_signup else "reset"
    db_user = await users_collection.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if is_signup and db_user:
        raise HTTPException(400, "Email already registered")
    if not is_signup and not db_user:
        raise HTTPException(404, "Email not found")
    now = datetime.now(timezone.utc)
    previous = await otp_codes_collection.find_one({"email": clean_email})
    if previous:
        created = previous["created_at"].replace(tzinfo=timezone.utc)
        if (now - created).total_seconds() < 60:
            raise HTTPException(429, "Please wait 60 seconds before requesting another code.")
    code = str(secrets.randbelow(900000) + 100000)
    digest = _otp_digest(clean_email, code)
    await otp_codes_collection.delete_many({"email": clean_email})
    await otp_codes_collection.insert_one({
        "email": clean_email, "code_hash": digest, "purpose": purpose,
        "attempts": 0, "created_at": now,
    })
    if not await asyncio.to_thread(send_otp_email, clean_email, code):
        await otp_codes_collection.delete_many({"email": clean_email, "code_hash": digest})
        raise HTTPException(503, "Unable to send verification email. Please try again later or contact the hospital.")
    return code


async def verify_otp_code(email: str, code: str, *, purpose="signup", consume=True) -> bool:
    from datetime import datetime, timezone, timedelta
    from pymongo import ReturnDocument
    from database.mongodb import otp_codes_collection

    clean_email = email.strip().lower()
    # Increment atomically before checking: concurrent guesses share the same limit.
    record = await otp_codes_collection.find_one_and_update(
        {"email": clean_email, "purpose": purpose, "attempts": {"$lt": 5}},
        {"$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER,
    )
    if not record:
        raise HTTPException(400, "Invalid code or attempt limit reached. Request a new code.")
    created = record["created_at"].replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created >= timedelta(minutes=10):
        await otp_codes_collection.delete_one({"_id": record["_id"]})
        raise HTTPException(400, "Verification code has expired. Request a new code.")
    if not secrets.compare_digest(record["code_hash"], _otp_digest(clean_email, code.strip())):
        raise HTTPException(400, "Invalid verification code")
    if consume:
        consumed = await otp_codes_collection.delete_one({"_id": record["_id"]})
        if not consumed.deleted_count:
            raise HTTPException(400, "Verification code already used")
    return True
