from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import os
import logging
from database import get_db
from auth import get_current_active_user
from models import User, Transaction, Loan, Category
from ai_service import FinancialAIAgent

router = APIRouter(prefix="/ai", tags=["AI Assistant"])
logger = logging.getLogger(__name__)

_ai_agent = None

def get_ai_agent():
    global _ai_agent
    if _ai_agent is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not set")
            return None
        _ai_agent = FinancialAIAgent(api_key=api_key)
    return _ai_agent

@router.post("/chat")
async def chat_with_ai(
    request: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = request.get("query", "")
    if not query:
        raise HTTPException(status_code=400, detail="Query required")
    
    ai_agent = get_ai_agent()
    if not ai_agent:
        raise HTTPException(status_code=503, detail="AI service unavailable. Set OPENAI_API_KEY.")
    
    # Fetch user transactions
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    loans = db.query(Loan).filter(Loan.user_id == current_user.id).all()
    categories = db.query(Category).filter((Category.user_id == current_user.id) | (Category.user_id == None)).all()
    
    user_data = {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "description": t.description,
                "date": t.date.isoformat(),
                "category": t.category.name if t.category else "Uncategorized"
            }
            for t in transactions
        ],
        "loans": [{"name": l.name, "amount": l.amount} for l in loans],
        "income": {"active": current_user.active_income, "passive": current_user.passive_income},
        "categories": [c.name for c in categories]
    }
    
    result = await ai_agent.process_query(query, user_data)
    return result

@router.get("/insights")
async def get_financial_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    loans = db.query(Loan).filter(Loan.user_id == current_user.id).all()
    
    total_spent = sum(t.amount for t in transactions)
    total_income = current_user.active_income + current_user.passive_income
    net = total_income - total_spent
    
    # Category breakdown
    categories = {}
    for t in transactions:
        cat = t.category.name if t.category else "Uncategorized"
        categories[cat] = categories.get(cat, 0) + t.amount
    top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Health score
    score = 100
    if total_income > 0:
        savings_rate = (total_income - total_spent) / total_income
        if savings_rate < 0.1:
            score -= 20
        if total_spent / total_income > 0.5:
            score -= 15
    if sum(l.amount for l in loans) / (total_income + 1) > 0.4:
        score -= 25
    
    rating = "Excellent" if score >= 80 else "Good" if score >= 60 else "Fair" if score >= 40 else "Needs Improvement"
    
    return {
        "total_spent": total_spent,
        "total_income": total_income,
        "net_income": net,
        "top_categories": top_categories,
        "transaction_count": len(transactions),
        "loan_count": len(loans),
        "health_score": {"score": max(0, score), "rating": rating}
    }