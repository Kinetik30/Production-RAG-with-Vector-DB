"""
api/main.py — FastAPI application entry-point.

Run with:
    uv run uvicorn api.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import matcher, explorer, trends


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load the trends cache from disk (or kick off background build)."""
    from src import trends_cache
    trends_cache.init()
    print("[API] Server ready.")
    yield
    print("[API] Shutting down.")


app = FastAPI(
    title="RAG Pipeline API",
    description="Resume × JD Matcher, Role Skill Explorer, and Trends Analytics",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow requests from the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers under /api prefix
app.include_router(matcher.router, prefix="/api", tags=["Matcher"])
app.include_router(explorer.router, prefix="/api", tags=["Explorer"])
app.include_router(trends.router, prefix="/api", tags=["Trends"])


@app.get("/api/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok"}
