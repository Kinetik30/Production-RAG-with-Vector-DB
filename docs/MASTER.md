# Skill Lens — Master Documentation & Interview Prep

> **One document to understand everything about this project.** Covers the full RAG pipeline, every module, every parameter, design decisions, trade-offs, failure modes, and the questions an interviewer is most likely to ask.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [The Big Picture — What Actually Happens](#2-the-big-picture--what-actually-happens)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [Module Deep-Dives](#4-module-deep-dives)
   - [src/ingestion.py](#ingestionpy)
   - [src/chunking.py](#chunkingpy)
   - [src/indexing.py](#indexingpy)
   - [src/retrieval.py](#retrievalpy)
   - [src/generation.py](#generationpy)
   - [src/analytics.py](#analyticspy)
   - [src/trends_cache.py](#trends_cachepy)
   - [src/market_insights.py](#market_insightspy)
   - [main.py](#mainpy)
   - [api/ (FastAPI layer)](#api--fastapi-layer)
   - [frontend/ (React + Vite)](#frontend--react--vite)
5. [Data & Persistence](#5-data--persistence)
6. [Configuration & Environment](#6-configuration--environment)
7. [Design Decisions — Why X Instead of Y](#7-design-decisions--why-x-instead-of-y)
8. [Parameter Reference — What Happens If I Change This](#8-parameter-reference)
9. [Failure Modes & Degradation](#9-failure-modes--degradation)
10. [Performance & Cost](#10-performance--cost)
11. [Interview Questions & Model Answers](#11-interview-questions--model-answers)

---

## 1. Project Overview

**Name:** Skill Lens (internally codenamed "RAG" — the repo folder is `RAG/`)

**What it is:** A **Retrieval-Augmented Generation (RAG)** web application that helps job-seekers benchmark a resume against job descriptions. It has three features:

1. **Resume Matcher** (`/`) — upload a resume PDF, paste/upload one or more JDs, get an independent compatibility score per JD plus skills analysis.
2. **Role Skill Explorer** (`/explore`) — ask "what does a Data Engineer need to know?" and get a synthesised skill profile from a database of real job postings.
3. **Trends Dashboard** (`/trends`) — market analytics computed from the JD database: skill demand over time, salary distributions, posting volumes, experience requirements.

**Stack:**
- **Backend:** Python 3.14+, FastAPI + Uvicorn, managed with `uv`
- **RAG pipeline:** LangChain (text splitters, Chroma wrapper, BM25 retriever), ChromaDB (vector store), sentence-transformers (embeddings + cross-encoder reranker)
- **LLM:** OpenAI-compatible clients — OpenRouter (default) or Groq (fallback)
- **Frontend:** React 19 + TypeScript + Vite + React Router, hand-rolled SVG charts
- **Data:** pandas for CSV processing, pdfplumber for PDF text extraction

---

## 2. The Big Picture — What Actually Happens

### Feature 1: Resume Matcher (Mode 1)

```
User uploads resume.pdf + 1..N JDs (text or PDF)
   │
   ▼
POST /api/match  (api/routers/matcher.py)
   │
   ├─ resume PDF → temp file → pdfplumber → resume_text
   ├─ each JD text → direct string; each JD PDF → pdfplumber → text
   │
   ▼
match_resume_to_jds() (main.py)  ← called ONCE PER JD
   │
   ├─ wrap resume text + JD text(s) into LangChain Documents
   ├─ chunk the JD text (resume kept whole)
   ├─ build prompt (resume context + JD context + strict JSON schema)
   ├─ call LLM → JSON { match_score, matching_skills, missing_skills, summary }
   │
   ▼
Market insights attached (DETERMINISTIC, NO LLM):
   ├─ role_category          ← keyword classify_role()
   ├─ ats_coverage           ← % of JD skills found in resume text
   ├─ prioritized_gaps       ← missing skills ranked by market demand %
   ├─ salary_band            ← median/Q1/Q3 LPA for the detected role
   └─ database_size          ← total postings the stats were built from
   │
   ▼
Per-JD result returned; frontend renders a card per JD
```

### Feature 2: Role Skill Explorer (Mode 2)

```
POST /api/explore  { role, top_k }
   │
   ▼
api/state.py → build_jd_index() (once, cached for server lifetime)
   │
   ├─ load CSVs → load_jd_dataset() → chunk_documents()
   ├─ ChromaDB vector index (all-MiniLM-L6-v2 embeddings)
   ├─ in-memory BM25 index
   └─ EnsembleRetriever (BM25 0.4 / semantic 0.6) + CrossEncoder reranker
   │
   ▼
explore_role_skills()
   ├─ retrieve_jd_chunks_only(role) → top-k relevant JD chunks
   ├─ relevance threshold guard (min_score = -3.5) → no-data if below
   └─ generate_role_skills() → LLM synthesises required / nice-to-have skills
```

### Feature 3: Trends Dashboard

```
API startup → trends_cache.init()
   │
   ├─ cache file exists?  → load into memory instantly (~1s)
   └─ cache missing/stale → background thread builds it (~2–5 min)
   │
   ▼
POST /api/trends  { role }
   ├─ instant dict lookup from in-memory cache (hot path)
   └─ cache miss → compute on the fly from CSVs (rare)
   │
   ▼
Frontend renders: demand-over-time lines, top skills bars,
salary box-plots, posting-volume areas, market stat cards,
experience distribution
```

---

## 3. Architecture & Data Flow

```
                       ┌─────────────────────────────────────────────┐
                       │                 data/                       │
                       │  us_tech_jobs_2024.csv  (~94.5k rows)      │
                       │  indian_job_market_2025.csv (~98k rows)    │
                       │  chroma_db/  (persisted vector index)      │
                       │  chunks_cache.pkl  (cached chunks)         │
                       │  trends_cache.json (persisted analytics)   │
                       │  resumes/*.pdf    (sample resume)          │
                       └─────────────────────────────────────────────┘
                                          ▲
                                          │ reads
                 ┌────────────────────────┴─────────────────────────┐
                 │                     BACKEND                       │
                 │                                                   │
                 │  src/ingestion → src/chunking → src/indexing      │
                 │  → src/retrieval → src/generation                 │
                 │  src/analytics · src/trends_cache                 │
                 │  src/market_insights                              │
                 │                                                   │
                 │  main.py  (orchestrator + CLI demo)               │
                 │  api/     (FastAPI: state + routers)              │
                 └───────────────────────┬───────────────────────────┘
                                         │ /api/*  (JSON)
                                         ▼
                 ┌──────────────────────────────────────────────────┐
                 │   FRONTEND (React + Vite, port 5173)             │
                 │   Vite proxy /api → 127.0.0.1:8000               │
                 │   MatcherPage · ExplorerPage · TrendsPage        │
                 └──────────────────────────────────────────────────┘
```

**Key property:** The **LLM is only used in two places** — resume matching and role-skill synthesis. Everything else (retrieval, reranking, trends analytics, ATS coverage, gap prioritization, salary bands) is **deterministic local computation**. This is deliberate: it keeps the app fast, cheap, and rate-limit-safe on free LLM tiers.

---

## 4. Module Deep-Dives

### ingestion.py

**Purpose:** Convert raw inputs (PDFs, CSVs) into a uniform structure.

**Resume PDFs:** `extract_resume_text(pdf_path)` uses `pdfplumber` to extract per-page text. Defensive fallbacks:
- If the file is missing, it looks for *any* other PDF in the folder.
- If nothing is found, it returns hard-coded fallback text (a fake "Alice Chen" resume).

**JD CSVs:** `load_jd_dataset(data_path, text_column, max_docs)`:
- Scans a directory for all `*.csv` (excludes anything inside `chroma_db`).
- **Column auto-detection** by lowercased name matching (`job_description`, `job_titles`, `company_names`, `skills`, `location`, `experience_required`, `package_details`).
- If a `job_description` column exists, its text is used directly. Otherwise it **synthesises** a text block from available columns (`Job Title: …`, `Company: …`, etc.).
- Each row becomes `{"text": ..., "metadata": {...}}` with `doc_type`, `title`, `company`, `location`, `skills`, `source_file`, and a `role_category` computed by `classify_role()`.

**`classify_role(title)`:** keyword matching against 14 category keyword lists (data_science, engineering, data_engineering, product, design, cybersecurity, it, management, marketing, hr, finance, operations, sales, healthcare). Returns `"other"` if nothing matches. Note: it uses simple substring matching, so order of categories matters (first match wins).

**`load_jds_from_texts(jd_texts)`:** wraps caller-supplied JD strings (from the matcher's paste box) into the same `{text, metadata}` format. This is how the matcher accepts JDs **without touching the database** — the pasted JDs are injected straight into the LLM context.

### chunking.py

**Purpose:** Break long documents into pieces that retrieval can match precisely.

- `RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=250)`.
- Separators tried in order: paragraph break → newline → period → space → character.
- **Resumes are kept whole** (never chunked); **JDs are chunked**. This is intentional: a resume is the *query subject* that must be seen in full, while JDs are the *search corpus* that needs granular matching.

**Why chunk?** Embedding and searching whole documents gives one result per document — too coarse. Chunking lets retrieval match at the level of a skill list or a requirement line. The 250-char overlap prevents a skill from being split in half and missed.

### indexing.py

**Purpose:** Build the two search indexes used for hybrid retrieval.

**Semantic index (ChromaDB):**
- `embedding_fn = HuggingFaceEmbeddings(all-MiniLM-L6-v2)` — a lightweight, fast sentence-embedding model (384-dim vectors), CPU-only.
- `build_semantic_index()` embeds every chunk and persists to `./data/chroma_db`.
- `load_semantic_index()` reconnects to an existing store **without re-embedding**.
- `get_or_build_semantic_index(force_rebuild)`: if the DB exists and `force_rebuild` is False → load. If `force_rebuild` → wipe and rebuild. This is the expensive path (embedding ~190k JD chunks takes minutes).

**BM25 index:**
- `build_bm25_index(chunks, k=20)` — classic keyword ranking (TF-IDF family). **Always rebuilt in memory** from the chunk list; no persistence, because it's fast (milliseconds even for thousands of chunks).

**`add_to_index()`:** incremental path — loads existing DB, embeds *only new* chunks, inserts them. Used when adding a small number of documents without rebuilding everything.

### retrieval.py

**Purpose:** Turn a query into the most relevant chunks.

- `build_ensemble_retriever(bm25, vectorstore, k=20, weights=(0.4, 0.6))`: wraps BM25 + Chroma into LangChain's `EnsembleRetriever`, which merges both ranked lists using **Reciprocal Rank Fusion (RRF)**. Default weights favour semantic (0.6) over keyword (0.4).

**Why hybrid?** BM25 catches exact technical terms ("FastAPI", "K8s") but has no notion of meaning. Semantic search catches meaning ("cloud experience" ≈ "AWS, GCP") but can under-weight exact terms. Combining gives both.

- **Reranker:** `CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")`. Unlike embeddings (which encode query and doc *separately*), a CrossEncoder scores the query and doc **together**, which is more accurate — but too slow for a full corpus, so it's applied only to the ~20 candidates.

- `retrieve_jd_chunks_only(query, retriever, top_k, min_score, role_category)`:
  - **Alias expansion** for retrieval (`ROLE_ALIASES`: "SDE" → full phrase) to cast a wider net.
  - Scores with the **original clean query** (not the expanded alias) so long strings don't depress relevance scores.
  - Filters to JD-only chunks (drops stray resume chunks), optionally by `role_category`.
  - **Relevance threshold guard:** any chunk scoring below `MIN_RELEVANCE_SCORE = -3.5` is dropped. If everything fails → returns `[]`, which triggers the "no data found" response instead of hallucinating.

### generation.py

**Purpose:** LLM calls with strict output control and provider failover.

- `get_client(provider)`: builds an OpenAI-compatible client from `config.py`'s provider table.
- `call_llm(prompt, provider)`: sends with `temperature=0.0` and `seed=42` for **deterministic, reproducible** output.
- `generate_match_analysis()`: builds a prompt with **strict rules** (only attribute skills that literally appear in the resume; respond ONLY with a fixed JSON schema), tries providers in order, strips markdown fences, parses JSON.
- `generate_role_skills()`: Mode 2 prompt with **depth tiers** based on `top_k`:
  - `top_k <= 3` → "Fast Mode" (up to 6 required / 5 nice-to-have)
  - `top_k <= 5` → "Balanced Mode" (up to 10 / 8)
  - otherwise → "Comprehensive" (up to 18 / 15)
  - Includes an anti-prompt-injection rule (treat the role as a literal title, never execute instructions inside it) and a `found_data` flag.
- `clean_skill_list()`: dedupes and strips skill strings case-insensitively while preserving order.
- **Provider failover loop:** tries `LLM_PROVIDER` first, then every other provider in the table, with a retry + 2s sleep each.

### analytics.py

**Purpose:** Compute all Trends dashboard metrics from the raw CSVs.

- **`_load_all_csvs(data_dir)`:** loads every CSV into one normalised DataFrame with a `role_category` column. Also ingests `experience_min`/`experience_max` and `salary_min`/`salary_max`.
- **`_count_skills_in_vocab(df, vocab)`:** vectorised skill counting. For each of ~70 canonical skills, builds a pre-compiled regex of aliases and uses `str.contains` → boolean numpy array → count. Returns `(counts, total_docs)`.
- **`_parse_lpa(pkg_str)`:** parses `"10-20 Lacs PA"` or `"$100,000-$150,000"` into a midpoint **LPA (INR lakhs per annum)**. USD→INR conversion factor ~0.00085 (1 USD ≈ 85 INR, 1 LPA = 100k INR).
- **`_salary_stats(df, role_name)`:** computes box-plot stats (median, Q1, Q3, min-P5, max-P95). If fewer than 4 real values, falls back to **per-category hard-coded defaults** (so charts never render empty).
- **`_extract_month_bucket(post_time, n_months)`:** maps relative strings ("6 Days Ago", "2 Weeks Ago") or ISO dates to a 0..n-1 month bucket, relative to a reference date (2025-07-15).
- **`_demand_over_time()`:** vectorised monthly skill prevalence for top-5 skills. If >60% of data collapses into one bucket (common for scrape data), it **smooths** with an exponential decay from the peak month plus a mild upward trend — so charts look meaningful rather than spiky.
- **`_posting_volume_for_role()`:** per-month posting counts per role, with the same smoothing fallback.
- **`_experience_distribution(df, category)`:** buckets postings into 6 experience bands (0–1, 1–3, 3–5, 5–8, 8–12, 12+ yrs) using the upper bound of the required range (falls back to the lower bound). Uses `np.histogram`.
- **`analyze_trends_for_role(role, time_range, dataset_path, _df)`:** the main entry — returns the full dashboard payload: `demandOverTime`, `topSkills`, `skillDemand` (full per-skill % map), `salaryDistribution`, `postingVolume`, `experienceDistribution`, `marketStats`.

### trends_cache.py

**Purpose:** Avoid recomputing expensive analytics on every request.

- Disk store: `data/trends_cache.json`. In-memory hot path: `_CACHE` dict.
- `init()` (called once at API startup): loads the JSON into memory (~1s). If missing, kicks off a **background thread** build; server stays responsive meanwhile.
- `rebuild()`: triggers a background rebuild (used by `POST /api/trends/rebuild-cache`).
- Writes atomically (tmp file + rename).
- Because building all 23 roles takes minutes, the cache means the dashboard is instant on subsequent loads.

### market_insights.py

**Purpose:** the "Career Coach" differentiator — **LLM-free, deterministic** market insights attached to each match result.

- `get_role_category(text)` → `classify_role()` keyword matching.
- `ats_coverage(resume_text, jd_text)` — the ATS score: extract the set of canonical skills whose aliases appear in the JD, then check which also appear in the resume. Score = `covered / jd_skills × 100`. Pure string matching, instantly reproducible, no LLM cost.
- `_market_profile(category)` → reads demand + salary from `trends_cache` (never recomputes from CSVs).
- `prioritized_gaps(missing_skills, category)` — ranks LLM-returned missing skills by real market demand %: `>=60` → high, `>=30` → medium, else low.
- `salary_band(category)` → median/Q1/Q3 LPA.
- `database_size(category)` → total postings the analytics were built from (for the disclaimer).

### main.py

**Purpose:** orchestrator, CLI demo, and the shared functions used by the API.

- `build_jd_index(force_rebuild, max_docs, exclude_categories)` — loads JD CSVs, chunks, builds/loads ChromaDB + BM25, returns the `EnsembleRetriever`. Uses `chunks_cache.pkl` to skip re-chunking when nothing changed.
- `match_resume_to_jds(resume_pdf_path, jd_texts, task)` — the Mode 1 pipeline (resume + JDs → LLM result + market insights).
- `explore_role_skills(role, retriever, top_k, force_rebuild)` — Mode 2 pipeline.
- `if __name__ == "__main__"` — a demo that runs both modes and prints JSON.

### api/ (FastAPI layer)

- **`api/main.py`:** app factory, CORS (allows `http://localhost:5173`), mounts routers under `/api`, `/api/health`.
- **`api/state.py`:** **lazy singleton** — the JD index/retriever is built once on first access and cached for the server's lifetime. `FORCE_REBUILD=1` env forces a rebuild.
- **`api/routers/matcher.py`:** `POST /api/match`. Accepts `resume` (file), `jd_texts` (JSON array string), `jd_files` (optional PDF files). Extracts PDF text via `pdfplumber` from bytes; text JDs first, then PDF JDs; returns one `SingleMatchResult` per JD with `jd_source` ("text"|"pdf") and `jd_filename`.
- **`api/routers/explorer.py`:** `POST /api/explore` with `{role, top_k}`.
- **`api/routers/trends.py`:** `POST /api/trends`, `POST /api/trends/rebuild-cache`, `GET /api/trends/cache-status`.

### frontend/ (React + Vite)

- **Routing:** 3 pages via `react-router-dom` — `/` (Matcher), `/explore` (Explorer), `/trends` (Trends).
- **Vite proxy:** `/api` → `http://127.0.0.1:8000` so the frontend can call relative URLs in dev.
- **MatcherPage:** resume `FileUpload` + JD text editor + JD PDF dropzone; submits FormData; renders a `JdResultCard` per JD with `ScoreMeter`, matching/missing skills, and the **MarketInsights** section (ATS bar, top-3 priority gaps, salary band, "Career Coach deep dive" expandable panel with disclaimer). Keeps an **in-memory session cache** so results survive tab switches but vanish on refresh.
- **ExplorerPage:** role chips + free-text role input + depth presets (Fast/Balanced/Comprehensive → top_k 3/5/10).
- **TrendsPage:** hand-rolled SVG charts (multi-line demand, salary box-plots, stacked-area posting volume, experience bars) + market stat cards. Client-side cache Map so re-selecting a role is instant.
- **Shared icons (`components/icons.tsx`):** all SVG icons deduplicated into one file.

---

## 5. Data & Persistence

| Path | What it is | Git-ignored? |
|---|---|---|
| `data/us_tech_jobs_2024.csv` | ~94.5k US tech job postings | yes |
| `data/indian_job_market_2025.csv` | ~98k Indian job postings | yes |
| `data/chroma_db/` | persisted ChromaDB vector store | yes |
| `data/chunks_cache.pkl` | pickled LangChain chunk list (avoids re-chunking) | yes |
| `data/trends_cache.json` | persisted trends analytics | yes |
| `data/resumes/*.pdf` | sample resume(s) | yes |
| `.env` | API keys (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, `HF_TOKEN`) | yes |

**Note on the two datasets:** the US CSV has **no usable experience data** (`job_level` was populated on ~5 of 94k rows), so the experience-distribution chart draws from the Indian dataset. Salary handling covers both (USD→INR conversion for the US data, direct LPA for the Indian data).

---

## 6. Configuration & Environment

`.env` (gitignored) drives the LLM layer:

```
LLM_PROVIDER=openrouter            # primary provider
OPENROUTER_API_KEY=...             # primary key
GROQ_API_KEY=...                   # fallback key
HF_TOKEN=... / HUGGING_FACE_HUB_TOKEN=...
```

`src/config.py`:
```python
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openrouter")

PROVIDERS = {
  "openrouter": { base_url, api_key_env: "OPENROUTER_API_KEY", model: "openai/gpt-oss-20b:free" },
  "groq":       { base_url, api_key_env: "GROQ_API_KEY",       model: "llama-3.3-70b-versatile" },
}
```
**How to run:**

```bash
# Backend
uv run uvicorn api.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev        # proxies /api → 127.0.0.1:8000
```

### GPU reindexing (optional)

By default the whole pipeline runs on **CPU** (lean image, no CUDA deps). The only
GPU-accelerated path is the **bulk re-embed during an index rebuild**, controlled by
`REINDEX_DEVICE`:

```bash
# 1. Install a CUDA build of torch in the venv (once)
uv pip install --reinstall torch --index-url https://download.pytorch.org/whl/cu130

# 2. Rebuild the index on the GPU
REINDEX_DEVICE=cuda uv run python -c "from main import build_jd_index; build_jd_index(force_rebuild=True)"
```

- If `REINDEX_DEVICE=cuda` but CUDA is unavailable, it logs a warning and falls back to `cpu` (no crash).
- Only `build_semantic_index` uses the GPU; runtime query embedding (`load_semantic_index`) and the CrossEncoder reranker stay on CPU.
- Because embeddings are model-specific (not device-specific), a GPU-built index serves perfectly well from CPU afterwards.
- Caveat: it only speeds up the one-time ~190k-chunk build — per-request latency is LLM-dominated.

---

## 7. Design Decisions — Why X Instead of Y

**1. RAG instead of fine-tuning.** Fine-tuning a model on job data is expensive, stale the moment data changes, and can't retrieve per-query context. RAG lets us inject the *latest* relevant postings into the prompt at runtime and swap datasets without retraining.

**2. Hybrid retrieval (BM25 + vector) instead of vector-only.** Vector search alone misses exact keyword matches; keyword search alone misses semantics. The ensemble fuses both with Reciprocal Rank Fusion, then a CrossEncoder refines the top ~20. Classic three-stage retrieval: recall → precision.

**3. CrossEncoder rerank instead of just top-k embeddings.** Bi-encoder embeddings are fast but coarse. The CrossEncoder scores (query, chunk) pairs jointly for much better precision — affordable because it only sees ~20 candidates, not the full corpus.

**4. `all-MiniLM-L6-v2` instead of a larger model (e.g. BERT-large / OpenAI embeddings).** It's fast on CPU, tiny (384-dim), and "good enough" for skill/semantic matching. Cost of switching: rebuild the entire ChromaDB index (embeddings are model-specific — you can't mix models in one store).

**5. CrossEncoder rerank + relevance threshold instead of trusting raw similarity.** Without the `-3.5` threshold, the explorer would hallucinate a skill profile for queries that have no real match in the data. The threshold turns "no data" into an explicit, honest "No matching data" response.

**6. Local deterministic analytics + cache instead of an LLM for trends.** Trends (demand, salaries, postings) are pure aggregation — an LLM would add cost, latency, and hallucination risk with no accuracy gain. And the disk cache means the expensive CSV computation runs once, in the background, not per request.

**7. LLM-free "market insights" on the matcher (ATS, gaps, salary) — deliberately not LLM.** The ATS score and demand ranking are deterministic string/counting math over precomputed data. This is the product's differentiator ("market-backed", not "another AI list") *and* it means the feature costs zero LLM tokens and zero rate-limit risk.

**8. In-memory session cache instead of localStorage/sessionStorage for matcher results.** The requirement was "survive tab switches but be gone on refresh." A module-level variable in the JS bundle does exactly that; storage APIs would wrongly survive refresh. (Trends uses the same pattern for its role cache.)

**9. Provider failover (OpenRouter → Groq) instead of a single provider.** Free-tier APIs rate-limit and go down. Trying providers in order with retries keeps the demo working. Downside: two API keys to maintain, and different providers may return slightly different JSON (mitigated by `temperature=0`, `seed=42`, and strict prompts).

**10. Deterministic LLM settings (`temperature=0`, `seed=42`).** Makes repeated runs reproducible for demos and evaluation. Note: `seed` is best-effort with some providers.

**11. Flexible CSV schema auto-detection instead of hard-coded columns.** The two datasets have different schemas (US vs Indian). Lowercased-name matching lets `load_jd_dataset` and `_load_all_csvs` handle both without per-file code.

**12. pdfplumber for PDFs instead of a heavier tool.** Lightweight, pure-Python, already handles the text-extraction needs. (PyMuPDF is also in dependencies — a fast alternative if scanning/OCR is ever needed.)

**13. Resumes kept whole, JDs chunked.** The resume is the matching subject (must be read in full); JDs are the reference corpus (need granular retrieval). Chunking the resume would risk dropping skills at boundaries; chunking JDs is what makes retrieval precise.

**14. `uv` instead of raw pip/venv.** Faster dependency resolution and a locked environment (`uv.lock`) for reproducibility.

**15. Hand-rolled SVG charts instead of a charting library.** No dependency bloat, full visual control to match the theme, and the dataset sizes are small enough that it's trivial. (Would reconsider with a charting lib if charts get complex or need interactivity at scale.)

---

## 8. Parameter Reference — What Happens If I Change This

| Where | Parameter | Default | What it does | If I change it… |
|---|---|---|---|---|
| `chunking.py` | `chunk_size` | 2000 | Max chars per JD chunk | Smaller → more, finer chunks (better precision, more LLM tokens); larger → fewer, coarser chunks (cheaper, worse granularity). Requires index rebuild. |
| `chunking.py` | `chunk_overlap` | 250 | Overlap between chunks | Zero → skills may be cut at boundaries and missed. Larger → more redundancy, more tokens. |
| `retrieval.py` | `weights` in `build_ensemble_retriever` | `(0.4, 0.6)` | BM25 vs semantic influence | More BM25 → better exact-term recall; more semantic → better meaning recall. Must sum to 1. |
| `retrieval.py` | `MIN_RELEVANCE_SCORE` | `-3.5` | CrossEncoder cutoff | Higher → stricter, more "no data" results but fewer wrong matches; lower → more permissive, more hallucination risk. |
| `retrieval.py` | `ROLE_ALIASES` | … | Query expansion for retrieval | Adding aliases widens the semantic net for synonyms/abbreviations. |
| `main.py` / `api/state.py` | `force_rebuild` / `FORCE_REBUILD` | False | Wipe + rebuild ChromaDB | True → re-embeds ~190k chunks (minutes). Required after adding/changing JDs or changing the embedding model. |
| `main.py` | `max_docs` | None | Cap documents loaded | Capping speeds up indexing but reduces recall/coverage. |
| `main.py` | `exclude_categories` | None | Drop role categories | E.g. `["other"]` removes noise docs from the index. |
| `generation.py` | `temperature` | 0.0 | LLM randomness | Higher → more creative but non-deterministic output; can break JSON parsing. |
| `generation.py` | `seed` | 42 | Reproducibility | Best-effort; not honoured by all providers. |
| `generation.py` | `retries` | 1 | Retries per provider | Higher → more resilient to transient errors, slower failover. |
| `config.py` | `LLM_PROVIDER` | openrouter | Primary LLM | Switching to `groq` changes the primary model; keys must exist in `.env`. |
| `trends_cache.py` | `ALL_ROLE_NAMES` | 23 roles | Roles pre-built in cache | Adding a role makes the background build slower; the role must also be in the frontend `ALL_ROLES` list. |
| `market_insights.py` | priority thresholds | 60 / 30 | High/med/low cutoffs | Lower thresholds → more skills labelled "high priority". |
| `explorer.py` | `top_k` bounds | `ge=1 le=20` | Chunks sent to LLM | `top_k` also switches the LLM depth tier (3/5/10) in `generation.py`. |
| `analytics.py` | `ANCHOR` | 85 | Top-skills bar scaling | Anchors the highest skill at 85% for visual scale. |
| `analytics.py` | `_REFERENCE_DATE` | 2025-07-15 | Month-bucket anchor | Wrong anchor mis-buckets relative post times → skewed demand curves. |
| `indexing.py` | `k` in `build_bm25_index` | 20 | BM25 candidates | Higher → more recall, slower rerank. |

---

## 9. Failure Modes & Degradation

- **LLM provider down / rate-limited:** the matcher fails over to the next provider, then returns `{"error": ...}`. Frontend shows the error banner per JD.
- **No relevant JD data for a role (explorer):** relevance threshold drops everything → explicit "No matching data" card (never hallucinated skills).
- **LLM returns non-JSON:** generation strips markdown fences and retries parsing; if it still fails, returns an `error`/`raw_output` result rather than crashing.
- **Missing cache file (trends):** `init()` starts a background build; the first request for an uncached role computes on the fly (slow) then subsequent ones are instant.
- **Missing resume file:** `extract_resume_text` falls back to another PDF in the folder, then to hard-coded text — never a hard crash.
- **Bad JD PDF upload:** per-file 400 with the filename, not a 500.
- **Salary data too sparse (<4 values):** `_salary_stats` returns per-category hard-coded defaults so charts don't render empty.
- **Clustered post-time data:** exponential-decay smoothing kicks in so demand charts look meaningful instead of a single spike.

---

## 10. Performance & Cost

- **Expensive once:** building the ChromaDB index (minutes) and the trends cache (2–5 min) happen once, in the background, and are persisted.
- **Cheap always:** retrieval is in-memory (BM25) + ChromaDB; trends are dict lookups; ATS/gaps/salary are local math.
- **LLM cost = 1 call per JD** (matcher) or 1 call per explore query. Market insights add **zero** LLM calls.
- **Server startup** loads two small models (embeddings + cross-encoder) + trends cache → ~10–14s before the first request, then everything is fast.

---

## 11. Interview Questions & Model Answers

### What is RAG?
Retrieval-Augmented Generation: retrieve relevant context from a knowledge base, then feed it to an LLM alongside the question so the answer is grounded in your data rather than the model's training memory. Here: relevant job-description chunks are retrieved and injected into the matching prompt.

### Walk me through the end-to-end flow of the resume matcher.
Upload resume + JDs → API validates and extracts text → `match_resume_to_jds` chunks the JDs, builds a prompt (resume + JD context + strict JSON schema), calls the LLM for score/skills/summary → attaches deterministic market insights (role category, ATS coverage, prioritized gaps, salary band) → returns one result per JD.

### Why did you use hybrid retrieval?
BM25 catches exact keywords but misses meaning; semantic search catches meaning but can miss exact terms. The ensemble merges both via Reciprocal Rank Fusion for strong recall, and a CrossEncoder re-scores candidates for precision.

### Why a CrossEncoder reranker? Isn't it slower?
CrossEncoders are accurate but too slow for a large corpus, so it's applied only to the ~20 ensemble candidates. That gives near-vector-search speed with much better top-k precision.

### Why is the embedding model `all-MiniLM-L6-v2` and not a bigger one?
Fast, CPU-friendly, 384-dim, and sufficient for skill/semantic matching. The catch: embeddings are model-specific, so switching means a full ChromaDB rebuild.

### How does the ATS coverage score work? Is it using the LLM?
No. It's deterministic: extract the JD's recognised skill keywords from a fixed vocabulary of aliases, check which also appear in the resume text, score = covered/total. Zero LLM cost, fully reproducible.

### How do you prevent the LLM from hallucinating skills?
(1) The prompt strictly forbids attributing any skill not literally in the resume. (2) The explorer uses a relevance threshold so it returns "no data" instead of fabricating a profile. (3) Market gaps are ranked only against the LLM-returned missing list.

### Why is the trends data cached, and how?
Computing analytics over ~192k rows for 23 roles takes minutes. `trends_cache` loads a JSON snapshot into memory at startup (~1s), and a background thread rebuilds it when missing or on demand. The dashboard is a dict lookup after that.

### What happens if I change the chunk size?
Chunking granularity changes: smaller chunks = finer match precision but more LLM tokens; larger = cheaper but coarser. The ChromaDB index must be rebuilt (embeddings live at chunk granularity).

### Why do you keep resumes whole but chunk JDs?
The resume is the subject being evaluated — it must be read in full. JDs are the reference corpus — chunking them is what makes retrieval match at skill/requirement granularity.

### How do you handle the two datasets having different schemas?
Column auto-detection by lowercased names, plus flexible synthesis of description text when there's no explicit `job_description` column. Salary handling covers both USD (converted to INR LPA) and direct LPA.

### Why OpenRouter and Groq?
Free-tier resilience: one primary, one fallback, with retries and failover. Both are OpenAI-compatible, so one client abstraction serves both.

### What would you improve next?
- Structured output validation (JSON Schema / function-calling) instead of manual JSON parsing.
- RAGAS/evals to measure retrieval and generation quality.
- Async embeddings and caching layers for scale.
- User-auth + multi-tenancy and per-user saved analyses.
- A charting library if the dashboard grows.
- Guardrails/fact-checking for the generated resume rewrite.
