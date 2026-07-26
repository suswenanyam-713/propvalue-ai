import os
import shutil
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    db_filename = "real_estate.db"
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    orig_db = os.path.join(BASE_DIR, db_filename)
    tmp_dir = "/tmp"
    tmp_db = os.path.join(tmp_dir, db_filename)

    if os.path.exists(tmp_dir):
        if os.path.exists(orig_db) and not os.path.exists(tmp_db):
            try:
                shutil.copy2(orig_db, tmp_db)
            except Exception as e:
                print(f"Could not copy SQLite DB to /tmp: {e}")
        
        if os.path.exists(tmp_db):
            DATABASE_URL = f"sqlite:///{tmp_db}"
        elif os.path.exists(orig_db):
            DATABASE_URL = f"sqlite:///{orig_db}"
        else:
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
