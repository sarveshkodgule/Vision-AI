from datetime import datetime, timezone
from database.mongodb import audit_logs_collection

async def log_action(user_id: str, action: str, details: str = None, status: str = "success"):
    """
    Asynchronously logs a security or clinical action to the MongoDB audit_logs collection.
    """
    try:
        await audit_logs_collection.insert_one({
            "timestamp": datetime.now(timezone.utc),
            "user_id": user_id,
            "action": action,
            "details": details,
            "status": status
        })
    except Exception as e:
        print(f"[AUDIT LOG ERROR] Failed to write audit log: {e}")
