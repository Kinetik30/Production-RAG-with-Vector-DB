# RAG — Skill Lens

Resume × JD matcher + role-skill explorer + trends analytics.
Stack: FastAPI + LangChain/ChromaDB + sentence-transformers (CPU) + React/Vite.

## Commands (use these, don't improvise)
- API (backend):  uv run uvicorn api.main:app --reload --port 8000
- Frontend:       cd frontend && npm run dev   (proxies /api -> 127.0.0.1:8000)
- Build/lint:     npm run build / npm run lint

## Layout
- src/      pipeline: ingestion → chunking → indexing → retrieval → generation (+ analytics, trends_cache)
- api/      FastAPI routers (/api/match, /api/explore, /api/trends)
- frontend/ React 19 + Vite; three pages (Matcher, Explorer, Trends)
- data/     CSVs + persisted ChromaDB + cache files (gitignored)

## Environment
- LLM via .env: LLM_PROVIDER (openrouter|groq); keys in .env — never commit.

## Gotchas
- DO NOT read data/*.csv directly — us_tech_jobs_2024.csv is ~971 MB / 4.9M rows. Inspect via pandas/head only.
- Index rebuild is expensive: use FORCE_REBUILD=1 or force_rebuild=True deliberately.
- Trends served from data/trends_cache.json; rebuild via POST /api/trends/rebuild-cache.
