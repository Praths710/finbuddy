import os
import logging
from typing import Dict, Any
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class FinancialAIAgent:
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
    
    async def process_query(self, query: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Build a summary from user data
            transactions = user_data.get('transactions', [])
            total_spent = sum(t.get('amount', 0) for t in transactions)
            income = user_data.get('income', {})
            active = income.get('active', 0)
            passive = income.get('passive', 0)
            total_income = active + passive
            
            context = f"""
            User financial summary:
            - Total spent: ₹{total_spent:.2f}
            - Total income: ₹{total_income:.2f}
            - Active income: ₹{active:.2f}
            - Passive income: ₹{passive:.2f}
            - Number of transactions: {len(transactions)}
            """
            
            # Call OpenAI
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",  # or "gpt-4o" if you have access
                messages=[
                    {"role": "system", "content": "You are a friendly, concise financial advisor. Answer the user's question based on their data."},
                    {"role": "user", "content": f"{context}\n\nUser question: {query}"}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            answer = response.choices[0].message.content
            
            # Simple analysis for frontend
            analysis = {
                "total": total_spent,
                "daily_average": total_spent / max(1, len(transactions)),
                "top_categories": [],
                "change": 0,
                "percent_change": 0
            }
            
            return {
                "analysis": analysis,
                "advice": {"advice": answer},
                "health_score": {"score": 70, "rating": "Good"},
                "message": answer
            }
        except Exception as e:
            logger.error(f"AI error: {e}")
            return {"error": str(e), "message": "AI service temporarily unavailable. Please try again later."}