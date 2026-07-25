from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

from backend.api import routes_auth, routes_val, routes_prop, routes_chat, routes_admin

app = FastAPI(
    title="AI-Powered Property Valuation & Investment Intelligence API",
    description="Backend service running ML price predictions, price forecasting, similarity recommendations, and RAG chatbot",
    version="1.0.0"
)

# Enable CORS for frontend clients
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
