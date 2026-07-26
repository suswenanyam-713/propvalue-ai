from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import datetime

from backend.database.session import get_db
from backend.database.models import ChatHistory
from backend.auth.utils import get_optional_current_user
from backend.services.assistant.hybridAssistant import process_hybrid_rag_query

router = APIRouter(prefix="/api", tags=["AI Chat Assistant"])

class ChatInputSchema(BaseModel):
    message: str | None = None
    question: str | None = None
    conversationId: str | None = None

@router.post("/chat")
@router.post("/assistant/chat")
def chat_with_assistant(data: ChatInputSchema, db: Session = Depends(get_db), current_user = Depends(get_optional_current_user)):
    try:
        user_query = data.message or data.question or ""
        if not user_query.strip():
            raise HTTPException(status_code=400, detail="Query message cannot be empty")

        # Process through Hybrid Real Estate RAG Engine
        res = process_hybrid_rag_query(user_query, conversation_id=data.conversationId, db=db)

        # Log conversation in Database if user is logged in (safe for read-only serverless DB)
        if current_user:
            try:
                chat_log = ChatHistory(
                    user_id=current_user.id,
                    question=user_query,
                    answer=res["answer"]
                )
                db.add(chat_log)
                db.commit()
            except Exception as db_err:
                db.rollback()
                print(f"[Chat History Log Warning]: Skipping DB write on read-only filesystem: {db_err}")

        return {
            "answer": res["answer"],
            "intent": res["intent"],
            "entities": res["entities"],
            "sources": res["sources"],
            "confidence": res["confidence"],
            "properties": res["properties"]
        }
    except Exception as e:
        print(f"[Chat Assistant Error]: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant processing error: {str(e)}"
        )

@router.get("/chat/history")
def get_chat_history(db: Session = Depends(get_db), current_user = Depends(get_optional_current_user)):
    try:
        if not current_user:
            return []
        history = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).order_by(ChatHistory.created_at.asc()).all()
        chat_history = []
        for h in history:
            chat_history.append({"role": "user", "content": h.question})
            chat_history.append({"role": "assistant", "content": h.answer})
        return chat_history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
