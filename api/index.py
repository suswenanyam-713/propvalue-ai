import os
import sys

# Ensure project root directory is in sys.path for Vercel Serverless Function
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from backend.main import app
except Exception as e:
    import traceback
    print(f"[Vercel Startup Error]: {e}")
    traceback.print_exc()

    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/{full_path:path}")
    @app.post("/{full_path:path}")
    def error_fallback(full_path: str):
        return {
            "error": "Serverless Startup Exception",
            "detail": str(e),
            "traceback": traceback.format_exc()
        }
