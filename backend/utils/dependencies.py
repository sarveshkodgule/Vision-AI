from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from typing import Optional
from database.mongodb import users_collection
from bson import ObjectId
import os
from dotenv import load_dotenv

# Load .env explicitly using absolute path to prevent startup directory issues
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "supersecretkey_please_change_in_production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Setting auto_error=False to handle missing tokens gracefully in some contexts if needed
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not isinstance(user_id, str) or not ObjectId.is_valid(user_id):
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    from database.mongodb import blacklist_tokens_collection
    if await blacklist_tokens_collection.find_one({"token": token}):
        raise credentials_exception
    
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    
    # Add string ID for convenience
    user["id"] = str(user["_id"])
    return user

async def get_current_doctor(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user
