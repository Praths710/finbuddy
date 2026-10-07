from datetime import datetime
from typing import Dict
import os
import logging

import market

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_active_user
from models import User, Transaction, Loan, Budget, Goal, Holding
from portfolio import position
from ai_service import FinancialAIAgent, summarize

router = APIRouter(prefix="/ai", tags=["AI Assistant"])
logger = logging.getLogger(__name__)

_ai_agent = None

def get_ai_agent():
    global _ai_agent
    if _ai_agent is None:
        api_key = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("AI_API_KEY not set")
            return None
        _ai_agent = FinancialAIAgent(api_key=api_key)
    return _ai_agent

def load_user_data(db: Session, user: User) -> Dict:
    now = datetime.utcnow()
    transactions = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    # Only loans still running count towards this month's EMIs
    loans = [l for l in db.query(Loan).filter(Loan.user_id == user.id).all()
             if l.end_date is None or l.end_date >= now]
    return {
        "transactions": [
            {
                "amount": t.amount,
                "description": t.description,
                "date": t.date.isoformat(),
                "category": t.category.name if t.category else "Uncategorized",
            }
            for t in transactions
        ],
        "loans": [{"name": l.name, "amount": l.amount} for l in loans],
        "budgets": [
            {"category": b.category.name if b.category else "?", "limit": b.amount}
            for b in db.query(Budget).filter(Budget.user_id == user.id).all()
        ],
        "goals": [
            {"name": g.name, "target": g.target, "saved": g.saved or 0,
             "deadline": g.deadline.date().isoformat() if g.deadline else None}
            for g in db.query(Goal).filter(Goal.user_id == user.id).all()
        ],
        "investments": [
            {"name": h.name, "type": h.asset_type, "symbol": h.symbol, **position(h.lots),
             "sip": sum(s.amount for s in h.sips if s.active)}
            for h in db.query(Holding).filter(Holding.user_id == user.id).all()
        ],
        "income": {"active": user.active_income or 0, "passive": user.passive_income or 0},
    }

@router.post("/chat")
async def chat_with_ai(
    request: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = request.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query required")

    ai_agent = get_ai_agent()
    if not ai_agent:
        raise HTTPException(status_code=503, detail="The AI assistant isn't configured yet (AI_API_KEY missing on the server).")

    data = load_user_data(db, current_user)
    # Value investments at live prices so the assistant can talk about real returns
    owned = [i for i in data["investments"] if i["units"] > 0]
    if owned:
        try:
            quotes = await market.get_quotes([(i["type"], i["symbol"]) for i in owned])
            for i in owned:
                q = quotes.get((i["type"], i["symbol"]))
                i["value"] = i["units"] * q["price"] if q else None
        except Exception as e:
            logger.warning(f"AI portfolio pricing failed: {e}")
    return await ai_agent.process_query(query, data)

@router.get("/insights")
def get_financial_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return summarize(load_user_data(db, current_user))
