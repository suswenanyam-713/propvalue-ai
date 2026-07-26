from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "api", "static")

# Catch-all SPA route handler for direct navigation & browser refreshes (/valuation, /properties, etc.)
@app.get("/{full_path:path}")
def catch_all_spa_routing(full_path: str):
    # Pass unmatched /api/* requests to standard 404 JSON response
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # 1. Check if requesting specific static asset file (e.g. assets/index-Ct3xKNzX.js)
    if os.path.exists(STATIC_DIR):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

    # 2. Check frontend/dist fallback
    dist_index = os.path.join(BASE_DIR, "frontend", "dist", "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)

    raise HTTPException(status_code=404, detail="Page not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
