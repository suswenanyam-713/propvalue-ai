import os
import shutil
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    db_filename = "real_estate.db"
    orig_db = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), db_filename)
    tmp_db = os.path.join("/tmp", db_filename)

    if os.path.exists("/tmp") and os.path.exists(orig_db) and not os.path.exists(tmp_db):
        try:
            shutil.copy2(orig_db, tmp_db)
            DATABASE_URL = f"sqlite:///{tmp_db}"
        except Exception as e:
            print(f"Could not copy SQLite DB to /tmp: {e}")
            DATABASE_URL = f"sqlite:///{orig_db}"
    elif os.path.exists(tmp_db):
        DATABASE_URL = f"sqlite:///{tmp_db}"
    else:
        DATABASE_URL = f"sqlite:///{orig_db}"

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
