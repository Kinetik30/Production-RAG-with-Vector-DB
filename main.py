import json
from pathlib import Path

from langchain_core.documents import Document

from src.ingestion  import (
    load_jd_dataset,
    load_jds_from_texts,
    extract_resume_text,
)
from src.chunking   import chunk_documents
from src.indexing   import get_or_build_semantic_index, build_bm25_index
from src.retrieval  import build_ensemble_retriever, retrieve_jd_chunks_only
from src.generation import generate_match_analysis, generate_role_skills
from src.market_insights import (
    ats_coverage,
    prioritized_gaps,
    salary_band,
    get_role_category,
    database_size,
)


RESUMES_DIR = "./data/resumes"
DATA_DIR    = "./data"
CHROMA_DIR  = "./data/chroma_db"
CHUNKS_CACHE = "./data/chunks_cache.pkl"


def _save_chunks(chunks: list[Document], path: str = CHUNKS_CACHE) -> None:
    import pickle
    with open(path, "wb") as f:
        pickle.dump(chunks, f)
    print(f"[Index] Cached {len(chunks)} chunks to '{path}'")


def _load_chunks(path: str = CHUNKS_CACHE) -> list[Document] | None:
    import pickle
    try:
        with open(path, "rb") as f:
            chunks = pickle.load(f)
        print(f"[Index] Loaded {len(chunks)} chunks from cache '{path}'")
        return chunks
    except (FileNotFoundError, pickle.UnpicklingError, EOFError):
        return None


# ── Shared: Build the JD-only index ────────────────────────────────────────────

def build_jd_index(
    force_rebuild: bool = False,
    max_docs: int | None = None,
    exclude_categories: list[str] | None = None,
):
    """
    Load the JD CSV(s), chunk them, and build/load the hybrid retriever.
    Call this once and pass the retriever to explore_role_skills().

    Parameters:
        force_rebuild     - force-rebuild the ChromaDB index if True
        max_docs          - cap total documents loaded (None = no limit)
        exclude_categories - list of role_category values to exclude (e.g. ["other"])

    Returns: EnsembleRetriever
    """
    chunks = _load_chunks()
    if chunks is None or force_rebuild:
        print("[Index] Loading JD database...")
        jd_docs = load_jd_dataset(DATA_DIR, max_docs=max_docs)

        if exclude_categories:
            before = len(jd_docs)
            jd_docs = [d for d in jd_docs if d["metadata"].get("role_category") not in exclude_categories]
            print(f"[Index] Excluded {before - len(jd_docs)} docs in categories {exclude_categories}")

        from collections import Counter
        cat_counts = Counter(d["metadata"].get("role_category", "unknown") for d in jd_docs)
        print(f"[Index] Role distribution: {dict(cat_counts.most_common())}")
        chunks = chunk_documents(jd_docs)
        _save_chunks(chunks)
    else:
        from collections import Counter
        cat_counts = Counter(c.metadata.get("role_category", "unknown") for c in chunks)
        print(f"[Index] Role distribution (cached): {dict(cat_counts.most_common())}")

    vectorstore = get_or_build_semantic_index(chunks, persist_directory=CHROMA_DIR, force_rebuild=force_rebuild)
    bm25_retriever = build_bm25_index(chunks)
    retriever = build_ensemble_retriever(bm25_retriever, vectorstore)

    print("[Index] JD index ready.\n")
    return retriever


# ── Mode 1: Resume × JD Matcher ────────────────────────────────────────────────

def match_resume_to_jds(
    resume_pdf_path: str,
    jd_texts: list[str],
    task: str = (
        "Evaluate how well this resume matches the provided job description(s). "
        "Identify matching skills, missing skills, and give an overall match score."
    ),
) -> dict:
    """
    Score a single resume against caller-supplied JD texts.

    Parameters:
        resume_pdf_path  - absolute or relative path to the resume PDF
        jd_texts         - list of raw JD strings to match against
                           (these are NOT looked up in the database — they are
                            injected directly into the LLM context as-is)
        task             - custom instruction for the LLM (optional)

    Returns:
        dict with keys: match_score, matching_skills, missing_skills, summary
    """
    print("=" * 60)
    print("Mode 1 — Resume × JD Matcher")
    print("=" * 60)

    # 1. Read resume PDF directly
    print(f"\n[Resume] Reading: {resume_pdf_path}")
    resume_text = extract_resume_text(resume_pdf_path)
    if not resume_text.strip():
        return {"error": f"Could not extract text from '{resume_pdf_path}'"}
    print(f"[Resume] Extracted {len(resume_text)} chars.")

    # 2. Wrap provided JD strings into Document objects
    if not jd_texts:
        return {"error": "No JD texts provided. Pass at least one JD string."}

    raw_jd_docs = load_jds_from_texts(jd_texts)
    jd_chunks   = chunk_documents(raw_jd_docs)  # chunk long JDs

    # 3. Build the full context: one resume Document + JD chunks
    resume_doc = Document(
        page_content=resume_text,
        metadata={
            "source_id": Path(resume_pdf_path).stem,
            "doc_type":  "resume",
        },
    )
    top_chunks = [resume_doc] + jd_chunks

    # 4. Generate match analysis
    print(f"\n[LLM] Running match analysis (1 resume + {len(jd_chunks)} JD chunk(s))...")
    result = generate_match_analysis(task=task, top_chunks=top_chunks)

    # 5. Attach deterministic, LLM-free market insights (no API cost)
    jd_text = jd_texts[0]
    category = get_role_category(jd_text)
    result["role_category"] = category
    result["ats_coverage"] = ats_coverage(resume_text, jd_text)
    result["prioritized_gaps"] = prioritized_gaps(
        result.get("missing_skills", []), category
    )
    result["salary_band"] = salary_band(category)
    result["database_size"] = database_size(category)

    return result


# ── Mode 2: Role Skill Explorer ────────────────────────────────────────────────

def explore_role_skills(
    role: str,
    retriever=None,
    top_k: int = 5,
    force_rebuild: bool = False,
) -> dict:
    """
    Retrieve relevant JDs from the database and ask the LLM to synthesise
    the required tech stack / skills for a given role.

    Parameters:
        role          - e.g. "Software Development Engineer", "Data Analyst", "Machine Learning Operations Engineer"
        retriever     - pre-built EnsembleRetriever (from build_jd_index()).
                        If None, the index is built automatically.
        top_k         - number of JD chunks to send to the LLM
        force_rebuild - force-rebuild the ChromaDB index if True

    Returns:
        dict with keys: role, required_skills, nice_to_have_skills, summary
    """
    print("=" * 60)
    print(f"Mode 2 — Role Skill Explorer: '{role}'")
    print("=" * 60)

    if retriever is None:
        retriever = build_jd_index(force_rebuild=force_rebuild)

    print(f"\n[Retrieval] Querying JD database for role: '{role}'")
    jd_chunks = retrieve_jd_chunks_only(role, retriever, top_k=top_k)

    if not jd_chunks:
        print(f"[Retrieval] Zero relevant chunks met relevance threshold for role '{role}'. Returning no-data result.")
        return {
            "found_data": False,
            "role": role,
            "required_skills": [],
            "nice_to_have_skills": [],
            "summary": f"No relevant job description data found in the database for role '{role}'.",
        }

    print(f"\n[LLM] Synthesising skill profile from {len(jd_chunks)} JD chunk(s)...")
    result = generate_role_skills(role=role, jd_chunks=jd_chunks, top_k=top_k)
    return result


# ── Demo ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Ensure data directories exist
    Path(RESUMES_DIR).mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------------------------
    # Mode 1: Match Alice's resume against sample job descriptions
    # --------------------------------------------------------------------------
    dummy_jds = [
        (
            "We are looking for a Senior Data Scientist & Python Engineer to join our AI team. "
            "You will build data pipelines, train ML models, and design high-performance REST APIs. "
            "Experience with Python, SQL, PostgreSQL, Docker, AWS, and Data Analytics is required."
        ),
        (
            "Join our Data Science team to analyze large-scale datasets and implement ML solutions. "
            "Strong background in SQL, Python, Spark, and cloud infrastructure (AWS/GCP) is a must."
        ),
    ]

    resume_path = "./data/resumes/resume_alice_chen.pdf"

    mode1_result = match_resume_to_jds(
        resume_pdf_path=resume_path,
        jd_texts=dummy_jds,
        task="Evaluate match quality, list matching skills, missing skills, and provide a match score.",
    )

    print("\n" + "=" * 60)
    print("Mode 1 Result (Resume x JD Matcher)")
    print("=" * 60)
    print(json.dumps(mode1_result, indent=2))

    print("\n\n")

    # --------------------------------------------------------------------------
    # Mode 2: Explore required skills for diverse roles using the vector database
    # --------------------------------------------------------------------------
    retriever = build_jd_index(exclude_categories=["other"])

    for role in ["Backend Developer", "Data Scientist", "DevOps Engineer", "Product Manager"]:
        mode2_result = explore_role_skills(role=role, retriever=retriever)

        print("\n" + "=" * 60)
        print(f"Mode 2 Result — Role Skill Profile for '{role}'")
        print("=" * 60)
        print(json.dumps(mode2_result, indent=2))
        print()
