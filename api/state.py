"""
api/state.py — Shared lazy-initialised application state.

The retriever (JD index + BM25 + Chroma) is built once on first access
and then cached for the lifetime of the server process.
"""

import os

_retriever = None
_built = False


def _build_retriever():
    from main import build_jd_index
    force = os.environ.get("FORCE_REBUILD", "").strip() in ("1", "true", "yes")
    print(f"[API] Building JD index (force_rebuild={force})...")
    r = build_jd_index(force_rebuild=force)
    print("[API] JD index ready.")
    return r


def get_retriever():
    global _retriever, _built
    if not _built:
        _retriever = _build_retriever()
        _built = True
    return _retriever
