from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


jd_splitter = RecursiveCharacterTextSplitter(
    chunk_size=2000,
    chunk_overlap=250,
    length_function=len,
    separators=["\n\n", "\n", ".", " ", ""],
)


def chunk_documents(raw_docs: list[dict]) -> list[Document]:
    """Convert raw {text, metadata} dicts into chunked LangChain Documents."""
    resume_docs: list[Document] = []
    jd_docs: list[Document] = []

    for d in raw_docs:
        if not d.get("text", "").strip():
            continue
        doc = Document(page_content=d["text"], metadata=d["metadata"])
        if d.get("metadata", {}).get("doc_type") == "resume":
            resume_docs.append(doc)
        else:
            jd_docs.append(doc)

    jd_chunks = jd_splitter.split_documents(jd_docs)
    all_chunks = resume_docs + jd_chunks

    print(
        f"[Chunking] {len(resume_docs)} resume(s) kept whole + "
        f"{len(jd_docs)} JD(s) -> {len(jd_chunks)} JD chunk(s) "
        f"= {len(all_chunks)} total chunk(s)"
    )
    return all_chunks
