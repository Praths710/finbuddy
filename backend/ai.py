from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import os
from ..database import get_db
from ..auth import get_current_active_user
from ..models import User, Transaction, Loan, Category
from ..ai_service import FinancialAIAgent
import logging

router = APIRouter(prefix="/ai", tags=["AI Assistant"])
logger = logging.getLogger(__name__)

# Initialize AI agent (singleton pattern)
_ai_agent = None

def get_ai_agent():
    global _ai_agent
    if _ai_agent is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not set, AI features disabled")
            return None
        try:
            _ai_agent = FinancialAIAgent(api_key=api_key)
        except Exception as e:
            logger.error(f"Failed to initialize AI agent: {e}")
            return None
    return _ai_agent

@router.post("/chat")
async def chat_with_ai(
    request: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Process natural language query about user's finances
    Similar to Starling Bank's Spending Intelligence [citation:5][citation:8]
    """
    query = request.get("query", "")
    if not query:
        raise HTTPException(status_code=400, detail="Query required")
    
    # Get AI agent
    ai_agent = get_ai_agent()
    if not ai_agent:
        raise HTTPException(
            status_code=503, 
            detail="AI service unavailable. Please configure OPENAI_API_KEY."
        )
    
    try:
        # Fetch user's financial data
        transactions = db.query(Transaction).filter(
            Transaction.user_id == current_user.id
        ).all()
        
        loans = db.query(Loan).filter(
            Loan.user_id == current_user.id
        ).all()
        
        categories = db.query(Category).filter(
            (Category.user_id == current_user.id) | (Category.user_id == None)
        ).all()
        
        # Prepare user data
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
            "loans": [
                {
                    "id": l.id,
                    "name": l.name,
                    "amount": l.amount,
                    "start_date": l.start_date.isoformat(),
                    "end_date": l.end_date.isoformat() if l.end_date else None
                }
                for l in loans
            ],
            "income": {
                "active": current_user.active_income,
                "passive": current_user.passive_income
            },
            "categories": [{"id": c.id, "name": c.name} for c in categories],
            "debt_to_income": await calculate_dti(current_user, loans),
            "income_stability": await calculate_income_stability(transactions)
        }
        
        # Process query with AI agent
        result = await ai_agent.process_query(query, user_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing AI query: {e}")
        raise HTTPException(status_code=500, detail="Error processing request")

@router.get("/insights")
async def get_financial_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get pre-generated financial insights and health score
    """
    # Fetch recent transactions
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.date.desc()).limit(100).all()
    
    loans = db.query(Loan).filter(
        Loan.user_id == current_user.id
    ).all()
    
    # Calculate basic metrics
    total_spent = sum(t.amount for t in transactions if t.amount < 0)
    total_income = sum(t.amount for t in transactions if t.amount > 0)
    
    # Category breakdown
    categories = {}
    for t in transactions:
        cat_name = t.category.name if t.category else "Uncategorized"
        if cat_name not in categories:
            categories[cat_name] = 0
        categories[cat_name] += t.amount
    
    # Top spending categories
    top_categories = sorted(categories.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
    
    # Financial health score
    health_score = 100
    factors = []
    
    # Debt-to-income
    dti = await calculate_dti(current_user, loans)
    if dti > 0.4:
        health_score -= 25
        factors.append("High debt-to-income ratio")
    
    # Savings rate
    savings_rate = (total_income - abs(total_spent)) / (total_income + 1)
    if savings_rate < 0.1:
        health_score -= 20
        factors.append("Low savings rate")
    
    return {
        "total_spent": abs(total_spent),
        "total_income": total_income,
        "net_income": total_income - abs(total_spent),
        "top_categories": top_categories,
        "transaction_count": len(transactions),
        "loan_count": len(loans),
        "health_score": {
            "score": max(0, health_score),
            "factors": factors,
            "rating": "Excellent" if health_score >= 80 else "Good" if health_score >= 60 else "Fair" if health_score >= 40 else "Needs Improvement"
        }
    }

@router.post("/analyze-emotional")
async def analyze_emotional_spending(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Specialized analysis for emotional spending patterns [citation:3]
    """
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.date.desc()).limit(500).all()
    
    if len(transactions) < 20:
        return {"message": "Need at least 20 transactions for emotional analysis"}
    
    # Convert to pandas for analysis
    import pandas as pd
    df = pd.DataFrame([
        {
            "date": t.date,
            "amount": t.amount,
            "description": t.description,
            "category": t.category.name if t.category else "Uncategorized"
        }
        for t in transactions
    ])
    
    df['date'] = pd.to_datetime(df['date'])
    df['day_of_week'] = df['date'].dt.day_name()
    df['hour'] = df['date'].dt.hour
    df['is_weekend'] = df['date'].dt.dayofweek >= 5
    
    insights = []
    
    # Weekend vs weekday spending
    weekend_avg = df[df['is_weekend']]['amount'].mean()
    weekday_avg = df[~df['is_weekend']]['amount'].mean()
    
    if weekend_avg > weekday_avg * 1.5:
        insights.append({
            "type": "weekend_spending",
            "message": "You spend significantly more on weekends. Consider planning weekend activities.",
            "data": {"weekend_avg": weekend_avg, "weekday_avg": weekday_avg}
        })
    
    # Late night spending (10 PM - 5 AM)
    late_night = df[(df['hour'] >= 22) | (df['hour'] <= 5)]['amount'].mean()
    daytime = df[(df['hour'] < 22) & (df['hour'] > 5)]['amount'].mean()
    
    if late_night > daytime * 1.3:
        insights.append({
            "type": "late_night",
            "message": "Your late-night purchases tend to be larger. Consider a 'cooling off' period.",
            "data": {"late_night_avg": late_night, "daytime_avg": daytime}
        })
    
    # Detect unusual spending patterns (potential emotional triggers)
    from sklearn.ensemble import IsolationForest
    try:
        X = df[['amount']].values
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        anomalies = iso_forest.fit_predict(X)
        
        anomaly_count = sum(anomalies == -1)
        if anomaly_count > 0:
            insights.append({
                "type": "anomalies",
                "message": f"Found {anomaly_count} unusual transactions that might be emotional purchases.",
                "data": {"count": anomaly_count}
            })
    except:
        pass
    
    return {
        "insights": insights,
        "emotional_score": 100 - min(len(insights) * 10, 50),
        "recommendations": [
            "Set a 24-hour waiting period for purchases over a certain amount",
            "Use cash or debit cards instead of credit for discretionary spending",
            "Track your mood when making purchases to identify triggers"
        ]
    }

async def calculate_dti(user: User, loans: List) -> float:
    """Calculate debt-to-income ratio"""
    monthly_income = user.active_income + user.passive_income
    monthly_debt = sum(l.amount for l in loans)
    
    if monthly_income == 0:
        return 1.0  # Max ratio if no income
    return monthly_debt / monthly_income

async def calculate_income_stability(transactions: List) -> float:
    """Calculate income stability score (0-1)"""
    if len(transactions) < 3:
        return 0.5
    
    import numpy as np
    incomes = [t.amount for t in transactions if t.amount > 0]
    
    if len(incomes) < 2:
        return 0.5
    
    # Coefficient of variation (lower is more stable)
    cv = np.std(incomes) / (np.mean(incomes) + 0.01)
    stability = 1 / (1 + cv)  # Convert to 0-1 scale
    return stability