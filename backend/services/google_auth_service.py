"""Google Identity Services verification; roles are assigned only on the server."""
import os
import re
import secrets
from functools import partial
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from pymongo.errors import DuplicateKeyError

from database.mongodb import users_collection
from utils.security import SECRET_KEY, ALGORITHM, create_access_token


def google_config():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id or not client_id.endswith(".apps.googleusercontent.com"):
        raise HTTPException(503, "Google sign-in is not configured yet. Please contact the hospital.")
    if len(SECRET_KEY) < 32 or SECRET_KEY == "supersecretkey_please_change_in_production":
        raise HTTPException(503, "Portal sign-in security is not configured. Please contact the hospital.")
    nonce = secrets.token_urlsafe(32)
    challenge = jwt.encode({"purpose": "google-login", "nonce": nonce,
                            "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"client_id": client_id, "nonce": nonce, "challenge": challenge}


def verify_google_credential(credential: str, challenge: str):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id or not client_id.endswith(".apps.googleusercontent.com"):
        raise HTTPException(503, "Google sign-in is not configured yet. Please contact the hospital.")
    if len(SECRET_KEY) < 32 or SECRET_KEY == "supersecretkey_please_change_in_production":
        raise HTTPException(503, "Portal sign-in security is not configured. Please contact the hospital.")
    try:
        context = jwt.decode(challenge, SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "nonce"]})
        if context.get("purpose") != "google-login":
            raise ValueError("Wrong challenge purpose")
        from google.oauth2 import id_token
        from google.auth.transport.requests import Request
        claims = id_token.verify_oauth2_token(credential, partial(Request(), timeout=10), client_id)
        if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Wrong issuer")
        if not isinstance(claims.get("nonce"), str) or not secrets.compare_digest(claims["nonce"], context["nonce"]):
            raise ValueError("Wrong nonce")
        if not claims.get("sub") or claims.get("email_verified") is not True or not claims.get("email"):
            raise ValueError("Unverified identity")
        # Google cannot establish current ownership of a third-party mailbox.
        email = claims["email"].lower().strip()
        if not email.endswith("@gmail.com") and not claims.get("hd"):
            raise HTTPException(403, "Use a Gmail or Google Workspace account with a verified email address.")
        return {"sub": claims["sub"], "email": email, "name": str(claims.get("name") or "Patient")[:120]}
    except HTTPException:
        raise
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, "Google sign-in expired or could not be verified. Please try again.") from None
    except Exception:
        raise HTTPException(503, "Google verification is temporarily unavailable. Please try again.") from None


async def authenticate_google(credential: str, challenge: str):
    identity = await run_in_threadpool(verify_google_credential, credential, challenge)
    # Sparse index leaves legacy accounts without google_sub untouched.
    await users_collection.create_index("google_sub", unique=True, sparse=True)
    user = await users_collection.find_one({"google_sub": identity["sub"]})
    if not user:
        matches = await users_collection.find({"email": {"$regex": f"^{re.escape(identity['email'])}$", "$options": "i"}}).to_list(length=2)
        if len(matches) > 1:
            raise HTTPException(409, "More than one hospital account uses this email. Please contact the hospital.")
        if matches:
            user = matches[0]
            if user.get("google_sub") and user["google_sub"] != identity["sub"]:
                raise HTTPException(409, "This hospital account is linked to a different Google account.")
            updated = await users_collection.update_one(
                {"_id": user["_id"], "google_sub": {"$exists": False}},
                {"$set": {"google_sub": identity["sub"], "auth_provider": "google"}},
            )
            if not updated.modified_count:
                user = await users_collection.find_one({"_id": user["_id"], "google_sub": identity["sub"]})
                if not user:
                    raise HTTPException(409, "Account linking changed. Please try signing in again.")
        else:
            user = {"name": identity["name"], "email": identity["email"], "role": "patient",
                    "google_sub": identity["sub"], "auth_provider": "google", "created_at": datetime.now(timezone.utc)}
            try:
                inserted = await users_collection.insert_one(user)
                user["_id"] = inserted.inserted_id
            except DuplicateKeyError:
                user = await users_collection.find_one({"google_sub": identity["sub"]})
                if not user:
                    raise HTTPException(409, "Account already exists. Please sign in again.") from None
    if user.get("role") not in ("patient", "doctor"):
        raise HTTPException(403, "This account has no portal access. Please contact the hospital.")
    return {"access_token": create_access_token(str(user["_id"]), user["role"]), "token_type": "bearer",
            "user": {"id": str(user["_id"]), "name": user.get("name"), "email": user["email"], "role": user["role"]}}
