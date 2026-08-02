import re
import pdfplumber

import pandas as pd
from pathlib import Path


ROLE_CATEGORIES: dict[str, list[str]] = {
    "data_science":     ["data scientist", "data analyst", "ml engineer", "machine learning", "ai engineer", "data science", "nlp", "deep learning", "computer vision"],
    "engineering":      ["software engineer", "software developer", "backend", "frontend", "full stack", "fullstack", "devops", "sre", "platform engineer", "web developer", "application engineer", "systems engineer", "backend engineer", "frontend engineer"],
    "data_engineering": ["data engineer", "data platform", "data architect", "etl", "big data", "data pipeline", "data infrastructure", "data warehousing"],
    "product":          ["product manager", "product owner", "technical product manager", "product lead", "product director", "product management"],
    "design":           ["designer", "ux", "ui", "product design", "experience design", "creative", "graphic designer", "visual design"],
    "cybersecurity":    ["security", "cyber", "soc analyst", "threat", "incident response", "information security", "network security", "cybersecurity"],
    "it":               ["it ", "system admin", "network engineer", "help desk", "support engineer", "infrastructure", "it manager", "desktop support", "it support"],
    "management":       ["cto", "vp ", "director", "head of", "chief ", "manager", "lead "],
    "marketing":        ["marketing", "seo", "growth", "content", "social media", "brand", "digital marketing", "performance marketing"],
    "hr":               ["hr ", "human resource", "recruiter", "talent", "people", "hiring"],
    "finance":          ["finance", "accountant", "financial analyst", "auditor", "controller", "accounting"],
    "operations":       ["operations", "supply chain", "logistics", "project manager", "program manager"],
    "sales":            ["sales", "account executive", "account manager", "business development", "sales representative"],
    "healthcare":       ["nurse", "doctor", "physician", "medical", "healthcare", "pharma", "clinical"],
}


def classify_role(title: str) -> str:
    """Classify a job title into a role category based on keyword matching."""
    if not title or not isinstance(title, str):
        return "other"
    title_lower = title.lower().strip()
    for category, keywords in ROLE_CATEGORIES.items():
        for kw in keywords:
            if kw in title_lower:
                return category
    return "other"


def extract_resume_text(pdf_path: str) -> str:
    """Extract raw text from a single resume PDF. Returns fallback text if file is missing."""
    path = Path(pdf_path)
    if not path.exists():
        print(f"[Ingestion] Warning: Resume file '{pdf_path}' not found.")
        # Check if any other PDF exists in data/resumes
        resume_dir = path.parent if path.parent.exists() else Path("./data/resumes")
        if resume_dir.exists():
            pdfs = list(resume_dir.glob("*.pdf"))
            if pdfs:
                print(f"[Ingestion] Using alternative resume PDF: '{pdfs[0].name}'")
                with pdfplumber.open(pdfs[0]) as pdf:
                    return "\n".join(page.extract_text() or "" for page in pdf.pages)
        return (
            "Alice Chen - Senior Data Scientist & Python Engineer. "
            "Experienced in Python, SQL, Machine Learning, FastAPI, PostgreSQL, AWS, Docker, and Data Analytics."
        )

    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def load_resumes_from_dir(resumes_dir: str) -> list[dict]:
    """Load all PDFs in a directory as resume documents."""
    resume_dir = Path(resumes_dir)
    pdf_files = list(resume_dir.glob("*.pdf"))
    print(f"[Ingestion] Found {len(pdf_files)} resume PDF(s) in '{resumes_dir}'")

    docs = []
    for pdf_file in pdf_files:
        try:
            text = extract_resume_text(str(pdf_file))
            docs.append({
                "text": text,
                "metadata": {
                    "source_id": pdf_file.stem,
                    "doc_type": "resume",
                    "source_file": pdf_file.name,
                },
            })
            print(f"  [OK] Loaded: {pdf_file.name} ({len(text)} chars)")
        except Exception as e:
            print(f"  [ERR] Error loading {pdf_file.name}: {e}")

    return docs


def load_jd_dataset(
    data_path: str = "./data",
    text_column: str | None = None,
    max_docs: int | None = None,
) -> list[dict]:
    """
    Load JD dataset from a single CSV file, multiple CSV files, or a directory.
    Supports flexible schema auto-detection for column names (Job Titles, Skills, etc.).
    Optionally caps total documents loaded via max_docs for fast vector store indexing.
    """
    target_path = Path(data_path)
    csv_files: list[Path] = []

    if target_path.is_dir():
        csv_files = [f for f in target_path.glob("*.csv") if "chroma_db" not in f.parts]
    elif target_path.is_file():
        csv_files = [target_path]
    else:
        # Fallback: check parent directory or default data dir
        parent_dir = target_path.parent if target_path.parent.exists() else Path("./data")
        if parent_dir.exists() and parent_dir.is_dir():
            csv_files = [f for f in parent_dir.glob("*.csv") if "chroma_db" not in f.parts]

    if not csv_files:
        print(f"[Ingestion] Warning: No CSV files found matching '{data_path}'")
        return []

    docs = []
    per_file_limit = (max_docs // len(csv_files)) if max_docs and len(csv_files) > 0 else None

    for csv_file in csv_files:
        try:
            df = pd.read_csv(csv_file, low_memory=False)
        except Exception as e:
            print(f"  [ERR] Failed to read CSV '{csv_file.name}': {e}")
            continue

        cols_lower = {str(col).strip().lower(): col for col in df.columns}

        # Identify candidate columns
        desc_col = cols_lower.get(text_column.lower()) if text_column else cols_lower.get("job_description")
        title_col = cols_lower.get("job_titles") or cols_lower.get("job titles") or cols_lower.get("job_title") or cols_lower.get("title")
        company_col = cols_lower.get("company_names") or cols_lower.get("company names") or cols_lower.get("company")
        exp_col = cols_lower.get("experience_required") or cols_lower.get("experience required") or cols_lower.get("experience")
        pkg_col = cols_lower.get("package_details") or cols_lower.get("package details") or cols_lower.get("package") or cols_lower.get("salary")
        loc_col = cols_lower.get("locations") or cols_lower.get("location")
        skills_col = cols_lower.get("skills") or cols_lower.get("key skills") or cols_lower.get("key_skills")

        file_count = 0
        for i, row in df.iterrows():
            if per_file_limit and file_count >= per_file_limit:
                break

            parts = []
            
            # Explicit description column if available
            if desc_col and pd.notna(row[desc_col]) and str(row[desc_col]).strip():
                parts.append(str(row[desc_col]).strip())
            
            title_val = str(row[title_col]).strip() if title_col and pd.notna(row[title_col]) else ""
            company_val = str(row[company_col]).strip() if company_col and pd.notna(row[company_col]) else ""
            exp_val = str(row[exp_col]).strip() if exp_col and pd.notna(row[exp_col]) else ""
            pkg_val = str(row[pkg_col]).strip() if pkg_col and pd.notna(row[pkg_col]) else ""
            loc_val = str(row[loc_col]).strip() if loc_col and pd.notna(row[loc_col]) else ""
            skills_val = str(row[skills_col]).strip() if skills_col and pd.notna(row[skills_col]) else ""

            if not desc_col or not parts:
                if title_val:
                    parts.append(f"Job Title: {title_val}")
                if company_val:
                    parts.append(f"Company: {company_val}")
                if exp_val:
                    parts.append(f"Experience Required: {exp_val}")
                if loc_val:
                    parts.append(f"Location: {loc_val}")
                if pkg_val:
                    parts.append(f"Package: {pkg_val}")
                if skills_val:
                    parts.append(f"Key Skills: {skills_val}")

            text_content = "\n".join(parts).strip()
            if text_content:
                role_cat = classify_role(title_val)
                docs.append({
                    "text": text_content,
                    "metadata": {
                        "source_id": f"{csv_file.stem}_{i}",
                        "doc_type": "jd",
                        "title": title_val or f"JD_{i}",
                        "company": company_val,
                        "location": loc_val,
                        "skills": skills_val,
                        "source_file": csv_file.name,
                        "role_category": role_cat,
                    },
                })
                file_count += 1

        print(f"  [OK] Loaded {file_count} job description(s) from '{csv_file.name}'")

    print(f"[Ingestion] Total loaded: {len(docs)} job description(s) across {len(csv_files)} file(s).")
    return docs


def load_jds_from_texts(jd_texts: list[str]) -> list[dict]:
    """
    Wrap caller-supplied JD strings into the {text, metadata} format
    expected by chunk_documents. Used by Mode 1 (resume × JD matcher)
    so that arbitrary JDs can be passed at call-time without touching the database.
    """
    docs = []
    for i, text in enumerate(jd_texts):
        text = text.strip()
        if not text:
            continue
        docs.append({
            "text": text,
            "metadata": {
                "source_id": f"input_jd_{i}",
                "doc_type":  "jd",
                "title":     f"Provided JD {i + 1}",
            },
        })
    print(f"[Ingestion] Wrapped {len(docs)} caller-supplied JD text(s).")
    return docs
