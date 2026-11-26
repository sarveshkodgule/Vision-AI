import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

# Load .env explicitly using absolute path to prevent startup directory issues
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=False)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "myopia_db")

client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
patients_collection = db["patients"]
reports_collection = db["reports"]
clinical_data_collection = db["clinical_data"]
chat_history_collection = db["chat_history"]
otp_codes_collection = db["otp_codes"]
blacklist_tokens_collection = db["blacklist_tokens"]
audit_logs_collection = db["audit_logs"]
rate_limits_collection = db["rate_limits"]

async def ensure_indexes():
    """Create indexes required for common lookups and audit retention."""
    await users_collection.create_index("email", unique=True, sparse=True)
    await patients_collection.create_index("user_id")
    await patients_collection.create_index("assigned_doctor_id")
    await reports_collection.create_index([("patient_id", 1), ("created_at", -1)])
    await clinical_data_collection.create_index([("patient_id", 1), ("created_at", -1)])
    await audit_logs_collection.create_index([("user_id", 1), ("timestamp", -1)])
    await rate_limits_collection.create_index("expires_at", expireAfterSeconds=0)
    logging.getLogger(__name__).info("MongoDB indexes verified")

def get_db():
    return db
