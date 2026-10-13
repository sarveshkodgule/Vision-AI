"""Explicit OpenAI/Groq provider selection; no silent fallback or fabricated answers."""
import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

from database.mongodb import chat_history_collection
from schemas.chatbot import ChatQuery

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
CHATBOT_PROVIDER = os.getenv("CHATBOT_PROVIDER", "openai").strip().lower()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip() or "openai/gpt-oss-20b"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
logger = logging.getLogger(__name__)
SYSTEM_PROMPT = (
    "You are Vision AI's eye-health education assistant. Answer clearly and concisely. "
    "Explain myopia and screening concepts without making a diagnosis. "
    "Never invent patient measurements, model predictions, appointments, contact details, "
    "or report contents. You have no access to patient records in this conversation. "
    "Explain that screening results support, but do not replace, a clinician's assessment. "
    "Do not claim to run XGBoost, EfficientNet, or Grad-CAM yourself."
    " Reply in the user's language. For Marathi, use simple everyday Marathi. "
    "Do not request passwords, OTPs or API keys."
)


def provider_config():
    if CHATBOT_PROVIDER == "groq":
        return GROQ_URL, GROQ_API_KEY, GROQ_MODEL, "GROQ_API_KEY"
    if CHATBOT_PROVIDER == "openai":
        return OPENAI_URL, OPENAI_API_KEY, OPENAI_MODEL, "OPENAI_API_KEY"
    raise HTTPException(status_code=503, detail="Unsupported chatbot provider. Set CHATBOT_PROVIDER to groq or openai in backend/.env.")


def _call_provider(message: str) -> str:
    url, key, model, key_setting = provider_config()
    if not key:
        raise HTTPException(status_code=503, detail=f"Chatbot not configured. Add {key_setting} to backend/.env and restart the backend.")
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {key}"},
            json={"model": model, "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ], "stream": False, "max_completion_tokens": 2048},
            timeout=httpx.Timeout(60.0, connect=10.0),
        )
        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"]
        if not isinstance(answer, str) or not answer.strip():
            raise ValueError("Empty response")
        return answer.strip()
    except httpx.HTTPStatusError as error:
        code = error.response.status_code
        logger.warning("%s chatbot request failed with HTTP %s", CHATBOT_PROVIDER, code)
        if code in (401, 403):
            detail = "Chatbot authentication or access failed. Check the backend API key and model access."
        elif code == 429:
            detail = "Chatbot usage limit reached. Check API credits or try again later."
        elif code in (400, 404):
            detail = "Chatbot model or request is unavailable. Check the configured model and provider access."
        else:
            detail = "Chatbot is temporarily unavailable. Please try again later."
        raise HTTPException(status_code=503, detail=detail) from None
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Chatbot took too long to respond. Please try again.") from None
    except (httpx.RequestError, ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(status_code=503, detail="Chatbot could not return a valid response. Please try again.") from None


def get_chatbot_response(message: str) -> str:
    return _call_provider(message)


def get_general_chatbot_response(message: str) -> str:
    return _call_provider(message)


async def process_chat_query(user_id: str, query: ChatQuery):
    response_text = await asyncio.to_thread(get_chatbot_response, query.message)
    await chat_history_collection.insert_one({
        "user_id": user_id, "message": query.message,
        "response": response_text, "provider": CHATBOT_PROVIDER, "model": provider_config()[2],
        "timestamp": datetime.now().isoformat(),
    })
    return {"response": response_text}
