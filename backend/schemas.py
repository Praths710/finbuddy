from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Category schemas
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    
    class Config:
        orm_mode = True

# Transaction schemas
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
    
    class Config:
        orm_mode = True

# Loan schemas
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
    
    class Config:
        orm_mode = True
