import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from prophet import Prophet
from sklearn.ensemble import IsolationForest
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FinancialAIAgent:
    """
    Multi-agent AI system for financial analysis and advice
    Based on architectures from FinAICopilot and Finance Assistant projects [citation:1][citation:2]
    """
    
    def __init__(self, api_key: str = None, model: str = "gpt-4o"):
        """Initialize with OpenAI API key"""
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key required")
        
        # Initialize LLM with financial-optimized settings [citation:2]
        self.llm = ChatOpenAI(
            api_key=self.api_key,
            model=model,
            temperature=0.1,  # Low temperature for factual accuracy
            max_tokens=1000
        )
        
        # Initialize analysis agents
        self.data_agent = DataRetrievalAgent()
        self.analysis_agent = SpendingAnalysisAgent()
        self.advice_agent = FinancialAdviceAgent(self.llm)
        self.emotion_agent = EmotionalSpendingAgent()
        
    async def process_query(self, query: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process natural language query about finances
        Similar to Starling Bank's Spending Intelligence [citation:5][citation:8]
        """
        try:
            # Step 1: Classify query type
            query_type = self._classify_query(query)
            
            # Step 2: Retrieve relevant data
            context = await self.data_agent.get_context(user_data, query_type)
            
            # Step 3: Perform analysis
            if "spending" in query_type:
                analysis = await self.analysis_agent.analyze_spending(
                    context['transactions'], query
                )
            elif "forecast" in query_type:
                analysis = await self.analysis_agent.forecast_spending(
                    context['transactions']
                )
            elif "compare" in query_type:
                analysis = await self.analysis_agent.compare_periods(
                    context['transactions'], query
                )
            else:
                analysis = await self.analysis_agent.general_analysis(
                    context, query
                )
            
            # Step 4: Detect emotional spending patterns
            emotional_insights = await self.emotion_agent.analyze(
                context['transactions']
            )
            
            # Step 5: Generate advice and conclusion
            advice = await self.advice_agent.generate_advice(
                analysis, emotional_insights, query
            )
            
            # Step 6: Calculate financial health score
            health_score = self._calculate_health_score(user_data, analysis)
            
            return {
                "query": query,
                "analysis": analysis,
                "emotional_insights": emotional_insights,
                "advice": advice,
                "health_score": health_score,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return {
                "error": str(e),
                "message": "I couldn't process your request. Please try again."
            }
    
    def _classify_query(self, query: str) -> str:
        """Classify the type of financial query"""
        query_lower = query.lower()
        
        if any(word in query_lower for word in ['spent', 'spend', 'cost', 'buy']):
            return "spending_query"
        elif any(word in query_lower for word in ['forecast', 'predict', 'future', 'will']):
            return "forecast_query"
        elif any(word in query_lower for word in ['compare', 'vs', 'versus', 'difference']):
            return "comparison_query"
        elif any(word in query_lower for word in ['save', 'saving', 'budget']):
            return "savings_query"
        elif any(word in query_lower for word in ['emotional', 'feel', 'stress', 'happy']):
            return "emotional_query"
        else:
            return "general_query"
    
    def _calculate_health_score(self, user_data: Dict, analysis: Dict) -> Dict:
        """
        Calculate financial health score based on multiple factors
        Similar to Beem's financial wellness scoring [citation:3]
        """
        score = 100
        factors = []
        
        # Income stability
        if user_data.get('income_stability', 0.5) < 0.3:
            score -= 15
            factors.append("Variable income detected")
        
        # Savings rate (assuming at least 20% is good)
        savings_rate = analysis.get('savings_rate', 0)
        if savings_rate < 0.1:
            score -= 20
            factors.append("Low savings rate")
        elif savings_rate > 0.3:
            score += 10
            factors.append("Excellent savings rate")
        
        # Debt-to-income ratio
        dti = user_data.get('debt_to_income', 0)
        if dti > 0.4:
            score -= 25
            factors.append("High debt-to-income ratio")
        elif dti < 0.2:
            score += 10
            factors.append("Healthy debt level")
        
        # Spending consistency
        volatility = analysis.get('spending_volatility', 0)
        if volatility > 0.5:
            score -= 15
            factors.append("Highly variable spending")
        
        return {
            "score": max(0, min(100, score)),
            "factors": factors,
            "rating": "Excellent" if score >= 80 else "Good" if score >= 60 else "Fair" if score >= 40 else "Needs Improvement"
        }


class DataRetrievalAgent:
    """Agent responsible for fetching and preparing user financial data"""
    
    async def get_context(self, user_data: Dict, query_type: str) -> Dict:
        """Prepare context for AI analysis"""
        # Extract transactions
        transactions = pd.DataFrame(user_data.get('transactions', []))
        loans = pd.DataFrame(user_data.get('loans', []))
        
        # Process transactions
        if not transactions.empty:
            transactions['date'] = pd.to_datetime(transactions['date'])
            transactions = transactions.sort_values('date')
        
        return {
            'transactions': transactions,
            'loans': loans,
            'income': user_data.get('income', {}),
            'categories': user_data.get('categories', []),
            'timeframe': query_type
        }


class SpendingAnalysisAgent:
    """Agent for analyzing spending patterns and trends"""
    
    async def analyze_spending(self, transactions: pd.DataFrame, query: str) -> Dict:
        """Analyze spending based on query"""
        if transactions.empty:
            return {"error": "No transaction data available"}
        
        # Extract time period from query using NLP
        period = self._extract_time_period(query)
        
        # Filter transactions by period
        filtered = self._filter_by_period(transactions, period)
        
        # Calculate metrics
        total = filtered['amount'].sum() if not filtered.empty else 0
        by_category = filtered.groupby('category')['amount'].sum().to_dict() if not filtered.empty else {}
        
        # Top categories
        top_categories = sorted(by_category.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Daily average
        if not filtered.empty:
            days = (filtered['date'].max() - filtered['date'].min()).days + 1
            daily_avg = total / max(days, 1)
        else:
            daily_avg = 0
        
        return {
            "total": total,
            "by_category": by_category,
            "top_categories": top_categories,
            "daily_average": daily_avg,
            "transaction_count": len(filtered),
            "period": period
        }
    
    async def forecast_spending(self, transactions: pd.DataFrame, days: int = 30) -> Dict:
        """
        Forecast future spending using Prophet [citation:2][citation:3]
        """
        if len(transactions) < 30:
            return {"error": "Insufficient data for forecasting"}
        
        try:
            # Prepare data for Prophet
            df = transactions.copy()
            df = df[['date', 'amount']].rename(columns={'date': 'ds', 'amount': 'y'})
            df = df.groupby('ds')['y'].sum().reset_index()
            
            # Fit Prophet model
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05
            )
            model.fit(df)
            
            # Make future dataframe
            future = model.make_future_dataframe(periods=days)
            forecast = model.predict(future)
            
            # Extract forecast for the future period
            future_forecast = forecast.tail(days)
            
            return {
                "forecast": future_forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records'),
                "confidence_interval": [future_forecast['yhat_lower'].mean(), future_forecast['yhat_upper'].mean()],
                "expected_total": future_forecast['yhat'].sum(),
                "lower_bound": future_forecast['yhat_lower'].sum(),
                "upper_bound": future_forecast['yhat_upper'].sum()
            }
        except Exception as e:
            logger.error(f"Forecasting error: {e}")
            return {"error": "Could not generate forecast"}
    
    def _extract_time_period(self, query: str) -> Dict:
        """Extract time period from natural language query"""
        # Simple rule-based extraction (can be enhanced with NER)
        query_lower = query.lower()
        
        now = datetime.now()
        
        if "last week" in query_lower or "past week" in query_lower:
            start = now - timedelta(days=7)
            return {"start": start, "end": now, "label": "last week"}
        elif "last month" in query_lower or "past month" in query_lower:
            start = now - timedelta(days=30)
            return {"start": start, "end": now, "label": "last month"}
        elif "last year" in query_lower or "past year" in query_lower:
            start = now - timedelta(days=365)
            return {"start": start, "end": now, "label": "last year"}
        elif "this month" in query_lower:
            start = now.replace(day=1)
            return {"start": start, "end": now, "label": "this month"}
        else:
            # Default to last 30 days
            start = now - timedelta(days=30)
            return {"start": start, "end": now, "label": "last 30 days"}
    
    def _filter_by_period(self, transactions: pd.DataFrame, period: Dict) -> pd.DataFrame:
        """Filter transactions by period"""
        if transactions.empty:
            return transactions
        return transactions[
            (transactions['date'] >= period['start']) &
            (transactions['date'] <= period['end'])
        ]
    
    async def compare_periods(self, transactions: pd.DataFrame, query: str) -> Dict:
        """Compare spending between two periods"""
        # Extract periods from query
        # This is a simplified version – can be enhanced
        now = datetime.now()
        
        # Current period (last 30 days)
        current_start = now - timedelta(days=30)
        current = self._filter_by_period(transactions, {"start": current_start, "end": now})
        current_total = current['amount'].sum() if not current.empty else 0
        
        # Previous period (30 days before that)
        previous_start = now - timedelta(days=60)
        previous_end = now - timedelta(days=30)
        previous = self._filter_by_period(
            transactions, 
            {"start": previous_start, "end": previous_end}
        )
        previous_total = previous['amount'].sum() if not previous.empty else 0
        
        change = current_total - previous_total
        percent_change = (change / previous_total * 100) if previous_total > 0 else 0
        
        return {
            "current_period_total": current_total,
            "previous_period_total": previous_total,
            "change": change,
            "percent_change": percent_change,
            "trend": "up" if change > 0 else "down" if change < 0 else "stable"
        }
    
    async def general_analysis(self, context: Dict, query: str) -> Dict:
        """General analysis for non-specific queries"""
        transactions = context['transactions']
        
        if transactions.empty:
            return {"message": "No transaction data available"}
        
        return {
            "total_spent": transactions['amount'].sum(),
            "average_transaction": transactions['amount'].mean(),
            "median_transaction": transactions['amount'].median(),
            "largest_transaction": transactions['amount'].max(),
            "smallest_transaction": transactions['amount'].min(),
            "category_count": transactions['category'].nunique(),
            "most_active_day": transactions['date'].dt.day_name().mode().iloc[0] if not transactions.empty else None
        }


class EmotionalSpendingAgent:
    """
    Agent to detect emotional spending patterns
    Based on behavioral finance research [citation:3]
    """
    
    async def analyze(self, transactions: pd.DataFrame) -> Dict:
        """Analyze transactions for emotional spending patterns"""
        if transactions.empty or len(transactions) < 10:
            return {"message": "Insufficient data for emotional analysis"}
        
        insights = []
        
        # Weekend spending patterns
        weekend_spending = transactions[transactions['date'].dt.dayofweek >= 5]['amount'].sum()
        weekday_spending = transactions[transactions['date'].dt.dayofweek < 5]['amount'].sum()
        
        weekend_ratio = weekend_spending / (weekday_spending + 0.01)
        if weekend_ratio > 1.5:
            insights.append({
                "type": "weekend_spending",
                "message": "You spend significantly more on weekends. Consider planning weekend activities.",
                "severity": "medium"
            })
        
        # Post-payday spikes (potential treat-yourself spending)
        # Assuming payday is around 1st and 15th (simplified)
        transactions['day_of_month'] = transactions['date'].dt.day
        post_payday = transactions[transactions['day_of_month'] <= 3]['amount'].sum()
        other_days = transactions[transactions['day_of_month'] > 3]['amount'].mean()
        
        if post_payday > other_days * 2:
            insights.append({
                "type": "post_payday_spike",
                "message": "You tend to spend more right after payday. Consider automating savings immediately after payday.",
                "severity": "medium"
            })
        
        # Late-night spending (potential impulse purchases)
        transactions['hour'] = transactions['date'].dt.hour
        late_night = transactions[transactions['hour'] < 6]['amount'].mean()
        daytime = transactions[transactions['hour'] >= 6]['amount'].mean()
        
        if late_night > daytime * 1.3:
            insights.append({
                "type": "late_night_spending",
                "message": "Your late-night purchases are higher than daytime ones. Consider a 'cooling off' period for night purchases.",
                "severity": "high"
            })
        
        # Spending volatility (potential emotional indicator)
        from sklearn.ensemble import IsolationForest
        try:
            # Detect anomalous transactions (potential emotional spending)
            X = transactions[['amount']].values
            iso_forest = IsolationForest(contamination=0.1, random_state=42)
            anomalies = iso_forest.fit_predict(X)
            anomalous_transactions = transactions[anomalies == -1]
            
            if len(anomalous_transactions) > 0:
                insights.append({
                    "type": "anomalous_spending",
                    "message": f"Found {len(anomalous_transactions)} unusual transactions that might be emotional purchases.",
                    "transactions": anomalous_transactions[['date', 'amount', 'description', 'category']].to_dict('records'),
                    "severity": "medium"
                })
        except:
            pass
        
        return {
            "insights": insights,
            "emotional_spending_score": self._calculate_emotional_score(insights)
        }
    
    def _calculate_emotional_score(self, insights: List) -> int:
        """Calculate emotional spending score (0-100, lower is better)"""
        severity_weights = {"low": 5, "medium": 10, "high": 20}
        total_impact = sum(severity_weights.get(i.get('severity', 'low'), 5) for i in insights)
        return max(0, 100 - min(total_impact, 100))


class FinancialAdviceAgent:
    """Agent for generating personalized financial advice"""
    
    def __init__(self, llm):
        self.llm = llm
        
    async def generate_advice(self, analysis: Dict, emotional_insights: Dict, query: str) -> Dict:
        """Generate personalized advice based on analysis"""
        
        # Prepare context for LLM
        context = f"""
        Financial Analysis:
        - Total spending: ₹{analysis.get('total', 0):.2f}
        - Top categories: {analysis.get('top_categories', [])}
        - Daily average: ₹{analysis.get('daily_average', 0):.2f}
        
        Emotional Insights:
        {emotional_insights.get('insights', [])}
        
        User Query: {query}
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a friendly and knowledgeable financial advisor for FinBuddy. 
            Your role is to provide personalized, actionable advice based on the user's financial data.
            Focus on practical suggestions that help users improve their financial health.
            Be encouraging and non-judgmental in your tone."""),
            ("user", "{context}")
        ])
        
        try:
            response = await self.llm.ainvoke(prompt.format_messages(context=context))
            advice_text = response.content
            
            # Extract key recommendations
            recommendations = self._extract_recommendations(advice_text)
            
            return {
                "advice": advice_text,
                "recommendations": recommendations,
                "sentiment": "positive" if analysis.get('savings_rate', 0) > 0.2 else "neutral"
            }
        except Exception as e:
            logger.error(f"Error generating advice: {e}")
            return {
                "advice": "I'm having trouble generating personalized advice right now.",
                "recommendations": [],
                "sentiment": "neutral"
            }
    
    def _extract_recommendations(self, advice_text: str) -> List[str]:
        """Extract actionable recommendations from advice text"""
        # Simple extraction based on bullet points or numbered lists
        import re
        bullets = re.findall(r'[•\-*]\s*(.*?)(?=[•\-*\n]|$)', advice_text)
        if bullets:
            return bullets[:3]  # Return top 3 recommendations
        
        # If no bullets, split by sentences and take key sentences
        sentences = re.split(r'[.!?]+', advice_text)
        recommendations = [s.strip() for s in sentences if len(s.strip()) > 20][:3]
        return recommendations