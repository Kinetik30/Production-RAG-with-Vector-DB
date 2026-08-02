"""
api/routers/matcher.py
POST /api/match  — Mode 1: Resume × JD Matcher

Returns one MatchResult per JD so the frontend can display
individual scores, matching skills, and missing skills for each
job description independently.
"""

import io
import json
import os
import tempfile

import pdfplumber

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from main import match_resume_to_jds

router = APIRouter()


class SingleMatchResult(BaseModel):
    jd_index: int
    jd_preview: str           # first ~120 chars of the raw JD text
    jd_source: str = "text"   # "text" | "pdf"
    jd_filename: str | None = None
    match_score: int | None = None
    matching_skills: list[str] = []
    missing_skills: list[str] = []
    summary: str = ""
    role_category: str = ""
    ats_coverage: dict | None = None
    prioritized_gaps: list[dict] = []
    salary_band: dict | None = None
    database_size: int | None = None
    error: str | None = None


class MatchResponse(BaseModel):
    results: list[SingleMatchResult]


def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()


@router.post("/match", response_model=MatchResponse)
async def match_resume(
    resume: UploadFile = File(..., description="Resume PDF file"),
    jd_texts: str = Form(..., description="JSON array of JD strings"),
    jd_files: list[UploadFile] = File(default=[], description="Optional JD PDF files"),
) -> MatchResponse:
    """
    Upload a resume PDF and one or more job descriptions.
    JDs can be pasted as text (jd_texts) and/or uploaded as PDFs (jd_files).
    Each JD is scored independently — returns one result per JD.
    """
    # Validate content type
    if resume.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    # Parse JD texts from JSON string
    try:
        jd_list: list[str] = json.loads(jd_texts)
        if not isinstance(jd_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="jd_texts must be a valid JSON array of strings.",
        )

    # Extract text from uploaded JD PDFs (appended after text JDs)
    jd_sources: list[tuple[str, str, str | None]] = []  # (text, source, filename)

    for jd_text in jd_list:
        jd_text = (jd_text or "").strip()
        if jd_text:
            jd_sources.append((jd_text, "text", None))

    for jd_file in jd_files:
        if jd_file.content_type not in ("application/pdf", "application/octet-stream"):
            raise HTTPException(status_code=400, detail=f"JD file '{jd_file.filename}' must be a PDF.")
        content = await jd_file.read()
        try:
            text = _extract_pdf_text(content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read JD PDF '{jd_file.filename}': {exc}")
        if not text:
            raise HTTPException(status_code=400, detail=f"JD PDF '{jd_file.filename}' contained no extractable text.")
        jd_sources.append((text, "pdf", jd_file.filename))

    if not jd_sources:
        raise HTTPException(status_code=400, detail="Provide at least one JD (text or PDF).")

    # Write the uploaded PDF to a temp file once; reuse across all JD calls
    resume_bytes = await resume.read()
    tmp_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(resume_bytes)
            tmp_path = tmp.name

        results: list[SingleMatchResult] = []

        for idx, (jd_text, source, filename) in enumerate(jd_sources):
            # Call the pipeline with a single JD so scores are independent
            raw = match_resume_to_jds(
                resume_pdf_path=tmp_path,
                jd_texts=[jd_text],
            )

            preview = jd_text[:120].rstrip() + ("…" if len(jd_text) > 120 else "")

            if "error" in raw:
                results.append(
                    SingleMatchResult(
                        jd_index=idx,
                        jd_preview=preview,
                        jd_source=source,
                        jd_filename=filename,
                        error=raw["error"],
                    )
                )
            else:
                results.append(
                    SingleMatchResult(
                        jd_index=idx,
                        jd_preview=preview,
                        jd_source=source,
                        jd_filename=filename,
                        match_score=raw.get("match_score"),
                        matching_skills=raw.get("matching_skills", []),
                        missing_skills=raw.get("missing_skills", []),
                        summary=raw.get("summary", ""),
                        role_category=raw.get("role_category", ""),
                        ats_coverage=raw.get("ats_coverage"),
                        prioritized_gaps=raw.get("prioritized_gaps", []),
                        salary_band=raw.get("salary_band"),
                        database_size=raw.get("database_size"),
                    )
                )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    return MatchResponse(results=results)
