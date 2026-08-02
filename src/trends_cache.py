"""
src/trends_cache.py — Persistent disk-backed cache for Trends Analytics.

Flow:
  - On startup: load data/trends_cache.json into _CACHE dict (fast, ~1s).
  - If the file doesn't exist: build it in a background thread (one-time, ~5-10 min).
  - POST /api/trends       → instant dict lookup from _CACHE.
  - POST /api/trends/rebuild-cache → re-runs compute, overwrites JSON file.

The in-memory dict (_CACHE) is the hot path; the JSON file is the persistent store.
"""

import json
import threading
import time
from pathlib import Path
from typing import Any

CACHE_PATH = Path("./data/trends_cache.json")

# ── In-memory store ──────────────────────────────────────────────────────────
_CACHE: dict[str, Any] = {}           # role → RoleTrendsData dict
_BUILDING = False                      # True while background build is running
_BUILD_LOCK = threading.Lock()

# ── Public helpers ────────────────────────────────────────────────────────────

def get(role: str) -> dict | None:
    """Return cached data for a role, or None if not yet available."""
    return _CACHE.get(role)


def is_building() -> bool:
    return _BUILDING


def cached_roles() -> list[str]:
    return list(_CACHE.keys())


# ── Disk I/O ──────────────────────────────────────────────────────────────────

def _load_from_disk() -> bool:
    """Load the JSON cache file into _CACHE. Returns True on success."""
    if not CACHE_PATH.exists():
        return False
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)
        _CACHE.update(data)
        print(f"[TrendsCache] Loaded {len(_CACHE)} roles from {CACHE_PATH}")
        return True
    except Exception as exc:
        print(f"[TrendsCache] Warning: could not load cache file: {exc}")
        return False


def _save_to_disk() -> None:
    """Persist _CACHE to the JSON file."""
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = CACHE_PATH.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_CACHE, f, separators=(",", ":"))
        tmp.replace(CACHE_PATH)
        print(f"[TrendsCache] Saved {len(_CACHE)} roles → {CACHE_PATH}")
    except Exception as exc:
        print(f"[TrendsCache] Error saving cache: {exc}")


# ── Build logic ───────────────────────────────────────────────────────────────

ALL_ROLE_NAMES: list[str] = [
    "Data Scientist", "Data Analyst", "Machine Learning Engineer", "Data Engineer",
    "Software Engineer", "Backend Developer", "Frontend Developer",
    "DevOps Engineer", "Full Stack", "Site Reliability Engineer", "Product Manager", "Designer",
    "User Experience Designer", "Cybersecurity", "Security", "Information Technology", "Management",
    "Marketing", "Human Resources", "Finance", "Operations", "Sales", "Healthcare",
]


def _build_cache(roles: list[str] | None = None) -> None:
    """Compute trends for every role and populate _CACHE + disk file."""
    global _BUILDING
    from src.analytics import analyze_trends_for_role, _load_all_csvs

    targets = roles or ALL_ROLE_NAMES
    total = len(targets)
    t0 = time.time()

    # Load CSVs once — reused for every role (avoids 10s disk reload per role)
    print("[TrendsCache] Loading CSV data…")
    df = _load_all_csvs("./data")
    print(f"[TrendsCache] CSV loaded ({len(df):,} rows). Building cache for {total} roles…")

    for i, role in enumerate(targets, 1):
        try:
            result = analyze_trends_for_role(role=role, time_range="Last Year", _df=df)
            _CACHE[role] = result
            elapsed = time.time() - t0
            print(f"[TrendsCache] [{i}/{total}] {role} done  ({elapsed:.0f}s elapsed)")
        except Exception as exc:
            print(f"[TrendsCache] [{i}/{total}] {role} ERROR: {exc}")

    _save_to_disk()
    _BUILDING = False
    print(f"[TrendsCache] Done — {len(_CACHE)} roles cached in {time.time() - t0:.0f}s")


def _build_cache_background(roles: list[str] | None = None) -> None:
    """Kick off _build_cache in a daemon thread."""
    global _BUILDING
    with _BUILD_LOCK:
        if _BUILDING:
            print("[TrendsCache] Build already in progress, skipping.")
            return
        _BUILDING = True
    t = threading.Thread(target=_build_cache, args=(roles,), daemon=True, name="TrendsCacheBuilder")
    t.start()


# ── Startup entry-point ───────────────────────────────────────────────────────

def init() -> None:
    """
    Called once at API startup.
    • If the JSON cache exists → load it instantly.
    • Otherwise → start a background build (server stays responsive immediately;
      requests for uncached roles fall back to on-demand compute).
    """
    loaded = _load_from_disk()
    if not loaded:
        print("[TrendsCache] No cache file found — starting background build.")
        _build_cache_background()
    else:
        # Check if any roles are missing and fill them in the background
        missing = [r for r in ALL_ROLE_NAMES if r not in _CACHE]
        if missing:
            print(f"[TrendsCache] {len(missing)} roles missing from cache — rebuilding in background.")
            _build_cache_background(missing)


def rebuild(roles: list[str] | None = None) -> dict:
    """
    Force a full (or partial) cache rebuild.
    Returns immediately with status info; build runs in background.
    """
    if _BUILDING:
        return {"status": "already_building", "cached_roles": len(_CACHE)}
    _build_cache_background(roles)
    return {
        "status": "rebuild_started",
        "roles": roles or ALL_ROLE_NAMES,
        "cached_roles": len(_CACHE),
    }
