import os
import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict, Any, List

from openai import AsyncOpenAI, APIStatusError

logger = logging.getLogger(__name__)

# Groq's free API speaks the OpenAI protocol, so the openai library works with
# it. To use OpenAI instead, set AI_BASE_URL=https://api.openai.com/v1 and
# AI_MODEL=gpt-4o-mini.
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1")

# Tried in order: a model that gets retired or rate-limited falls through to the next.
AI_MODELS = [m for m in [
    os.getenv("AI_MODEL"),
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
] if m]

SYSTEM_PROMPT = """You are FinBuddy, a warm, sharp personal finance assistant for an Indian user.
Amounts are in Indian Rupees (₹). Answer using ONLY the user's data below; if the data
doesn't cover the question, say so briefly and suggest what to track.
Style: concise (under 150 words unless asked for detail), specific numbers, short
bullet points where helpful, **bold** for key figures. No disclaimers or boilerplate.
You give general budgeting guidance, not licensed investment advice."""


def is_income(category: str) -> bool:
    return "income" in (category or "").lower()


def summarize(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crunch the raw records into the numbers both the prompt and the UI use."""
    txs = user_data.get("transactions", [])
    income = user_data.get("income", {})
    monthly_income = (income.get("active") or 0) + (income.get("passive") or 0)
    monthly_emi = sum(l.get("amount") or 0 for l in user_data.get("loans", []))

    months: Dict[str, Dict[str, float]] = defaultdict(lambda: {"spent": 0.0, "income": 0.0})
    by_category: Dict[str, float] = defaultdict(float)
    this_month = datetime.utcnow().strftime("%Y-%m")
    for t in txs:
        month = t["date"][:7]
        if is_income(t["category"]):
            months[month]["income"] += t["amount"]
        else:
            months[month]["spent"] += t["amount"]
            if month == this_month:
                by_category[t["category"]] += t["amount"]

    current = months[this_month]
    spent = current["spent"] + monthly_emi
    total_in = monthly_income + current["income"]
    savings_rate = (total_in - spent) / total_in if total_in > 0 else 0.0

    score = 50
    if total_in > 0:
        score = 100
        if savings_rate < 0.2:
            score -= 15
        if savings_rate < 0.1:
            score -= 15
        if savings_rate < 0:
            score -= 20
        if monthly_emi / total_in > 0.4:
            score -= 20
    score = max(0, min(100, score))
    rating = ("Excellent" if score >= 80 else "Good" if score >= 60
              else "Fair" if score >= 40 else "Needs attention")

    return {
        "month": this_month,
        "monthly_income": total_in,
        "spent_this_month": spent,
        "emi": monthly_emi,
        "savings_rate": savings_rate,
        "top_categories": sorted(by_category.items(), key=lambda x: x[1], reverse=True)[:5],
        "all_categories": list(by_category.items()),
        "history": {m: months[m] for m in sorted(months)[-6:]},
        "health_score": {"score": score, "rating": rating},
    }


def build_context(user_data: Dict[str, Any], s: Dict[str, Any]) -> str:
    recent: List[Dict[str, Any]] = sorted(
        user_data.get("transactions", []), key=lambda t: t["date"], reverse=True)[:25]
    lines = [
        f"Today: {datetime.utcnow():%d %b %Y}. Current month: {s['month']}.",
        f"Monthly salary/passive income: ₹{s['monthly_income']:.0f}",
        f"Spent this month (incl. EMIs ₹{s['emi']:.0f}): ₹{s['spent_this_month']:.0f}",
        f"Savings rate this month: {s['savings_rate'] * 100:.0f}%",
        f"Health score: {s['health_score']['score']}/100 ({s['health_score']['rating']})",
        "Top categories this month: " + (", ".join(f"{c} ₹{a:.0f}" for c, a in s["top_categories"]) or "none"),
        "Monthly history (spent / extra income): " + (", ".join(
            f"{m}: ₹{v['spent']:.0f} / ₹{v['income']:.0f}" for m, v in s["history"].items()) or "none"),
        "Loans/EMIs: " + (", ".join(
            f"{l['name']} ₹{l['amount']:.0f}/mo" for l in user_data.get("loans", [])) or "none"),
        "Monthly budgets (limit vs spent this month): " + (", ".join(
            f"{b['category']} ₹{b['limit']:.0f} vs ₹{dict(s['all_categories']).get(b['category'], 0):.0f}"
            for b in user_data.get("budgets", [])) or "none set"),
        "Savings goals: " + (", ".join(
            f"{g['name']} ₹{g['saved']:.0f}/₹{g['target']:.0f}" + (f" by {g['deadline']}" if g['deadline'] else "")
            for g in user_data.get("goals", [])) or "none"),
        "Recent transactions:",
        *[f"- {t['date'][:10]} {t['description']} ({t['category']}) ₹{t['amount']:.0f}" for t in recent],
    ]
    return "\n".join(lines)


class FinancialAIAgent:
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key, base_url=AI_BASE_URL)

    async def process_query(self, query: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        summary = summarize(user_data)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"My data:\n{build_context(user_data, summary)}\n\nMy question: {query}"},
        ]
        last_error = None
        for model in AI_MODELS:
            try:
                response = await self.client.chat.completions.create(
                    model=model, messages=messages, temperature=0.5, max_tokens=600)
                return {
                    "message": response.choices[0].message.content,
                    "health_score": summary["health_score"],
                }
            except APIStatusError as e:
                last_error = e
                logger.error(f"AI error with model {model}: {e.status_code} {e.message}")
                if e.status_code in (401, 403):
                    break  # bad key: no point trying other models
            except Exception as e:
                last_error = e
                logger.error(f"AI error with model {model}: {e}")

        if isinstance(last_error, APIStatusError) and last_error.status_code in (401, 403):
            message = "The AI key on the server is invalid. Check AI_API_KEY in your Render settings."
        else:
            message = "I can't answer right now — the AI provider didn't respond. Please try again in a moment."
        return {"error": str(last_error), "message": message}
