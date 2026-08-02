import { useState } from "react";
import FileUpload from "../components/FileUpload";
import SkillBadge from "../components/SkillBadge";
import ScoreMeter from "../components/ScoreMeter";
import Spinner from "../components/Spinner";
import {
  TargetIcon, SearchIcon, ZapIcon, ShieldIcon, FileTextIcon, BarChartIcon, TrendingUpIcon,
} from "../components/icons";
import DatasetDisclaimer from "../components/DatasetDisclaimer";
import "./MatcherPage.css";

interface SingleMatchResult {
  jd_index: number;
  jd_preview: string;
  jd_source?: "text" | "pdf";
  jd_filename?: string | null;
  match_score: number | null;
  matching_skills: string[];
  missing_skills: string[];
  summary: string;
  role_category?: string;
  ats_coverage?: {
    coverage_pct: number;
    jd_skills: string[];
    covered_skills: string[];
    missing_skills: string[];
  } | null;
  prioritized_gaps?: Array<{ skill: string; demand_pct: number; priority: string }>;
  salary_band?: {
    median_lpa: number;
    q1_lpa: number;
    q3_lpa: number;
    min_lpa: number;
    max_lpa: number;
  } | null;
  database_size?: number | null;
  error?: string;
}

interface MatchResponse {
  results: SingleMatchResult[];
}

// In-memory session cache — survives tab switches, wiped on refresh.
let sessionCache: { jdTexts: string[]; results: SingleMatchResult[] } | null = null;

function JdEditor({
  jds,
  onChange,
}: {
  jds: string[];
  onChange: (jds: string[]) => void;
}) {
  const update = (idx: number, val: string) => {
    const next = [...jds];
    next[idx] = val;
    onChange(next);
  };
  const remove = (idx: number) => onChange(jds.filter((_, i) => i !== idx));

  return (
    <div className="jd-editor">
      {jds.map((text, idx) => (
        <div key={idx} className="jd-editor__row animate-fade">
          <div className="jd-editor__header">
            <span className="label">Job Description {idx + 1}</span>
            {jds.length > 1 && (
              <button
                type="button"
                className="btn btn-danger jd-editor__remove"
                onClick={() => remove(idx)}
                aria-label={`Remove job description ${idx + 1}`}
                id={`btn-remove-jd-${idx}`}
              >
                ✕ Remove
              </button>
            )}
          </div>
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => update(idx, e.target.value)}
            placeholder="Paste full job posting, key responsibilities, or technical requirements here…"
            id={`textarea-jd-${idx}`}
            rows={5}
          />
        </div>
      ))}
    </div>
  );
}

// ── Market Insights (Career Coach) ────────────────────────────────────────────
function atsColor(pct: number): string {
  return pct >= 75 ? "var(--accent-green)" : pct >= 50 ? "var(--accent-yellow)" : "var(--accent-red)";
}

function priorityLabel(p: string): string {
  return p === "high" ? "High" : p === "medium" ? "Medium" : "Low";
}

const CATEGORY_LABELS: Record<string, string> = {
  data_science: "Data Science & Analytics",
  engineering: "Software Engineering",
  data_engineering: "Data Engineering & Platforms",
  product: "Product Management",
  design: "Design & User Experience",
  cybersecurity: "Cybersecurity & InfoSec",
  it: "Information Technology",
  management: "Management & Leadership",
  marketing: "Marketing & Growth",
  hr: "Human Resources & Recruiting",
  finance: "Finance & Accounting",
  operations: "Operations & Supply Chain",
  sales: "Sales & Business Development",
  healthcare: "Healthcare & Clinical",
  other: "General / Unclassified",
};

function roleLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MarketInsights({ result }: { result: SingleMatchResult }) {
  const [expanded, setExpanded] = useState(false);
  const coverage = result.ats_coverage;
  const gaps = result.prioritized_gaps ?? [];
  const salary = result.salary_band;
  const topGaps = gaps.slice(0, 3);

  if (!coverage && gaps.length === 0 && !salary) return null;

  const role = result.role_category ? roleLabel(result.role_category) : null;

  return (
    <div className="market-insights animate-fade-up">
      <div className="market-insights__bar">
        <div className="mi-bar-row">
          <span className="mi-bar-label">ATS keyword coverage</span>
          <span className="mi-bar-value" style={{ color: coverage ? atsColor(coverage.coverage_pct) : "var(--text-muted)" }}>
            {coverage ? `${coverage.coverage_pct}%` : "—"}
          </span>
        </div>
        <div className="mi-bar-track">
          <div
            className="mi-bar-fill"
            style={{
              width: `${coverage?.coverage_pct ?? 0}%`,
              background: coverage ? atsColor(coverage.coverage_pct) : "var(--border-color)",
            }}
          />
        </div>
      </div>

      {topGaps.length > 0 && (
        <div className="mi-gaps">
          <span className="mi-section-label">Priority gaps · by market demand</span>
          <div className="flex-wrap">
            {topGaps.map((g) => (
              <span key={g.skill} className={`mi-gap-chip mi-gap-chip--${g.priority}`}>
                <span className="mi-gap-name">{g.skill}</span>
                <span className="mi-gap-demand">
                  {g.demand_pct > 0 ? `${g.demand_pct}% demand` : "learn"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {salary && (
        <div className="mi-salary">
          <span className="mi-salary-icon" aria-hidden="true">
            <BarChartIcon color="var(--accent-purple)" size={14} />
          </span>
          <span className="mi-salary-text">
            <strong className="mi-salary-label">Salary Benchmark:</strong>{" "}
            <span className="mi-salary-range">₹{salary.q1_lpa}–{salary.q3_lpa} LPA</span>{" "}
            <span className="mi-salary-median">(Median ₹{salary.median_lpa} LPA)</span>
          </span>
        </div>
      )}

      {(coverage || gaps.length > 0) && (
        <button
          type="button"
          className="mi-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span>{expanded ? "Hide Detailed Analytics" : "Detailed Analytics"}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {expanded && (
        <div className="mi-deepdive">
          <div className="mi-deepdive__hero">
            <span className="mi-deepdive__eyebrow">Detailed Analytics</span>
            <h4 className="mi-deepdive__title">
              Market-backed <span className="title-gradient-purple">readiness check</span>
            </h4>
            {role && <span className="mi-deepdive__role">{role}</span>}
          </div>

          {coverage && coverage.jd_skills.length > 0 && (
            <div className="mi-deepdive__section">
              <span className="mi-section-label">ATS keyword breakdown</span>
              <div className="mi-kw-cols">
                <div>
                  <span className="mi-kw-sub mi-kw-sub--covered">Covered ({coverage.covered_skills.length})</span>
                  <div className="flex-wrap">
                    {coverage.covered_skills.length === 0
                      ? <span className="text-muted" style={{ fontSize: "0.8rem" }}>None</span>
                      : coverage.covered_skills.map((s) => <SkillBadge key={s} label={s} variant="green" />)}
                  </div>
                </div>
                <div>
                  <span className="mi-kw-sub mi-kw-sub--missing">Missing ({coverage.missing_skills.length})</span>
                  <div className="flex-wrap">
                    {coverage.missing_skills.length === 0
                      ? <span className="text-muted" style={{ fontSize: "0.8rem" }}>None</span>
                      : coverage.missing_skills.map((s) => <SkillBadge key={s} label={s} variant="red" />)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {gaps.length > 0 && (
            <div className="mi-deepdive__section">
              <span className="mi-section-label">All gaps ranked by demand</span>
              <div className="mi-gap-list">
                {gaps.map((g) => (
                  <div key={g.skill} className="mi-gap-row">
                    <span className="mi-gap-row__name">{g.skill}</span>
                    <div className="mi-gap-row__track">
                      <div
                        className="mi-gap-row__fill"
                        style={{ width: `${Math.min(g.demand_pct, 100)}%` }}
                      />
                    </div>
                    <span className="mi-gap-row__pct">{g.demand_pct > 0 ? `${g.demand_pct}%` : "—"}</span>
                    <span className={`mi-gap-row__prio mi-gap-row__prio--${g.priority}`}>{priorityLabel(g.priority)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Per-JD result card ────────────────────────────────────────────────────────
function JdResultCard({ result, index }: { result: SingleMatchResult; index: number }) {
  if (result.error) {
    return (
      <div className="jd-result-card glass-card error-card animate-fade-up">
        <p className="text-secondary" style={{ fontSize: "0.9rem" }}>
          <strong style={{ color: "var(--accent-red)" }}>Error for Job Description {index + 1}:</strong>{" "}
          {result.error}
        </p>
      </div>
    );
  }

  return (
    <div className="jd-result-card glass-card animate-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="jd-result-card__header">
        <span className="jd-result-card__label">
          Job Description {index + 1}
          {result.jd_source === "pdf" && (
            <span className="jd-pdf-badge" title={result.jd_filename ?? undefined}>
              PDF{result.jd_filename ? ` · ${result.jd_filename}` : ""}
            </span>
          )}
        </span>
        <p className="jd-result-card__preview">{result.jd_preview}</p>
      </div>

      <div className="jd-result-card__score-row">
        <ScoreMeter score={result.match_score ?? 0} />
        <div className="jd-result-card__summary">
          <h3>Summary</h3>
          <p>{result.summary}</p>
        </div>
      </div>

      <hr className="divider" />

      <div className="skills-grid">
        <div className="skills-panel">
          <h3 className="skills-panel__title skills-panel__title--green">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Matching
            <span className="skills-count">{result.matching_skills.length}</span>
          </h3>
          {result.matching_skills.length === 0
            ? <p className="text-muted" style={{ fontSize: "0.85rem" }}>None found.</p>
            : <div className="flex-wrap">
                {result.matching_skills.map((s, i) => (
                  <SkillBadge key={s} label={s} variant="green" delay={i * 35} />
                ))}
              </div>
          }
        </div>

        <div className="skills-panel">
          <h3 className="skills-panel__title skills-panel__title--red">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Missing
            <span className="skills-count">{result.missing_skills.length}</span>
          </h3>
          {result.missing_skills.length === 0
            ? <p className="text-muted" style={{ fontSize: "0.85rem" }}>None — great fit!</p>
            : <div className="flex-wrap">
                {result.missing_skills.map((s, i) => (
                  <SkillBadge key={s} label={s} variant="red" delay={i * 35} />
                ))}
              </div>
          }
        </div>
      </div>

      <MarketInsights result={result} />
    </div>
  );
}

// ── Score overview bar ────────────────────────────────────────────────────────
function ScoreOverview({ results }: { results: SingleMatchResult[] }) {
  const valid = results.filter((r) => r.match_score != null);
  if (valid.length < 2) return null;

  const best = valid.reduce((a, b) =>
    (a.match_score ?? 0) > (b.match_score ?? 0) ? a : b
  );

  return (
    <div className="score-overview glass-card animate-fade-up">
      <h2 className="score-overview__title">Overview</h2>
      <div className="score-overview__bars">
        {valid.map((r, i) => {
          const score = r.match_score ?? 0;
          const isBest = r === best;
          const color = score >= 75 ? "var(--accent-green)" : score >= 50 ? "var(--accent-yellow)" : "var(--accent-red)";
          return (
            <div key={i} className="score-bar-row">
              <span className="score-bar-label">
                Job Description {r.jd_index + 1}
                {isBest && <span className="best-badge">Best Match</span>}
              </span>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{
                    width: `${score}%`,
                    background: color,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              </div>
              <span className="score-bar-value" style={{ color }}>{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatcherSkeleton() {
  return (
    <div className="results animate-fade">
      <div className="jd-result-card glass-card">
        <div className="jd-result-card__score-row">
          <div className="skeleton" style={{ width: "140px", height: "140px", borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="skeleton" style={{ width: "120px", height: "20px", borderRadius: "6px" }} />
            <div className="skeleton" style={{ width: "100%", height: "16px", borderRadius: "6px" }} />
            <div className="skeleton" style={{ width: "80%", height: "16px", borderRadius: "6px" }} />
          </div>
        </div>
        <hr className="divider" />
        <div className="skills-grid">
          <div className="skills-panel">
            <div className="skeleton" style={{ width: "100px", height: "18px", marginBottom: "16px", borderRadius: "6px" }} />
            <div className="flex-wrap">
              {[80, 105, 90, 70, 95].map((w, i) => (
                <div key={i} className="skeleton" style={{ width: `${w}px`, height: "26px", borderRadius: "99px" }} />
              ))}
            </div>
          </div>
          <div className="skills-panel">
            <div className="skeleton" style={{ width: "100px", height: "18px", marginBottom: "16px", borderRadius: "6px" }} />
            <div className="flex-wrap">
              {[95, 115, 85, 100, 75, 110].map((w, i) => (
                <div key={i} className="skeleton" style={{ width: `${w}px`, height: "26px", borderRadius: "99px" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MatcherPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jds, setJds] = useState<string[]>(() => sessionCache?.jdTexts ?? [""]);
  const [jdFiles, setJdFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SingleMatchResult[] | null>(() => sessionCache?.results ?? null);
  const [activeTab, setActiveTab] = useState(0);

  const hasTextJd = jds.some((j) => j.trim().length > 0);
  const canSubmit = file !== null && (hasTextJd || jdFiles.length > 0) && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setActiveTab(0);

    const form = new FormData();
    form.append("resume", file);
    form.append("jd_texts", JSON.stringify(jds.filter((j) => j.trim())));
    jdFiles.forEach((f) => form.append("jd_files", f, f.name));

    try {
      const res = await fetch("/api/match", { method: "POST", body: form });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server connection error (${res.status}). Please try again in a moment.`);
      }
      if (!res.ok) throw new Error((data as { detail?: string })?.detail ?? `Request failed (${res.status})`);
      const next = (data as MatchResponse).results;
      sessionCache = { jdTexts: jds.filter((j) => j.trim()), results: next };
      setResults(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const addJd = () => setJds([...jds, ""]);
  const addJdFile = (f: File) => setJdFiles((prev) => [...prev, f]);
  const removeJdFile = (idx: number) => setJdFiles((prev) => prev.filter((_, i) => i !== idx));

  return (
    <main className="page matcher-page-container">
      {/* ── Hero Section (Header + 3D Graphic Stack) ────────────────────── */}
      <div className="matcher-hero">
        <div className="matcher-hero__left">
          <h1 className="hero-title">
            Resume <span className="title-gradient-purple-green">Matcher</span>
          </h1>

          <p className="hero-subtitle">
            Upload a resume PDF and benchmark it against target positions.
            Our RAG engine extracts technical skills, identifies missing
            requirements, and outputs independent compatibility scores for
            every job description.
          </p>

          <div className="feature-cards-row">
            <div className="feature-card">
              <span className="feature-card__icon">
                <TargetIcon color="var(--accent-purple)" size={18} />
              </span>
              <div>
                <div className="feature-card__title">Multi-Job Description Scoring</div>
                <div className="feature-card__sub">Compare across roles</div>
              </div>
            </div>

            <div className="feature-card">
              <span className="feature-card__icon">
                <SearchIcon color="var(--accent-blue)" size={18} />
              </span>
              <div>
                <div className="feature-card__title">Skill Gap Analysis</div>
                <div className="feature-card__sub">Find what's missing</div>
              </div>
            </div>

            <div className="feature-card">
              <span className="feature-card__icon">
                <ZapIcon color="var(--accent-yellow)" size={18} />
              </span>
              <div>
                <div className="feature-card__title">Hybrid Vector RAG</div>
                <div className="feature-card__sub">Smarter & more accurate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Right 3D PDF Document Graphic Stack */}
        <div className="matcher-hero__right">
          <div className="hero-pdf-card">
            <div className="hero-pdf-badge">PDF</div>
            <div className="hero-pdf-lines">
              <div className="pdf-line line-1" />
              <div className="pdf-line line-2" />
              <div className="pdf-line line-3" />
            </div>
            {/* Glowing floating upload icon */}
            <div className="hero-pdf-upload-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Step-by-Step Card Container ─────────────────────────── */}
      <form onSubmit={handleSubmit} className="matcher-card-form glass-card">
        {/* Step 1 */}
        <div className="form-step-section">
          <div className="step-header-group">
            <div className="step-header">
              <span className="step-number">1</span>
              <span className="step-title">Upload your resume</span>
            </div>
            <p className="step-subtitle">
              Upload a PDF resume for skill extraction and contextual matching.
            </p>
          </div>

          <div className="matcher-step1-grid">
            {/* Left: Dropzone */}
            <div className="dropzone-col">
              <FileUpload onFile={setFile} currentFile={file} onClear={() => setFile(null)} />
            </div>

            {/* Right: What happens next? */}
            <div className="what-next-panel glass-card">
              <div className="what-next__title">
                <ShieldIcon color="var(--accent-blue)" size={16} />
                <span>What happens next?</span>
              </div>

              <div className="what-next__steps">
                <div className="what-next-step">
                  <div className="what-next-step__icon what-next-step__icon--purple">
                    <FileTextIcon color="var(--accent-purple)" size={16} />
                  </div>
                  <div className="what-next-step__text">
                    <div className="step-card-title">We extract and parse</div>
                    <div className="step-card-sub">skills, experience & context</div>
                  </div>
                </div>

                <div className="what-next-step">
                  <div className="what-next-step__icon what-next-step__icon--green">
                    <BarChartIcon color="var(--accent-green)" size={16} />
                  </div>
                  <div className="what-next-step__text">
                    <div className="step-card-title">Match against target</div>
                    <div className="step-card-sub">job descriptions</div>
                  </div>
                </div>

                <div className="what-next-step">
                  <div className="what-next-step__icon what-next-step__icon--yellow">
                    <TrendingUpIcon color="var(--accent-yellow)" size={16} />
                  </div>
                  <div className="what-next-step__text">
                    <div className="step-card-title">Get compatibility scores</div>
                    <div className="step-card-sub">and skill gap insights</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="form-step-section">
          <div className="step-header-group">
            <div className="step-header">
              <span className="step-number">2</span>
              <span className="step-title">Add job descriptions</span>
            </div>
            <p className="step-subtitle">
              Paste one or more job descriptions — or upload them as PDFs — to compare against your resume.
            </p>
          </div>

          <JdEditor jds={jds} onChange={setJds} />

          <div className="jd-pdf-upload">
            <div className="jd-pdf-upload__header">
              <span className="jd-pdf-upload__title">Upload JD as PDF</span>
              <span className="jd-pdf-upload__hint">Optional · multiple files supported</span>
            </div>

            <label className="jd-pdf-dropzone" htmlFor="input-jd-pdf">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 12 15 15"/>
              </svg>
              <span>Click to browse JD PDFs</span>
              <input
                id="input-jd-pdf"
                type="file"
                accept="application/pdf"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  files.forEach(addJdFile);
                  e.target.value = "";
                }}
              />
            </label>

            {jdFiles.length > 0 && (
              <div className="jd-pdf-list">
                {jdFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="jd-pdf-item animate-fade">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="jd-pdf-item__name">{f.name}</span>
                    <span className="jd-pdf-item__size">{(f.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      className="jd-pdf-item__remove"
                      onClick={() => removeJdFile(i)}
                      aria-label={`Remove ${f.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-banner animate-fade" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Footer Row inside Card */}
        <div className="matcher-card-footer">
          <button
            type="button"
            className="btn btn-secondary add-jd-btn"
            onClick={addJd}
            id="btn-add-jd-footer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Another Job Description
          </button>

          <button
            type="submit"
            className="btn btn-primary submit-btn hero-submit-btn"
            disabled={!canSubmit}
            id="btn-analyze-match"
          >
            {loading ? (
              <>
                <Spinner size={18} label="" />
                Analysing…
              </>
            ) : (
              <>
                Analyse Match
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading Skeleton */}
      {loading && <MatcherSkeleton />}

      {/* Results */}
      {results && !loading && (
        <div className="results animate-fade-up">
          <ScoreOverview results={results} />

          {results.length > 1 && (
            <div className="result-tabs" role="tablist">
              {results.map((r, i) => {
                const score = r.match_score;
                const color =
                  score == null ? "var(--text-muted)"
                  : score >= 75  ? "var(--accent-green)"
                  : score >= 50  ? "var(--accent-yellow)"
                  : "var(--accent-red)";
                return (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={activeTab === i}
                    className={`result-tab ${activeTab === i ? "result-tab--active" : ""}`}
                    onClick={() => setActiveTab(i)}
                    id={`tab-jd-${i}`}
                  >
                    Job Description {i + 1}
                    {score != null && (
                      <span className="result-tab__score" style={{ color }}>{score}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <JdResultCard
            key={activeTab}
            result={results[activeTab]}
            index={activeTab}
          />
        </div>
      )}
      <DatasetDisclaimer />
    </main>
  );
}

