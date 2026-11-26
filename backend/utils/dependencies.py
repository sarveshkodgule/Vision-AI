from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional
from database.mongodb import users_collection
from bson import ObjectId
from utils.security import SECRET_KEY, ALGORITHM

# Setting auto_error=False to handle missing tokens gracefully in some contexts if needed
bearer_scheme = HTTPBearer(auto_error=False)

async def oauth2_scheme(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in with Google to access your portal.", headers={"WWW-Authenticate": "Bearer"})
    return credentials.credentials

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
    if user is None or user.get("is_active", True) is False:
        raise credentials_exception

    user_tv = int(user.get("token_version", 0))
    token_tv = payload.get("tv")
    if token_tv is not None:
        if int(token_tv) != user_tv:
            raise credentials_exception
    elif user_tv > 0:
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
