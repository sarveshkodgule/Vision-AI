"""
encryption.py — Fernet symmetric encryption for sensitive patient fields stored in MongoDB.

Usage:
    from utils.encryption import encrypt_field, decrypt_field

    # Before storing in MongoDB:
    encrypted = encrypt_field("patient@email.com")
    db.insert_one({"contact_email": encrypted, ...})

    # After reading from MongoDB:
    plain = decrypt_field(encrypted)

The encryption key is loaded from the FIELD_ENCRYPTION_KEY environment variable.
Generate a key with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
Add this to your .env as: FIELD_ENCRYPTION_KEY=<generated_key>

If the key is not set, encryption is disabled and plain text is stored
(with a warning) — this allows gradual rollout without breaking existing data.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

base_dir = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=base_dir / ".env", override=False)

logger = logging.getLogger(__name__)

_fernet = None

def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    key = os.getenv("FIELD_ENCRYPTION_KEY", "").strip()
    if not key:
        logger.warning(
            "[Encryption] FIELD_ENCRYPTION_KEY not set — sensitive fields stored in plain text. "
            "Generate a key with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
        return None
    try:
        from cryptography.fernet import Fernet
        _fernet = Fernet(key.encode())
        return _fernet
    except Exception as e:
        logger.error(f"[Encryption] Invalid FIELD_ENCRYPTION_KEY: {e}")
        return None


def encrypt_field(value: str) -> str:
    """
    Encrypt a string field before storing in the database.
    Returns the encrypted value prefixed with 'enc:' so we can detect encrypted fields.
    Falls back to plain text if the key is not configured.
    """
    if not value:
        return value
    f = _get_fernet()
    if f is None:
        return value  # Graceful fallback: store plain text
    try:
        return "enc:" + f.encrypt(value.encode()).decode()
    except Exception as e:
        logger.error(f"[Encryption] Failed to encrypt field: {e}")
        return value


def decrypt_field(value: str) -> str:
    """
    Decrypt a field value read from the database.
    Automatically handles both encrypted ('enc:' prefix) and legacy plain-text values.
    """
    if not value or not isinstance(value, str):
        return value
    if not value.startswith("enc:"):
        return value  # Legacy plain-text value — return as-is
    f = _get_fernet()
    if f is None:
        logger.warning("[Encryption] Cannot decrypt — FIELD_ENCRYPTION_KEY not set")
        return value
    try:
        return f.decrypt(value[4:].encode()).decode()
    except Exception as e:
        logger.error(f"[Encryption] Failed to decrypt field: {e}")
        return value  # Return raw value rather than crash
