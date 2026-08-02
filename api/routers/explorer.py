"""
api/routers/explorer.py
POST /api/explore  — Mode 2: Role Skill Explorer
"""

import threading

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter()

# In-memory per-role cache: role|top_k -> result dict.
# First query per role hits the LLM; repeats are instant (no re-generation).
_EXPLORE_CACHE: dict[str, dict] = {}
_EXPLORE_LOCK = threading.Lock()
_MAX_CACHE = 256


class ExploreRequest(BaseModel):
    role: str = Field(..., min_length=1, description="Job role to explore, e.g. 'Data Analyst'")
    top_k: int = Field(5, ge=1, le=20, description="Number of JD chunks to retrieve")


class ExploreResponse(BaseModel):
    role: str
    found_data: bool = True
    required_skills: list[str] = []
    nice_to_have_skills: list[str] = []
    summary: str = ""
    error: str | None = None


def _cache_get(key: str) -> dict | None:
    with _EXPLORE_LOCK:
        return _EXPLORE_CACHE.get(key)


def _cache_put(key: str, result: dict) -> None:
    with _EXPLORE_LOCK:
        if len(_EXPLORE_CACHE) >= _MAX_CACHE:
            # Drop oldest entry (dicts preserve insertion order)
            _EXPLORE_CACHE.pop(next(iter(_EXPLORE_CACHE)))
        _EXPLORE_CACHE[key] = result


@router.post("/explore", response_model=ExploreResponse)
async def explore_role(body: ExploreRequest, request: Request) -> ExploreResponse:
    """
    Given a role name, retrieve relevant JDs from the vector store
    and return a synthesised skill profile.

    Results are cached per (role, top_k) so repeated queries skip the LLM.
    """
    cache_key = f"{body.role.strip().lower()}|{body.top_k}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return ExploreResponse(**cached)

    from api.state import get_retriever
    retriever = get_retriever()

    try:
        from main import explore_role_skills
        result = explore_role_skills(
            role=body.role,
            retriever=retriever,
            top_k=body.top_k,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    _cache_put(cache_key, result)
    return ExploreResponse(**result)
