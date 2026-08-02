"""
scripts/add_docs.py — Safe incremental indexing for the JD database.

Adds new documents to the existing ChromaDB index WITHOUT disturbing existing
embeddings, and keeps the chunk cache (chunks_cache.pkl) in sync so the BM25
index picks the new docs up on the next server start.

Usage:
    uv run python scripts/add_docs.py path/to/file1.csv [path/to/file2.pdf ...]

Supported inputs:
    - CSV files (job descriptions, loaded with the same schema detection as data/)
    - PDF files (resumes/JDs, text extracted with pdfplumber)
    - A directory (all supported files inside, non-recursive)

Duplicate guard: any document whose source_id is already present in the index
is skipped (by default). Pass --allow-duplicates to force re-adding.

After running, restart the server to rebuild BM25 with the new chunks:
    uv run uvicorn api.main:app --reload --port 8000
"""

import argparse
import os
import pickle
import sys
from pathlib import Path

# Allow running from anywhere: put repo root on sys.path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.chunking import chunk_documents
from src.indexing import add_to_index, load_semantic_index
from src.ingestion import extract_resume_text, load_jd_dataset

CHROMA_DIR = os.environ.get("CHROMA_DIR", str(ROOT / "data" / "chroma_db"))
CHUNKS_CACHE = os.environ.get("CHUNKS_CACHE", str(ROOT / "data" / "chunks_cache.pkl"))
DATA_DIR = os.environ.get("DATA_DIR", str(ROOT / "data"))

SUPPORTED_EXT = {".csv", ".pdf"}


def _load_raw_docs(paths: list[Path]) -> list[dict]:
    """Load raw {text, metadata} docs from CSV/PDF files or directories."""
    raw: list[dict] = []
    for p in paths:
        if p.is_dir():
            for f in sorted(p.iterdir()):
                if f.suffix.lower() in SUPPORTED_EXT:
                    raw.extend(_load_raw_docs([f]))
            continue
        if p.suffix.lower() == ".csv":
            docs = load_jd_dataset(str(p))
            raw.extend(docs)
        elif p.suffix.lower() == ".pdf":
            text = extract_resume_text(str(p))
            if text and text.strip():
                raw.append({
                    "text": text,
                    "metadata": {
                        "source_id": p.stem,
                        "doc_type": "resume",
                        "source_file": p.name,
                    },
                })
        else:
            print(f"[AddDocs] Skipping unsupported file: {p.name}")
    return raw


def _existing_source_ids(vectorstore) -> set[str]:
    """Return the set of source_id values already in the ChromaDB index."""
    try:
        metas = vectorstore._collection.get(include=["metadatas"])["metadatas"]
    except Exception:
        return set()
    return {m.get("source_id") for m in metas if m and m.get("source_id")}


def main() -> None:
    parser = argparse.ArgumentParser(description="Incrementally add docs to the JD index.")
    parser.add_argument("paths", nargs="+", type=Path, help="CSV/PDF files or directories to add")
    parser.add_argument("--allow-duplicates", action="store_true",
                        help="Re-add docs even if their source_id already exists")
    args = parser.parse_args()

    raw = _load_raw_docs(args.paths)
    if not raw:
        print("[AddDocs] No documents loaded. Nothing to do.")
        return
    print(f"[AddDocs] Loaded {len(raw)} raw document(s).")

    # Chunk (JD docs chunked, resumes kept whole)
    new_chunks = chunk_documents(raw)
    if not new_chunks:
        print("[AddDocs] No chunks produced. Nothing to do.")
        return
    print(f"[AddDocs] Produced {len(new_chunks)} chunk(s).")

    # Load existing index (must already exist)
    vectorstore = load_semantic_index(CHROMA_DIR)

    # Deduplicate against existing source_ids
    if not args.allow_duplicates:
        existing = _existing_source_ids(vectorstore)
        before = len(new_chunks)
        new_chunks = [
            c for c in new_chunks
            if c.metadata.get("source_id") not in existing
        ]
        skipped = before - len(new_chunks)
        if skipped:
            print(f"[AddDocs] Skipped {skipped} chunk(s) from already-indexed source_ids.")
        if not new_chunks:
            print("[AddDocs] All documents already indexed. Nothing added.")
            return

    # Add to ChromaDB (incremental — existing embeddings untouched)
    add_to_index(new_chunks, persist_directory=CHROMA_DIR)

    # Sync chunk cache so BM25 includes the new chunks on next startup
    try:
        with open(CHUNKS_CACHE, "rb") as f:
            cached = pickle.load(f)
    except Exception:
        cached = []
    new_ids = {c.metadata.get("source_id") for c in new_chunks}
    cached = [c for c in cached if c.metadata.get("source_id") not in new_ids] + new_chunks
    with open(CHUNKS_CACHE, "wb") as f:
        pickle.dump(cached, f)
    print(f"[AddDocs] Chunk cache updated ({len(cached)} total chunks).")

    print("\n[AddDocs] Done. Restart the server to rebuild BM25 with the new chunks:")
    print("    uv run uvicorn api.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
