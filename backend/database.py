import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Use DATABASE_URL from environment, fallback to SQLite for local dev
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finmind.db")

# Render gives postgres:// or postgresql:// URLs; name the psycopg2 driver
# explicitly, since newer SQLAlchemy versions default to psycopg (v3) instead.
for prefix in ("postgres://", "postgresql://"):
    if SQLALCHEMY_DATABASE_URL.startswith(prefix):
        SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://" + SQLALCHEMY_DATABASE_URL[len(prefix):]
        break

# Create engine with increased pool size to handle concurrent requests
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,          # Increased from default 5
    max_overflow=20,       # Increased from default 10
    pool_timeout=30,       # Seconds to wait for a connection
    pool_pre_ping=True     # Optional: checks connection validity before using
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()