"""
api/routers/explorer.py
POST /api/explore  — Mode 2: Role Skill Explorer
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter()


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


@router.post("/explore", response_model=ExploreResponse)
async def explore_role(body: ExploreRequest, request: Request) -> ExploreResponse:
    """
    Given a role name, retrieve relevant JDs from the vector store
    and return a synthesised skill profile.
    """
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

    return ExploreResponse(**result)
