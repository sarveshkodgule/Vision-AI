from fastapi import APIRouter, Depends, HTTPException, Response
from schemas.user import UserUpdate, GoogleLogin, UserCreate, PasswordReset, OTPRequest, OTPVerify
from fastapi.security import OAuth2PasswordRequestForm
from services.auth_service import update_user_profile, create_user, authenticate_user, reset_password, generate_and_save_otp, verify_otp_code
from services.google_auth_service import google_config, authenticate_google
from utils.dependencies import get_current_user, oauth2_scheme
from database.mongodb import users_collection

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/google/config")
async def google_configuration(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"status": "success", "data": google_config()}


@router.post("/google")
async def google_login(payload: GoogleLogin, response: Response):
    response.headers["Cache-Control"] = "no-store"
    data = await authenticate_google(payload.credential, payload.challenge)
    return {"status": "success", "data": data}


@router.post("/login")
async def password_login(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    response.headers["Cache-Control"] = "no-store"
    data = await authenticate_user(form_data.username, form_data.password)
    return {"status": "success", **data, "data": data}


@router.post("/signup")
async def signup(payload: UserCreate):
    return {"status": "success", "data": await create_user(payload)}


@router.post("/request-otp")
async def request_otp(payload: OTPRequest):
    await generate_and_save_otp(payload.email, is_signup=payload.is_signup)
    return {"status": "success", "message": "Verification code sent. Check your email."}


@router.post("/verify-otp")
async def verify_otp(payload: OTPVerify):
    await verify_otp_code(payload.email, payload.code, purpose="signup" if payload.is_signup else "reset", consume=False)
    return {"status": "success", "message": "Verification code is valid."}


@router.post("/reset-password")
async def password_reset(payload: PasswordReset):
    await reset_password(payload.email, payload.new_password, payload.otp_code)
    return {"status": "success", "message": "Password updated. You can now sign in."}

@router.get("/profile", response_model=dict)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "status": "success",
        "data": {
            "id": str(current_user["_id"]),
            "name": current_user.get("name"),
            "email": current_user.get("email"),
            "role": current_user.get("role")
        },
        "message": "Profile retrieved successfully"
    }

@router.put("/profile", response_model=dict)
async def update_profile(user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    updated_user = await update_user_profile(str(current_user["_id"]), user_update.model_dump(exclude_unset=True))
    if not updated_user:
        return {
            "status": "success",
            "data": {
                "id": str(current_user["_id"]),
                "name": current_user.get("name"),
                "email": current_user.get("email"),
                "role": current_user.get("role")
            },
            "message": "No changes made"
        }
    
    return {
        "status": "success",
        "data": updated_user,
        "message": "Profile updated successfully"
    }


@router.get("/doctors", response_model=dict)
async def get_doctors(current_user: dict = Depends(get_current_user)):
    """Returns all registered doctors — used by patient form to assign a doctor."""
    cursor = users_collection.find({"role": "doctor"}, {"_id": 1, "name": 1, "email": 1})
    doctors = await cursor.to_list(length=200)
    result = [{"id": str(d["_id"]), "name": d.get("name", ""), "email": d.get("email", "")} for d in doctors]
    return {
        "status": "success",
        "data": result,
        "message": "Doctors fetched successfully"
    }

@router.post("/logout", response_model=dict)
async def logout(token: str = Depends(oauth2_scheme)):
    from database.mongodb import blacklist_tokens_collection
    await blacklist_tokens_collection.insert_one({"token": token})
    
    # Audit logging
    try:
        import jwt
        from utils.dependencies import SECRET_KEY, ALGORITHM
        from utils.audit import log_action
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            await log_action(user_id, "USER_LOGOUT", "User logged out voluntarily")
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Successfully logged out. Session terminated."
    }
