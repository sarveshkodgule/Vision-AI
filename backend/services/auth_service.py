import os
import re
import secrets
from fastapi import HTTPException, status
from schemas.user import UserCreate, UserLogin
from utils.security import get_password_hash, verify_password, create_access_token
from database.mongodb import users_collection, consent_records_collection
from bson import ObjectId

def _invite_digest(email: str, code: str) -> str:
    import hashlib
    import hmac
    from utils.security import SECRET_KEY
    return hmac.new(SECRET_KEY.encode(), f"invite:{email.strip().lower()}:{code.strip()}".encode(), hashlib.sha256).hexdigest()


async def create_doctor_invite(email: str, medical_license_no: str | None = None, issued_by: str = "admin", expires_hours: int = 48) -> dict:
    """Create a single-use, expiring, email-bound doctor invite (stored only as HMAC-SHA256 hash)."""
    from datetime import datetime, timezone, timedelta
    from database.mongodb import doctor_invites_collection, audit_logs_collection

    clean_email = email.strip().lower()
    raw_token = secrets.token_urlsafe(9)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=expires_hours)
    await doctor_invites_collection.insert_one({
        "email": clean_email,
        "token_hash": _invite_digest(clean_email, raw_token),
        "medical_license_no": (medical_license_no or "").strip() or None,
        "issued_by": issued_by,
        "used": False,
        "created_at": now,
        "expires_at": expires_at,
    })
    await audit_logs_collection.insert_one({
        "event": "doctor_invite_created",
        "email": clean_email,
        "issued_by": issued_by,
        "timestamp": now,
    })
    return {"email": clean_email, "invite_code": raw_token, "expires_at": expires_at.isoformat()}


async def validate_and_consume_doctor_invite(passcode: str | None, email: str) -> str | None:
    """Prefer single-use email-bound hashed invite; fallback to HOSPITAL_DOCTOR_CODE if configured."""
    from datetime import datetime, timezone
    from pymongo import ReturnDocument
    from database.mongodb import doctor_invites_collection

    clean_email = email.strip().lower()
    if passcode and passcode.strip():
        now = datetime.now(timezone.utc)
        invite = await doctor_invites_collection.find_one_and_update(
            {
                "email": clean_email,
                "token_hash": _invite_digest(clean_email, passcode),
                "used": False,
                "expires_at": {"$gt": now},
            },
            {"$set": {"used": True, "used_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if invite:
            return invite.get("medical_license_no")

    validate_doctor_registration_code(passcode)
    return None


def validate_doctor_registration_code(passcode: str | None):
    """Fallback staff-registration gate when single-use email-bound invite is not used."""
    configured = os.getenv("HOSPITAL_DOCTOR_CODE", "").strip()
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

def _validate_password_strength(password: str):
    """Enforce minimum password security requirements."""
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", password):
        errors.append("one special character (!@#$% etc.)")
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Password must contain: {', '.join(errors)}."
        )

async def create_user(user: UserCreate):
    # Enforce password strength before anything else
    _validate_password_strength(user.password)
    # Enforce informed consent — required for GDPR/HIPAA compliant healthcare data processing
    if not user.consent_data_processing:
        raise HTTPException(
            status_code=400,
            detail="You must consent to medical data processing to create an account."
        )
    if not user.consent_ai_analysis:
        raise HTTPException(
            status_code=400,
            detail="You must consent to AI-based analysis to use this clinical system."
        )
    if not user.privacy_policy_accepted or not user.terms_conditions_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must separately accept the Privacy Policy and Terms & Conditions to create an account."
        )
    # Check staff authorisation BEFORE consuming a single-use email OTP.
    invite_license = None
    if user.role == "doctor":
        invite_license = await validate_and_consume_doctor_invite(user.doctor_passcode, user.email)
    clean_email = user.email.strip()
    existing_user = await users_collection.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Verify OTP if provided for signup flow
    await verify_otp_code(user.email, user.otp_code)

    user_data = user.model_dump(exclude={"otp_code", "doctor_passcode"})
    if user.role == "doctor" and invite_license and not user_data.get("medical_license_no"):
        user_data["medical_license_no"] = invite_license
    user_data["email"] = clean_email.lower()
    user_data["password"] = get_password_hash(user.password)
    # Store consent timestamp for audit trail (GDPR Article 7 compliance)
    from datetime import datetime, timezone
    consent_time = datetime.now(timezone.utc)
    user_data["consent_granted_at"] = consent_time.isoformat()
    user_data["policy_version"] = "2026.11"
    
    result = await users_collection.insert_one(user_data)
    await consent_records_collection.insert_many([
        {"user_id": str(result.inserted_id), "document_type": "privacy_policy", "version": "2026.11", "accepted": True, "purpose": "account_and_health_data_processing", "recorded_at": consent_time},
        {"user_id": str(result.inserted_id), "document_type": "terms_conditions", "version": "2026.11", "accepted": True, "purpose": "portal_use", "recorded_at": consent_time},
        {"user_id": str(result.inserted_id), "document_type": "ai_analysis", "version": "2026.11", "accepted": True, "purpose": "ai_decision_support", "recorded_at": consent_time},
    ])
    
    return {"id": str(result.inserted_id), "name": user.name, "email": user_data["email"], "role": user.role}

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

async def _check_and_record_failed_login(email: str, success: bool):
    """DB-backed brute-force protection. Locks account for 15 min after 5 failures."""
    from database.mongodb import audit_logs_collection
    from datetime import datetime, timezone, timedelta
    clean = email.strip().lower()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=LOCKOUT_MINUTES)

    if success:
        # Clear all failed attempts on successful login
        await audit_logs_collection.delete_many({"event": "login_failed", "email": clean})
        return

    # Count recent failures
    recent = await audit_logs_collection.count_documents({
        "event": "login_failed",
        "email": clean,
        "timestamp": {"$gte": window_start}
    })
    # Record this failure
    await audit_logs_collection.insert_one({
        "event": "login_failed",
        "email": clean,
        "timestamp": now
    })
    if recent + 1 >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Account temporarily locked after {MAX_LOGIN_ATTEMPTS} failed attempts. Try again in {LOCKOUT_MINUTES} minutes."
        )

async def authenticate_user(email: str, password: str, otp_code: str | None = None):
    clean_email = email.strip()
    from database.mongodb import audit_logs_collection
    from datetime import datetime, timezone, timedelta

    # --- Brute-force lockout check ---
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=LOCKOUT_MINUTES)
    recent_failures = await audit_logs_collection.count_documents({
        "event": "login_failed",
        "email": clean_email.lower(),
        "timestamp": {"$gte": window_start}
    })
    if recent_failures >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Account temporarily locked after {MAX_LOGIN_ATTEMPTS} failed attempts. Try again in {LOCKOUT_MINUTES} minutes."
        )

    db_user = await users_collection.find_one({
        "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}
    })
    if not db_user or db_user.get("is_active", True) is False or not db_user.get("password") or not verify_password(password, db_user["password"]):
        await _check_and_record_failed_login(clean_email, success=False)
        raise HTTPException(status_code=400, detail="Incorrect email or password. Please try again.")

    # Successful login — clear lockout history
    await _check_and_record_failed_login(clean_email, success=True)

    user_role = (db_user.get("role") or "patient").lower()
    if user_role == "doctor":
        if not otp_code or not otp_code.strip():
            await generate_and_save_otp(clean_email, is_signup=False, purpose="doctor_login")
            return {
                "mfa_required": True,
                "role": "doctor",
                "message": "A 6-digit login verification code has been sent to your registered email.",
            }
        await verify_otp_code(clean_email, otp_code.strip(), purpose="doctor_login", consume=True)
        from database.mongodb import audit_logs_collection
        from datetime import datetime, timezone
        await audit_logs_collection.insert_one({
            "event": "doctor_mfa_login",
            "user_id": str(db_user["_id"]),
            "email": clean_email.lower(),
            "timestamp": datetime.now(timezone.utc),
        })

    access_token = create_access_token(
        subject=str(db_user["_id"]),
        role=user_role,
        token_version=int(db_user.get("token_version", 0)),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "role": user_role
        }
    }


async def deactivate_user(user_id: str) -> None:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid account")
    from datetime import datetime, timezone
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id), "is_active": {"$ne": False}},
        {"$set": {"is_active": False, "deactivated_at": datetime.now(timezone.utc)}},
    )
    if not result.modified_count:
        raise HTTPException(status_code=404, detail="Active account not found")

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
    if "name" in update_data and updated_user and updated_user.get("role") == "doctor":
        from database.mongodb import reports_collection, patients_collection
        new_name = updated_user.get("name")
        await reports_collection.update_many(
            {"signed_off_by": str(user_id)},
            {"$set": {"signed_off_by_name": new_name}}
        )
        await patients_collection.update_many(
            {"assigned_doctor_id": str(user_id)},
            {"$set": {"assigned_doctor_name": new_name}}
        )
    return {
        "id": str(updated_user["_id"]),
        "name": updated_user.get("name"),
        "email": updated_user.get("email"),
        "role": updated_user.get("role")
    }

async def reset_password(email: str, new_password: str, otp_code: str = None):
    _validate_password_strength(new_password.strip())
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
        {"$set": {"password": hashed_password}, "$inc": {"token_version": 1}}
    )
    await _check_and_record_failed_login(clean_email, success=True)
    return True

def _otp_digest(email, code):
    import hashlib
    import hmac
    from utils.security import SECRET_KEY
    return hmac.new(SECRET_KEY.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


async def generate_and_save_otp(email: str, is_signup: bool = False, purpose: str | None = None) -> str:
    import asyncio
    from datetime import datetime, timezone
    from database.mongodb import otp_codes_collection
    from services.email_service import send_otp_email

    clean_email = email.strip().lower()
    purpose = purpose or ("signup" if is_signup else "reset")
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
