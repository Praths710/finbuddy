import os
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

class FinancialAIAgent:
    def __init__(self, api_key: str):
        self.llm = ChatOpenAI(
            api_key=api_key,
            model="gpt-4o",
            temperature=0.1,
            max_tokens=1000
        )
    
    async def process_query(self, query: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Simple analysis without heavy ML
            transactions = pd.DataFrame(user_data.get('transactions', []))
            if transactions.empty:
                return {"message": "No transaction data available yet. Add some transactions to get insights."}
            
            # Basic spending analysis
            total_spent = transactions['amount'].sum()
            avg_transaction = transactions['amount'].mean()
            
            # Category breakdown
            category_spending = transactions.groupby('category')['amount'].sum().to_dict()
            top_categories = sorted(category_spending.items(), key=lambda x: x[1], reverse=True)[:3]
            
            # Prepare response
            response = f"Based on your data:\n"
            response += f"- Total spent: ₹{total_spent:.2f}\n"
            response += f"- Average transaction: ₹{avg_transaction:.2f}\n"
            response += f"- Top spending categories: {', '.join([f'{cat} (₹{amt:.2f})' for cat, amt in top_categories])}\n"
            
            # Use LLM for advice
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a friendly financial advisor. Give concise, actionable advice based on the user's spending data."),
                ("user", f"User spending: {response}\nUser question: {query}")
            ])
            advice_response = await self.llm.ainvoke(prompt.format_messages())
            advice = advice_response.content
            
            return {
                "analysis": {
                    "total": total_spent,
                    "daily_average": total_spent / max(1, len(transactions)),
                    "top_categories": top_categories,
                    "change": 0,
                    "percent_change": 0
                },
                "advice": {"advice": advice},
                "health_score": {"score": 70, "rating": "Good"},
                "message": response
            }
        except Exception as e:
            logger.error(f"AI processing error: {e}")
            return {"error": str(e), "message": "Sorry, I encountered an error processing your request."}