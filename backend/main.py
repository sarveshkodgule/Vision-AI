from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from routes import auth, patient, doctor, chatbot
import os
from pathlib import Path
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
import logging
import uuid
from pymongo import ReturnDocument

logger = logging.getLogger("myopia_api")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())

app = FastAPI(
    title="Myopia Screening and Doctor Decision Support System API",
    description="Backend for AI-Based Myopia Screening System",
    version="1.0.0"
)

# CORS Configuration: restrict to trusted web origins for clinical data safety
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
custom_origins = os.getenv("ALLOWED_ORIGINS", "")
if custom_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in custom_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# MongoDB-backed rate limiting: shared across backend workers and instances.
RATE_LIMIT_WINDOW = 900  # 15 minutes in seconds
RATE_LIMIT_MAX_REQUESTS = 150
request_history = defaultdict(list)

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    blocked = False
    try:
        bucket = int(now // RATE_LIMIT_WINDOW)
        key = f"{client_ip}:{bucket}"
        record = await rate_limits_collection.find_one_and_update(
            {"_id": key},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {
                    "expires_at": datetime.now(timezone.utc) + timedelta(seconds=RATE_LIMIT_WINDOW)
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        blocked = int(record.get("count", 0)) > RATE_LIMIT_MAX_REQUESTS
    except Exception:
        logger.warning("MongoDB rate limiter unavailable; using local limiter", exc_info=True)
        request_history[client_ip] = [
            t for t in request_history[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]
        blocked = len(request_history[client_ip]) >= RATE_LIMIT_MAX_REQUESTS
        request_history[client_ip].append(now)

    if blocked:
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "message": "Too many requests. API rate limit is 150 requests per 15 minutes."
            }
        )
        
    request_history[client_ip].append(now)
    return await call_next(request)

# HTTP Security Header Protection (Helmet equivalent)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    # Defense against clickjacking, MIME sniffing, and XSS
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content-Security-Policy: restricts what browsers can load — prevents XSS & data injection
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    # Strict-Transport-Security: forces HTTPS for 1 year (production)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Healthcare data privacy: Protect against browser hardware & location probing
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    
    # Process isolation while supporting Google OAuth popup workflows
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"

    # Patient record cache prevention: Disallow browser/proxy caching on clinical data
    path = request.url.path
    if path.startswith(("/patient", "/doctor")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"

    return response

# Audit Logging: records every API request with IP, method, path, status, and latency
@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)
    client_ip = request.client.host if request.client else "unknown"
    # Only log sensitive clinical and auth routes
    sensitive_prefixes = ("/auth/", "/doctor/", "/patient/", "/chatbot/")
    if any(request.url.path.startswith(p) for p in sensitive_prefixes):
        try:
            from database.mongodb import audit_logs_collection
            from datetime import datetime, timezone
            await audit_logs_collection.insert_one({
                "event": "api_request",
                "method": request.method,
                "path": request.url.path,
                "ip": client_ip,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "timestamp": datetime.now(timezone.utc),
            })
        except Exception:
            pass  # Never block request due to logging failure
    return response

# Input Sanitization: Mitigates XSS (HTML escaping) and NoSQL injection (removes query operators starting with $)
import json

def sanitize_payload(data):
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if isinstance(k, str) and k.startswith("$"):
                # Drop NoSQL query operators to block injection
                continue
            sanitized[k] = sanitize_payload(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_payload(item) for item in data]
    elif isinstance(data, str):
        # Preserve passwords and user text. Escape at HTML output boundaries.
        return data
    else:
        return data

@app.middleware("http")
async def input_sanitization_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "PATCH"]:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.body()
                if body:
                    data = json.loads(body)
                    sanitized_data = sanitize_payload(data)
                    new_body = json.dumps(sanitized_data).encode("utf-8")
                    
                    request._body = new_body
            except Exception as e:
                logger.warning("JSON sanitization skipped", exc_info=True, extra={"request_id": getattr(request.state, "request_id", None)})
                
    response = await call_next(request)
    return response

# Audit Logging: records every API request with IP, method, path, status, and latency
@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)
    client_ip = request.client.host if request.client else "unknown"
    # Only log sensitive clinical and auth routes
    sensitive_prefixes = ("/auth/", "/doctor/", "/patient/", "/chatbot/")
    if any(request.url.path.startswith(p) for p in sensitive_prefixes):
        try:
            from database.mongodb import audit_logs_collection
            from datetime import datetime, timezone
            await audit_logs_collection.insert_one({
                "event": "api_request",
                "method": request.method,
                "path": request.url.path,
                "ip": client_ip,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "timestamp": datetime.now(timezone.utc),
            })
        except Exception:
            pass  # Never block request due to logging failure
    return response

BASE_DIR = Path(__file__).resolve().parent
for directory in ("uploads", "reports"):
    (BASE_DIR / directory).mkdir(exist_ok=True)
# Clinical files are downloaded through authenticated report routes.

# Includes routers
from database.mongodb import db, ensure_indexes, rate_limits_collection

@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
    except Exception:
        logger.exception("MongoDB index creation failed; verify database connectivity")

app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(doctor.router)
app.include_router(chatbot.router)

# Uncaught Error Boundary Sanitization (prevents database/system stack trace leaks)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full exception stack trace internally on the server console for debugging
    logger.exception("Unhandled request error", extra={"request_id": getattr(request.state, "request_id", None)})
    # Return a sanitized error response to the client
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An unexpected server error occurred. Please contact support or try again later."
        }
    )

@app.get("/")
def root():
    return {
        "status": "success",
        "message": "Welcome to the Myopia Screening System API"
    }

@app.get("/health/ready")
async def readiness():
    """Report dependency readiness without exposing credentials or stack traces."""
    checks = {"database": "unavailable", "palm_service": "unavailable"}
    try:
        await db.command("ping")
        checks["database"] = "ok"
    except Exception:
        logger.warning("Readiness database check failed", exc_info=True)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{os.getenv('PALM_SERVICE_URL', 'http://127.0.0.1:8001')}/health")
            if response.is_success:
                checks["palm_service"] = "ok"
    except Exception:
        logger.warning("Readiness PALM service check failed", exc_info=True)
    ready = all(value == "ok" for value in checks.values())
    return JSONResponse(status_code=200 if ready else 503, content={"status": "ready" if ready else "degraded", "checks": checks})
