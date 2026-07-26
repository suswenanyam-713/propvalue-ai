from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

load_dotenv()

from backend.api import routes_auth, routes_val, routes_prop, routes_chat, routes_admin
from backend.database.session import Base, engine, SessionLocal
from backend.database.seed import seed_db
from backend.database.models import Property

app = FastAPI(
    title="AI-Powered Property Valuation & Investment Intelligence API",
    description="Backend service running ML price predictions, price forecasting, similarity recommendations, and RAG chatbot",
    version="1.0.0"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            if db.query(Property).count() == 0:
                print("Database empty on startup. Auto-seeding 10,000 properties...")
                seed_db(db)
        finally:
            db.close()
    except Exception as e:
        print(f"Startup DB init check: {e}")

# Register all API routes FIRST
app.include_router(routes_auth.router)
app.include_router(routes_val.router)
app.include_router(routes_prop.router)
app.include_router(routes_chat.router)
app.include_router(routes_admin.router)

@app.get("/api")
def read_root():
    return {
        "status": "online",
        "service": "AI Property Valuation API",
        "docs_url": "/docs"
    }

# Mount React SPA build as static files LAST (catch-all fallback)
# On Vercel: the build copies frontend/dist/* to api/static/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "api", "static")

if os.path.exists(STATIC_DIR):
    # html=True enables SPA mode: serves index.html for unmatched routes
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
