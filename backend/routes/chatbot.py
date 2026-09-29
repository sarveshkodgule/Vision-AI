from fastapi import APIRouter, Depends
from schemas.chatbot import ChatQuery
from services.chatbot_service import process_chat_query, get_general_chatbot_response
from utils.dependencies import get_current_user
from database.mongodb import chat_history_collection
from datetime import datetime
import asyncio

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

@router.post("/query", response_model=dict)
async def query_chatbot(query: ChatQuery, current_user: dict = Depends(get_current_user)):
    result = await process_chat_query(str(current_user["_id"]), query)
    return {
        "status": "success",
        "data": result,
        "message": "Chatbot query processed successfully"
    }

@router.post("/general", response_model=dict)
async def query_general_chatbot(query: ChatQuery):
    # Unauthenticated route for landing page
    response_text = await asyncio.to_thread(get_general_chatbot_response, query.message)
    
    # Optionally store anonymous queries
    chat_record = {
        "user_id": "anonymous",
        "message": query.message,
        "response": response_text,
        "timestamp": datetime.now().isoformat()
    }
    await chat_history_collection.insert_one(chat_record)

    return {
        "status": "success",
        "data": {"response": response_text},
        "message": "General chatbot query processed successfully"
    }
