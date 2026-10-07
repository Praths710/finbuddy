from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# -------------------- User schemas --------------------
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    active_income: float = 0.0
    passive_income: float = 0.0

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: int

    class Config:
        from_attributes = True

# -------------------- Token schemas --------------------
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# -------------------- Category schemas --------------------
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass  # user_id comes from current user

class Category(CategoryBase):
    id: int
    user_id: Optional[int] = None  # null for global categories
    
    class Config:
        from_attributes = True

# -------------------- Transaction schemas --------------------
class TransactionBase(BaseModel):
    amount: float
    description: str
    date: Optional[datetime] = None
    category_id: Optional[int] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    date: datetime
    category: Optional[Category] = None
    user_id: int
    
    class Config:
        from_attributes = True

# -------------------- Loan schemas --------------------
class LoanBase(BaseModel):
    name: str
    amount: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    description: Optional[str] = None

class LoanCreate(LoanBase):
    pass

class Loan(LoanBase):
    id: int
    start_date: datetime
    user_id: int
    
    class Config:
        from_attributes = True
# -------------------- Budget schemas --------------------
class BudgetCreate(BaseModel):
    category_id: int
    amount: float = Field(gt=0)

class Budget(BudgetCreate):
    id: int
    category: Optional[Category] = None

    class Config:
        from_attributes = True

# -------------------- Goal schemas --------------------
class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target: float = Field(gt=0)
    saved: float = Field(default=0.0, ge=0)
    deadline: Optional[datetime] = None

class GoalContribution(BaseModel):
    amount: float  # negative to withdraw

class Goal(GoalCreate):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
