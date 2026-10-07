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
from sqlalchemy import text
from ai import router as ai_router

models.Base.metadata.create_all(bind=engine)

# -------------------- SCHEMA MIGRATIONS --------------------
# create_all() never adds columns to tables that already exist, so the
# production Postgres DB gets the newer columns here (idempotent).
if engine.dialect.name == "postgresql":
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS active_income FLOAT DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS passive_income FLOAT DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);"))
        conn.execute(text("ALTER TABLE loans ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);"))
        conn.execute(text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);"))
# ------------------------------------------------------------

app = FastAPI()

# -------------------- CORS CONFIGURATION --------------------
origins = [
    "http://localhost:3000",
    "https://finbuddy-fawn.vercel.app",   # your frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ------------------------------------------------------------

app.include_router(ai_router)

@app.get("/")
def root():
    return {"message": "FinMind API is running"}

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
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Password hashing (truncation handled inside auth.get_password_hash)
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
    # Authentication (truncation handled inside auth.authenticate_user)
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
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_category = models.Category(
        name=category.name,
        description=category.description,
        user_id=current_user.id
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/categories/", response_model=List[schemas.Category])
def read_categories(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    categories = db.query(models.Category)\
        .filter(
            (models.Category.user_id == current_user.id) |
            (models.Category.user_id == None)
        )\
        .offset(skip).limit(limit).all()
    return categories

# -------------------- Transaction Endpoints --------------------
@app.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_transaction = models.Transaction(**transaction.dict(exclude_none=True), user_id=current_user.id)
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
        if key == "date" and value is None:
            continue  # keep the existing date rather than nulling it
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    return transaction

# -------------------- Category suggestion --------------------
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

# -------------------- Loan Endpoints --------------------
@app.post("/loans/", response_model=schemas.Loan)
def create_loan(
    loan: schemas.LoanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_loan = models.Loan(**loan.dict(exclude_none=True), user_id=current_user.id)
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
        if key == "start_date" and value is None:
            continue  # keep the existing start date rather than nulling it
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

# -------------------- Startup event --------------------
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    default_cats = [
        "Food & Drink", "Transport", "Shopping", "Entertainment",
        "Bills & Utilities", "Healthcare", "Education", "Income",
        "Transfer", "Other"
    ]
    for cat_name in default_cats:
        exists = db.query(models.Category).filter(
            models.Category.name == cat_name,
            models.Category.user_id == None
        ).first()
        if not exists:
            db.add(models.Category(name=cat_name, user_id=None))
    db.commit()
    db.close()