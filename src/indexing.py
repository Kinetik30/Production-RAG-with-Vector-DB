import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document

embedding_fn = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"batch_size": 128},
    show_progress=True,
)


def _make_embedding_fn(device: str) -> HuggingFaceEmbeddings:
    """Create an embedding function on a specific device (cpu | cuda)."""
    return HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2",
        model_kwargs={"device": device},
        encode_kwargs={"batch_size": 128},
        show_progress=True,
    )


def _reindex_device() -> str:
    """
    Device used for the bulk re-embed during index rebuilds (only).

    Controlled by REINDEX_DEVICE (default "cpu"). If "cuda" is requested but
    CUDA is unavailable, falls back to "cpu" gracefully.
    """
    requested = os.environ.get("REINDEX_DEVICE", "cpu").strip().lower()
    if requested == "cuda":
        import torch
        if torch.cuda.is_available():
            return "cuda"
        print("[Indexing] REINDEX_DEVICE=cuda requested but CUDA unavailable -- falling back to cpu.")
    return "cpu"


def build_semantic_index(
    chunks: list[Document],
    persist_directory: str = "./data/chroma_db",
) -> Chroma:
    """Embed all chunks and persist to ChromaDB (device via REINDEX_DEVICE)."""
    device = _reindex_device()
    embed = _make_embedding_fn(device) if device == "cuda" else embedding_fn
    print(f"[Indexing] Building semantic index ({len(chunks)} chunks) on '{device}' -> '{persist_directory}'")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embed,
        persist_directory=persist_directory,
    )
    print(f"[Indexing] Semantic index built and persisted.")
    return vectorstore


def load_semantic_index(persist_directory: str = "./data/chroma_db") -> Chroma:
    """Reload an existing ChromaDB store without re-embedding."""
    print(f"[Indexing] Loading semantic index from '{persist_directory}'")
    return Chroma(
        persist_directory=persist_directory,
        embedding_function=embedding_fn,
    )


def get_or_build_semantic_index(
    chunks: list[Document],
    persist_directory: str = "./data/chroma_db",
    force_rebuild: bool = False,
) -> Chroma:
    """Load ChromaDB index if it exists, otherwise build and persist it."""
    from pathlib import Path
    import shutil
    db_path = Path(persist_directory)
    already_exists = db_path.exists() and any(db_path.iterdir())

    if already_exists and not force_rebuild:
        print(f"[Indexing] Found existing index at '{persist_directory}' -- loading (skipping re-embed).")
        return load_semantic_index(persist_directory)

    if force_rebuild and already_exists:
        print(f"[Indexing] force_rebuild=True -- wiping '{persist_directory}' and rebuilding.")
        shutil.rmtree(persist_directory)

    return build_semantic_index(chunks, persist_directory)


def add_to_index(
    new_chunks: list[Document],
    persist_directory: str = "./data/chroma_db",
) -> Chroma:
    """Incrementally add new chunks to an existing ChromaDB index."""
    vectorstore = load_semantic_index(persist_directory)
    vectorstore.add_documents(new_chunks)
    print(f"[Indexing] Added {len(new_chunks)} new chunk(s) to existing index at '{persist_directory}'.")
    return vectorstore


def build_bm25_index(chunks: list[Document], k: int = 20) -> BM25Retriever:
    """Build an in-memory BM25 retriever from the chunk list."""
    retriever = BM25Retriever.from_documents(chunks)
    retriever.k = k
    print(f"[Indexing] BM25 index built in memory (k={k}).")
    return retriever
