"""
api/routers/trends.py
POST /api/trends              — serve from persistent cache (instant).
POST /api/trends/rebuild-cache — trigger a background cache rebuild.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from src import trends_cache

router = APIRouter()


class TrendsRequest(BaseModel):
    role: str = Field("Data Engineer", description="Job role to analyze trends for")
    time_range: str = Field("Last 12 Months", description="Time window for analytics")


class TrendsResponse(BaseModel):
    role: str
    time_range: str
    months: list[str]
    demandOverTime: list[dict[str, Any]]
    topSkills: list[dict[str, Any]]
    skillDemand: dict[str, float] = {}
    salaryDistribution: list[dict[str, Any]]
    postingVolume: list[dict[str, Any]]
    experienceDistribution: list[dict[str, Any]] = []
    marketStats: dict[str, Any] = {}



class RebuildRequest(BaseModel):
    roles: list[str] | None = Field(
        None,
        description="Specific roles to rebuild. Omit to rebuild all roles.",
    )


@router.post("/trends", response_model=TrendsResponse)
async def get_trends(body: TrendsRequest) -> TrendsResponse:
    """
    Return market trends for the requested role.

    Serves from the persistent in-memory cache (loaded from disk at startup).
    Falls back to on-demand computation if the role isn't cached yet
    (only happens during the initial background build on first-ever startup).
    """
    cached = trends_cache.get(body.role)
    if cached:
        return TrendsResponse(**cached)

    # Cache miss — compute on the fly (rare: only during first-time build)
    try:
        from src.analytics import analyze_trends_for_role
        result = analyze_trends_for_role(role=body.role, time_range=body.time_range)
        return TrendsResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/trends/rebuild-cache")
async def rebuild_cache(body: RebuildRequest, background_tasks: BackgroundTasks) -> dict:
    """
    Trigger a background rebuild of the trends cache.

    Call this after a database rebuild. The server stays fully responsive
    during the rebuild; the new data becomes available role-by-role as each
    finishes computing.
    """
    status = trends_cache.rebuild(body.roles)
    return {
        **status,
        "message": (
            "Cache rebuild started in the background. "
            "New data will be available role-by-role as each finishes."
        ),
    }


@router.get("/trends/cache-status")
async def cache_status() -> dict:
    """Return the current state of the trends cache."""
    return {
        "cached_roles": trends_cache.cached_roles(),
        "total_cached": len(trends_cache.cached_roles()),
        "is_building": trends_cache.is_building(),
        "all_roles": trends_cache.ALL_ROLE_NAMES,
        "missing_roles": [
            r for r in trends_cache.ALL_ROLE_NAMES
            if r not in trends_cache.cached_roles()
        ],
    }
