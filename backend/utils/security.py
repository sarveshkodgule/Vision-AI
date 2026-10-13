import os
from datetime import datetime, timedelta, timezone
from typing import Any, Union
import jwt
import bcrypt
import hashlib
from dotenv import load_dotenv

# Load .env explicitly using absolute path to prevent startup directory issues
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "supersecretkey_please_change_in_production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

def get_password_hash(password: str) -> str:
    # Pre-hash with SHA256 to allow infinite password lengths securely (bypasses 72 byte limit)
    pwd_sha256 = hashlib.sha256(password.encode()).hexdigest().encode()
    salt = bcrypt.gensalt(rounds=8)
    return bcrypt.hashpw(pwd_sha256, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    candidates = [plain_password]
    trimmed = plain_password.strip()
    if trimmed not in candidates:
        candidates.append(trimmed)
    for cand in candidates:
        try:
            cand_sha256 = hashlib.sha256(cand.encode()).hexdigest().encode()
            if bcrypt.checkpw(cand_sha256, hashed_password.encode('utf-8')):
                return True
        except Exception:
            pass
        try:
            if bcrypt.checkpw(cand.encode('utf-8'), hashed_password.encode('utf-8')):
                return True
        except Exception:
            pass
    return False

def create_access_token(subject: Union[str, Any], role: str = "patient", expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "role": role}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
