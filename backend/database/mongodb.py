import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load .env explicitly using absolute path to prevent startup directory issues
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "myopia_db")

client = AsyncIOMotorClient(MONGODB_URI)
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

def get_db():
    return db
