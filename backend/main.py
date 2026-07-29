from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from routes import auth, patient, doctor, chatbot
import os
import time
from collections import defaultdict

app = FastAPI(
    title="Myopia Screening and Doctor Decision Support System API",
    description="Backend for AI-Based Myopia Screening System",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    response.headers["X-Frame-Options"] = "DENY"  # Prevents Clickjacking
    response.headers["X-Content-Type-Options"] = "nosniff"  # Prevents MIME-sniffing
    response.headers["X-XSS-Protection"] = "1; mode=block"  # Mitigates Cross-Site Scripting (XSS)
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

os.makedirs("uploads", exist_ok=True)
os.makedirs("reports", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

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

