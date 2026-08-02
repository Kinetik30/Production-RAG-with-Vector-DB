"""
src/market_insights.py — Deterministic, LLM-free market insights for the Resume Matcher.

All data comes from pre-computed local sources (no LLM calls, no CSV loading at
request time):
  - Role category          → classify_role() keyword matching (src/ingestion)
  - Skill demand + salary  → trends_cache (already in memory at API startup)
  - ATS coverage           → pure string matching against SKILL_ALIASES

These power the "Career Coach" additions: market-weighted gap priorities,
a deterministic ATS coverage score, and a salary band for the matched role.
"""

import re

from src.ingestion import classify_role
from src.analytics import SKILL_ALIASES, ROLE_DISPLAY_TO_CATEGORY, _display_name
from src import trends_cache

# Canonical skill → compiled regex of its aliases (lowercase match)
_SKILL_RE: dict[str, re.Pattern] = {
    skill: re.compile("|".join(re.escape(a) for a in aliases), re.IGNORECASE)
    for skill, aliases in SKILL_ALIASES.items()
}


def get_role_category(text: str) -> str:
    """Classify a raw JD text into a role_category (keyword based, instant)."""
    if not text:
        return "other"
    return classify_role(text[:2000])


def _representative_role(category: str) -> str | None:
    """Return a display role name that exists in the trends cache for a category."""
    cached = set(trends_cache.cached_roles())
    for display, cat in ROLE_DISPLAY_TO_CATEGORY.items():
        if cat == category and display in cached:
            return display
    for display, cat in ROLE_DISPLAY_TO_CATEGORY.items():
        if cat == category:
            return display
    return None


def _market_profile(category: str) -> dict:
    """Return demand-by-skill + salary band for a category from the trends cache."""
    rep = _representative_role(category)
    if not rep:
        return {"top_skills": {}, "salary_band": None}
    entry = trends_cache.get(rep)
    if not entry:
        return {"top_skills": {}, "salary_band": None}

    top_skills: dict[str, float] = {
        skill: float(pct)
        for skill, pct in entry.get("skillDemand", {}).items()
    }

    salary_band: dict | None = None
    target_name = _display_name(category)
    for item in entry.get("salaryDistribution", []):
        if item.get("role") == target_name:
            salary_band = {
                "median_lpa": item.get("medianLpa"),
                "q1_lpa": item.get("q1Lpa"),
                "q3_lpa": item.get("q3Lpa"),
                "min_lpa": item.get("minLpa"),
                "max_lpa": item.get("maxLpa"),
            }
            break

    return {"top_skills": top_skills, "salary_band": salary_band}


def ats_coverage(resume_text: str, jd_text: str) -> dict:
    """
    Deterministic ATS-style coverage: what fraction of the JD's recognised
    skill keywords also appear in the resume.

    Returns {coverage_pct, jd_skills, covered_skills, missing_skills}.
    """
    jd_hits = [s for s, rx in _SKILL_RE.items() if rx.search(jd_text)]
    if not jd_hits:
        return {
            "coverage_pct": 0,
            "jd_skills": [],
            "covered_skills": [],
            "missing_skills": [],
        }

    covered = [s for s in jd_hits if _SKILL_RE[s].search(resume_text)]
    missing = [s for s in jd_hits if s not in covered]
    coverage_pct = round(len(covered) / len(jd_hits) * 100)

    return {
        "coverage_pct": coverage_pct,
        "jd_skills": jd_hits,
        "covered_skills": covered,
        "missing_skills": missing,
    }


def _canonical_skill(name: str) -> str | None:
    """Map a free-form LLM skill name to its canonical vocab skill, if any."""
    lowered = name.strip().lower()
    for skill, aliases in SKILL_ALIASES.items():
        if skill.lower() == lowered or lowered in aliases:
            return skill
    return None


def prioritized_gaps(missing_skills: list[str], category: str) -> list[dict]:
    """
    Rank missing skills by market demand % from the trends cache.
    Each item: {skill, demand_pct, priority}.
    """
    demand = _market_profile(category)["top_skills"]
    gaps = []
    for name in missing_skills:
        if not isinstance(name, str) or not name.strip():
            continue
        canonical = _canonical_skill(name)
        pct = demand.get(canonical, 0) if canonical else 0
        if pct >= 60:
            priority = "high"
        elif pct >= 30:
            priority = "medium"
        else:
            priority = "low"
        gaps.append({
            "skill": name.strip(),
            "demand_pct": pct,
            "priority": priority,
        })
    gaps.sort(key=lambda g: g["demand_pct"], reverse=True)
    return gaps


def salary_band(category: str) -> dict | None:
    """Return the salary band (LPA) for a category, or None if unavailable."""
    return _market_profile(category)["salary_band"]


def database_size(category: str) -> int | None:
    """Return the total number of postings the analytics were built from."""
    rep = _representative_role(category)
    if not rep:
        return None
    entry = trends_cache.get(rep)
    if not entry:
        return None
    stats = entry.get("marketStats", {}) or {}
    return stats.get("totalDatabaseJds")
