from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import os
import logging
from database import get_db
from auth import get_current_active_user
from models import User, Transaction, Loan, Category
from ai_service import FinancialAIAgent
import pandas as pd
from datetime import datetime

router = APIRouter(prefix="/ai", tags=["AI Assistant"])
logger = logging.getLogger(__name__)

# Initialize AI agent (singleton)
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
        raise HTTPException(status_code=503, detail="AI service unavailable. Please configure OPENAI_API_KEY.")
    
    # Fetch user data
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
        "loans": [{"id": l.id, "name": l.name, "amount": l.amount} for l in loans],
        "income": {"active": current_user.active_income, "passive": current_user.passive_income},
        "categories": [{"id": c.id, "name": c.name} for c in categories],
        "debt_to_income": sum(l.amount for l in loans) / (current_user.active_income + current_user.passive_income + 1),
        "income_stability": 0.5  # placeholder
    }
    
    result = await ai_agent.process_query(query, user_data)
    return result

@router.get("/insights")
async def get_financial_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.date.desc()).limit(100).all()
    loans = db.query(Loan).filter(Loan.user_id == current_user.id).all()
    
    total_spent = sum(t.amount for t in transactions if t.amount < 0)
    total_income = sum(t.amount for t in transactions if t.amount > 0)
    
    # Category breakdown
    categories = {}
    for t in transactions:
        cat_name = t.category.name if t.category else "Uncategorized"
        categories[cat_name] = categories.get(cat_name, 0) + abs(t.amount)
    
    top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Simple health score
    health_score = 100
    factors = []
    dti = sum(l.amount for l in loans) / (current_user.active_income + current_user.passive_income + 1)
    if dti > 0.4:
        health_score -= 25
        factors.append("High debt-to-income ratio")
    savings_rate = (total_income - total_spent) / (total_income + 1)
    if savings_rate < 0.1:
        health_score -= 20
        factors.append("Low savings rate")
    
    return {
        "total_spent": total_spent,
        "total_income": total_income,
        "net_income": total_income - total_spent,
        "top_categories": top_categories,
        "transaction_count": len(transactions),
        "loan_count": len(loans),
        "health_score": {
            "score": max(0, health_score),
            "factors": factors,
            "rating": "Excellent" if health_score >= 80 else "Good" if health_score >= 60 else "Fair" if health_score >= 40 else "Needs Improvement"
        }
    }