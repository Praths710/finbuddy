import os
import logging
from typing import Dict, Any
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Groq's free API speaks the OpenAI protocol, so the openai library works with
# it. To use OpenAI instead, set AI_BASE_URL=https://api.openai.com/v1 and
# AI_MODEL=gpt-4o-mini.
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1")
AI_MODEL = os.getenv("AI_MODEL", "llama-3.3-70b-versatile")

class FinancialAIAgent:
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key, base_url=AI_BASE_URL)
    
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
                model=AI_MODEL,
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