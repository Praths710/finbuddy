from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
import models
import schemas
import auth
from database import get_db, SessionLocal, engine
from categorizer import suggest_category
from sqlalchemy import text  # Required for raw SQL in /fix-db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# -------------------- CORS CONFIGURATION --------------------
origins = [
    "http://localhost:3000",
    "https://finbuddy-fawn.vercel.app",   # <-- your frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "FinMind API is running"}

# -------------------- TEMPORARY USER MANAGEMENT ENDPOINTS --------------------
# Use these to list and delete users. REMOVE after debugging.

@app.get("/list-users")
def list_users(db: Session = Depends(get_db)):
    """List all registered users (id, email)."""
    users = db.query(models.User).all()
    return [{"id": u.id, "email": u.email} for u in users]

@app.delete("/delete-user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user by ID. Use with caution – deletes all their data!"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": f"User {user_id} deleted"}
# ------------------------------------------------------------------------------

# -------------------- FIX DATABASE ENDPOINT (Run once, then remove) --------------------
@app.get("/fix-db")
def fix_database(db: Session = Depends(get_db)):
    try:
        # Add income columns to users table if missing
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS active_income FLOAT DEFAULT 0.0;"))
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS passive_income FLOAT DEFAULT 0.0;"))
        # Ensure user_id columns exist in transactions and loans
        db.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);"))
        db.execute(text("ALTER TABLE loans ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);"))
        db.commit()
        return {"message": "Database schema updated successfully. Added income columns and user_id columns."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
# ---------------------------------------------------------------------------------------

# -------------------- User Income Endpoints --------------------
@app.get("/user/income", response_model=schemas.User)
def get_user_income(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

@app.put("/user/income", response_model=schemas.User)
def update_income(
    active: float = 0.0,
    passive: float = 0.0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    current_user.active_income = active
    current_user.passive_income = passive
    db.commit()
    db.refresh(current_user)
    return current_user

# -------------------- Authentication Endpoints --------------------
@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if email already exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Password length check (bcrypt limit: 72 bytes)
    if len(user.password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 bytes)")
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        active_income=user.active_income,
        passive_income=user.passive_income
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    if len(form_data.password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 bytes)")
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(auth.get_current_active_user)):
    return current_user

# -------------------- Category Endpoints --------------------
@app.post("/categories/", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    db_category = models.Category(name=category.name, description=category.description)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/categories/", response_model=List[schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    categories = db.query(models.Category).offset(skip).limit(limit).all()
    return categories

# -------------------- Transaction Endpoints (protected) --------------------
@app.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_transaction = models.Transaction(**transaction.dict(), user_id=current_user.id)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/transactions/", response_model=List[schemas.Transaction])
def read_transactions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    transactions = db.query(models.Transaction)\
        .filter(models.Transaction.user_id == current_user.id)\
        .order_by(models.Transaction.date.desc())\
        .offset(skip).limit(limit).all()
    return transactions

@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    transaction = db.query(models.Transaction)\
        .filter(models.Transaction.id == transaction_id, models.Transaction.user_id == current_user.id)\
        .first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(
    transaction_id: int,
    transaction_update: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    transaction = db.query(models.Transaction)\
        .filter(models.Transaction.id == transaction_id, models.Transaction.user_id == current_user.id)\
        .first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in transaction_update.dict().items():
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    return transaction

# -------------------- Category suggestion endpoint (public) --------------------
@app.get("/suggest-category/")
def suggest_category_endpoint(description: str):
    cat_name = suggest_category(description)
    if cat_name:
        db = SessionLocal()
        cat = db.query(models.Category).filter(models.Category.name == cat_name).first()
        db.close()
        if cat:
            return {"suggested_category_id": cat.id, "suggested_category_name": cat.name}
    return {"suggested_category_id": None, "suggested_category_name": None}

# -------------------- Loan Endpoints (protected) --------------------
@app.post("/loans/", response_model=schemas.Loan)
def create_loan(
    loan: schemas.LoanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_loan = models.Loan(**loan.dict(), user_id=current_user.id)
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.get("/loans/", response_model=List[schemas.Loan])
def read_loans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    loans = db.query(models.Loan)\
        .filter(models.Loan.user_id == current_user.id)\
        .order_by(models.Loan.start_date.desc())\
        .offset(skip).limit(limit).all()
    return loans

@app.put("/loans/{loan_id}", response_model=schemas.Loan)
def update_loan(
    loan_id: int,
    loan_update: schemas.LoanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    loan = db.query(models.Loan)\
        .filter(models.Loan.id == loan_id, models.Loan.user_id == current_user.id)\
        .first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for key, value in loan_update.dict().items():
        setattr(loan, key, value)
    db.commit()
    db.refresh(loan)
    return loan

@app.delete("/loans/{loan_id}")
def delete_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    loan = db.query(models.Loan)\
        .filter(models.Loan.id == loan_id, models.Loan.user_id == current_user.id)\
        .first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    db.delete(loan)
    db.commit()
    return {"message": "Loan deleted successfully"}

# -------------------- Startup event to create default categories --------------------
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    default_cats = [
        "Food & Drink", "Transport", "Shopping", "Entertainment",
        "Bills & Utilities", "Healthcare", "Education", "Income",
        "Transfer", "Other"
    ]
    for cat_name in default_cats:
        exists = db.query(models.Category).filter(models.Category.name == cat_name).first()
        if not exists:
            db.add(models.Category(name=cat_name))
    db.commit()
    db.close()