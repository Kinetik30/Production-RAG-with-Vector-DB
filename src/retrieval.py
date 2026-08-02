from langchain_classic.retrievers.ensemble import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_chroma import Chroma
from langchain_core.documents import Document
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def build_ensemble_retriever(
    bm25_retriever: BM25Retriever,
    vectorstore: Chroma,
    k: int = 20,
    weights: tuple[float, float] = (0.4, 0.6),
) -> EnsembleRetriever:
    """
    Combine BM25 and semantic retrieval into a single hybrid retriever.
    weights = (bm25_weight, semantic_weight), must sum to 1.
    """
    semantic_retriever = vectorstore.as_retriever(search_kwargs={"k": k})
    ensemble = EnsembleRetriever(
        retrievers=[bm25_retriever, semantic_retriever],
        weights=list(weights),
    )
    print(f"[Retrieval] Ensemble retriever built (BM25={weights[0]}, Semantic={weights[1]}, k={k})")
    return ensemble


MIN_RELEVANCE_SCORE = -3.5

ROLE_ALIASES: dict[str, str] = {
    "sde": "Software Development Engineer Software Engineer Backend Developer Full Stack Engineer",
    "software development engineer": "Software Development Engineer Software Engineer Backend Developer Full Stack Engineer",
    "software engineer": "Software Engineer Software Development Engineer Backend Engineer",
    "data analyst": "Data Analyst Data Scientist Analytics Data Engineer",
    "product manager": "Product Manager Technical Product Manager Product Lead",
    "frontend developer": "Frontend React Developer JavaScript Developer UI Engineer",
    "devops engineer": "DevOps Engineer Cloud Infrastructure Engineer Systems Engineer",
    "ml engineer": "Machine Learning Engineer MLOps Platform Engineer Data Scientist",
    "machine learning engineer": "Machine Learning Engineer MLOps Platform Engineer Data Scientist",
}


def retrieve_jd_chunks_only(
    query: str,
    ensemble_retriever: EnsembleRetriever,
    top_k: int = 5,
    min_score: float = MIN_RELEVANCE_SCORE,
    role_category: str | None = None,
) -> list[Document]:
    """
    Mode 2 variant: fetch candidates, keep only JD chunks, then rerank.
    Filters out any resume chunks that may have slipped through (safety guard)
    and enforces a minimum cross-encoder relevance score cutoff.
    If role_category is set, only chunks with that role_category metadata are kept.
    """
    cleaned_query = query.strip().lower()
    # Use alias expansion only for the retrieval step (BM25 + vector) to cast a
    # wider semantic net; keep the original user query for CrossEncoder scoring so
    # the long expanded string doesn't depress relevance scores below the threshold.
    search_query = ROLE_ALIASES.get(cleaned_query, query)
    rerank_query = query  # always score against the clean, user-supplied role name

    candidates = ensemble_retriever.invoke(search_query)
    if not candidates:
        print(f"[Retrieval] No candidates returned from ensemble retriever for '{search_query}'.")
        return []

    # Filter to JD-only + optional role_category
    jd_only = [doc for doc in candidates if doc.metadata.get("doc_type") == "jd"]
    if role_category:
        jd_only = [doc for doc in jd_only if doc.metadata.get("role_category") == role_category]
        print(f"[Retrieval] Filtered by role_category='{role_category}': {len(jd_only)}/{len(candidates)} chunks retained")
    else:
        print(f"[Retrieval] Filtered to JD-only: {len(jd_only)}/{len(candidates)} chunks retained")

    if not jd_only:
        print("[Retrieval] No JD chunks left after filtering.")
        return []

    # Rerank using the clean role name (not the expanded alias) for accurate scores
    pairs = [(rerank_query, doc.page_content) for doc in jd_only]
    scores = reranker.predict(pairs)  # type: ignore[arg-type]

    ranked = sorted(zip(jd_only, scores), key=lambda x: float(x[1]), reverse=True)

    # Filter out any candidates below minimum relevance threshold
    relevant_ranked = [(doc, score) for doc, score in ranked if float(score) >= min_score]

    if not relevant_ranked:
        top_score = float(ranked[0][1]) if ranked else None
        print(f"[Retrieval] All candidates failed relevance threshold (top score: {top_score:.2f} < {min_score}) for query '{query}'")
        return []

    top = [doc for doc, _ in relevant_ranked[:top_k]]
    print(f"[Retrieval] Reranked {len(jd_only)} candidates -> {len(relevant_ranked)} relevant (top score: {relevant_ranked[0][1]:.2f}) -> returning top {len(top)}")
    return top
