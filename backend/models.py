from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    is_active = Column(Integer, default=1)
    active_income = Column(Float, default=0.0)
    passive_income = Column(Float, default=0.0)

    transactions = relationship("Transaction", back_populates="owner")
    loans = relationship("Loan", back_populates="owner")
    categories = relationship("Category", back_populates="owner")  # added

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)  # unique constraint removed (can be per‑user)
    description = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL for global categories
    
    transactions = relationship("Transaction", back_populates="category")
    owner = relationship("User", back_populates="categories")  # added

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)
    description = Column(String, index=True)
    date = Column(DateTime, default=datetime.utcnow)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    category = relationship("Category", back_populates="transactions")
    owner = relationship("User", back_populates="transactions")

class Loan(Base):
    __tablename__ = "loans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    amount = Column(Float)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="loans")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    amount = Column(Float)  # monthly limit

    category = relationship("Category")

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String)
    target = Column(Float)
    saved = Column(Float, default=0.0)
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Holding(Base):
    """An investment the user tracks: a stock, ETF, mutual fund or coin (no lots = watchlist)."""
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    asset_type = Column(String)  # stock | etf | mf | crypto
    symbol = Column(String)      # RELIANCE.NS / AMFI scheme code / CoinGecko id
    name = Column(String)
    exchange = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lots = relationship("Lot", back_populates="holding", cascade="all, delete-orphan")
    sips = relationship("Sip", back_populates="holding", cascade="all, delete-orphan")

class Sip(Base):
    """A monthly auto-investment; its installments are materialised as lots at that day's price."""
    __tablename__ = "sips"

    id = Column(Integer, primary_key=True, index=True)
    holding_id = Column(Integer, ForeignKey("holdings.id"), index=True)
    amount = Column(Float)
    day = Column(Integer)  # day of month, 1-28
    start_date = Column(DateTime)
    active = Column(Integer, default=1)

    holding = relationship("Holding", back_populates="sips")

class Lot(Base):
    """One buy or sell. Prices are INR per unit."""
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    holding_id = Column(Integer, ForeignKey("holdings.id"), index=True)
    side = Column(String, default="buy")  # buy | sell
    units = Column(Float)
    price = Column(Float)
    date = Column(DateTime)
    sip_id = Column(Integer, ForeignKey("sips.id"), nullable=True)

    holding = relationship("Holding", back_populates="lots")
