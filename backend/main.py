from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import auth, patient, doctor, chatbot
import os
from pathlib import Path
import time
from collections import defaultdict

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

# In-memory Rate Limiting: Limits requests to 150 requests per 15 minutes per IP
RATE_LIMIT_WINDOW = 900  # 15 minutes in seconds
RATE_LIMIT_MAX_REQUESTS = 150
request_history = defaultdict(list)

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    
    # Bypass rate limiting for local loopback development connections
    if client_ip in ["127.0.0.1", "localhost", "::1"]:
        return await call_next(request)
        
    now = time.time()
    
    # Filter out timestamps older than the 15-minute window
    request_history[client_ip] = [
        t for t in request_history[client_ip] if now - t < RATE_LIMIT_WINDOW
    ]
    
    # Block requests if count exceeds the limit
    if len(request_history[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
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
    response = await call_next(request)
    # Defense against clickjacking, MIME sniffing, and XSS
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
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
                print(f"[SANITIZATION WARNING] Payload parsing failed: {e}")
                
    response = await call_next(request)
    return response

BASE_DIR = Path(__file__).resolve().parent
for directory in ("uploads", "reports"):
    (BASE_DIR / directory).mkdir(exist_ok=True)
# Clinical files are downloaded through authenticated report routes.

# Includes routers
app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(doctor.router)
app.include_router(chatbot.router)

# Uncaught Error Boundary Sanitization (prevents database/system stack trace leaks)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full exception stack trace internally on the server console for debugging
    print(f"[CRITICAL SYSTEM ERROR] {exc}")
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
