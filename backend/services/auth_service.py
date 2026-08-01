from fastapi import HTTPException, status
from schemas.user import UserCreate, UserLogin
from utils.security import get_password_hash, verify_password, create_access_token
from database.mongodb import users_collection
from bson import ObjectId

async def create_user(user: UserCreate):
    existing_user = await users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Verify OTP if provided for signup flow
    if user.otp_code is not None:
        await verify_otp_code(user.email, user.otp_code)
    
    user_data = user.model_dump(exclude={"otp_code"})
    user_data["password"] = get_password_hash(user.password)
    
    result = await users_collection.insert_one(user_data)
    
    return {"id": str(result.inserted_id), "name": user.name, "email": user.email, "role": user.role}

async def authenticate_user(email: str, password: str):
    db_user = await users_collection.find_one({"email": email})
    if not db_user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not verify_password(password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=str(db_user["_id"]), role=db_user.get("role", "patient"))
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": str(db_user["_id"]), "role": db_user["role"]}}

async def update_user_profile(user_id: str, profile_data: dict):
    update_data = {k: v for k, v in profile_data.items() if v is not None}
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
    db_user = await users_collection.find_one({"email": email})
    if not db_user:
        raise HTTPException(status_code=404, detail="Email not found")
        
    # If otp_code is provided, verify it first before resetting
    if otp_code is not None:
        await verify_otp_code(email, otp_code)
        
    hashed_password = get_password_hash(new_password)
    await users_collection.update_one(
        {"email": email},
        {"$set": {"password": hashed_password}}
    )
    return True

async def generate_and_save_otp(email: str, is_signup: bool = False) -> str:
    import random
    from datetime import datetime, timezone
    from database.mongodb import otp_codes_collection
    
    db_user = await users_collection.find_one({"email": email})
    if is_signup:
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
    else:
        if not db_user:
            raise HTTPException(status_code=404, detail="Email not found")
        
    # Generate 6-digit random code
    code = f"{random.randint(100000, 999999)}"
    
    # Delete old OTPs for this email
    await otp_codes_collection.delete_many({"email": email})
    
    # Save the new OTP with UTC timezone-aware current time
    await otp_codes_collection.insert_one({
        "email": email,
        "code": code,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Return the OTP (in production, this would be emailed to the user)
    return code

async def verify_otp_code(email: str, code: str) -> bool:
    from datetime import datetime, timezone, timedelta
    from database.mongodb import otp_codes_collection
    
    otp_record = await otp_codes_collection.find_one({"email": email, "code": code})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    # Temporal Expiry Check: strict 10-minute constraint
    created_at = otp_record["created_at"]
    # Ensure created_at has timezone info
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
        
    now = datetime.now(timezone.utc)
    if now - created_at > timedelta(minutes=10):
        # Purge expired code from database
        await otp_codes_collection.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="Verification code has expired (10-minute limit)")
        
    # Delete the code once verified successfully
    await otp_codes_collection.delete_one({"_id": otp_record["_id"]})
    return True
