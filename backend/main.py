from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import SessionLocal, engine
from categorizer import suggest_category

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# -------------------- CORS CONFIGURATION --------------------
# Allow requests from:
# - local development frontend (http://localhost:3000)
# - your production frontend (replace with your actual Vercel URL)
# You can add more origins if needed.
origins = [
    "http://localhost:3000",
    "https://your-frontend.vercel.app",   # <-- REPLACE THIS with your real frontend URL after deployment
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ------------------------------------------------------------

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "FinMind API is running"}

# -------------------- Category endpoints --------------------
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

# -------------------- Transaction endpoints --------------------
@app.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    db_transaction = models.Transaction(**transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/transactions/", response_model=List[schemas.Transaction])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()
    return transactions

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: int, transaction_update: schemas.TransactionCreate, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    for key, value in transaction_update.dict().items():
        setattr(transaction, key, value)
    
    db.commit()
    db.refresh(transaction)
    return transaction

# -------------------- Category suggestion endpoint --------------------
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

# -------------------- Loan endpoints --------------------
@app.post("/loans/", response_model=schemas.Loan)
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    db_loan = models.Loan(**loan.dict())
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.get("/loans/", response_model=List[schemas.Loan])
def read_loans(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    loans = db.query(models.Loan).order_by(models.Loan.start_date.desc()).offset(skip).limit(limit).all()
    return loans

@app.put("/loans/{loan_id}", response_model=schemas.Loan)
def update_loan(loan_id: int, loan_update: schemas.LoanCreate, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    for key, value in loan_update.dict().items():
        setattr(loan, key, value)
    
    db.commit()
    db.refresh(loan)
    return loan

@app.delete("/loans/{loan_id}")
def delete_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
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