from fuzzywuzzy import fuzz, process

KEYWORD_MAP = {
    "starbucks": "Food & Drink",
    "mcdonald": "Food & Drink",
    "kfc": "Food & Drink",
    "pizza hut": "Food & Drink",
    "uber": "Transport",
    "lyft": "Transport",
    "taxi": "Transport",
    "amazon": "Shopping",
    "walmart": "Shopping",
    "target": "Shopping",
    "netflix": "Entertainment",
    "spotify": "Entertainment",
    "electricity": "Bills & Utilities",
    "water": "Bills & Utilities",
    "internet": "Bills & Utilities",
    "phone": "Bills & Utilities",
    "doctor": "Healthcare",
    "pharmacy": "Healthcare",
    "school": "Education",
    "salary": "Income",
    "deposit": "Income",
    "interest": "Income"
}

def suggest_category(description: str, threshold: int = 80):
    description_lower = description.lower()
    for keyword, category in KEYWORD_MAP.items():
        if keyword in description_lower:
            return category
    
    keywords = list(KEYWORD_MAP.keys())
    best_match, score = process.extractOne(description_lower, keywords, scorer=fuzz.partial_ratio)
    if score >= threshold:
        return KEYWORD_MAP[best_match]
    return None
