import { useState } from "react";
import SkillBadge from "../components/SkillBadge";
import Spinner from "../components/Spinner";
import {
  BarChartIcon, BrainIcon, CodeIcon, CloudIcon, BriefcaseIcon, TerminalIcon,
  ZapIcon, ScaleIcon, SearchIcon,
} from "../components/icons";
import DatasetDisclaimer from "../components/DatasetDisclaimer";
import "./ExplorerPage.css";

interface ExploreResult {
  role: string;
  found_data?: boolean;
  required_skills: string[];
  nice_to_have_skills: string[];
  summary: string;
}

const EXAMPLE_ROLES = [
  { label: "Data Analyst", icon: <BarChartIcon color="var(--accent-blue)" size={16} /> },
  { label: "Machine Learning Engineer", icon: <BrainIcon color="var(--accent-purple)" /> },
  { label: "Software Development Engineer", icon: <CodeIcon color="var(--accent-green)" /> },
  { label: "DevOps Engineer", icon: <CloudIcon color="var(--accent-blue)" /> },
  { label: "Product Manager", icon: <BriefcaseIcon color="var(--accent-yellow)" /> },
  { label: "Frontend Developer", icon: <TerminalIcon color="var(--accent-purple)" /> },
];

const PRESETS = [
  {
    id: "fast",
    label: "Fast",
    icon: <ZapIcon color="var(--accent-green)" size={18} />,
    topK: 3,
    desc: "Quick scan for core requirements",
    time: "~2–4s",
    variant: "green",
  },
  {
    id: "balanced",
    label: "Balanced",
    icon: <ScaleIcon color="var(--accent-purple)" size={18} />,
    topK: 5,
    desc: "Optimal skill coverage & speed",
    time: "~3–6s",
    variant: "purple",
  },
  {
    id: "comprehensive",
    label: "Comprehensive",
    icon: <SearchIcon color="var(--accent-blue)" size={18} />,
    topK: 10,
    desc: "Deep dive into full tech stacks",
    time: "~8–15s",
    variant: "blue",
  },
];

function ExplorerSkeleton() {
  return (
    <div className="explorer-results animate-fade">
      <div className="glass-card explorer-summary">
        <div className="explorer-summary__role">
          <div className="skeleton" style={{ width: "130px", height: "30px", borderRadius: "99px" }} />
        </div>
        <div className="skeleton" style={{ width: "100%", height: "16px", marginBottom: "8px", borderRadius: "6px" }} />
        <div className="skeleton" style={{ width: "78%", height: "16px", borderRadius: "6px" }} />
      </div>

      <div className="skills-grid">
        <div className="glass-card skills-panel">
          <div className="skeleton" style={{ width: "120px", height: "20px", marginBottom: "20px", borderRadius: "6px" }} />
          <div className="flex-wrap">
            {[85, 110, 95, 75, 105, 90].map((w, i) => (
              <div key={i} className="skeleton" style={{ width: `${w}px`, height: "28px", borderRadius: "99px" }} />
            ))}
          </div>
        </div>

        <div className="glass-card skills-panel">
          <div className="skeleton" style={{ width: "120px", height: "20px", marginBottom: "20px", borderRadius: "6px" }} />
          <div className="flex-wrap">
            {[95, 125, 80, 100, 115, 70, 105, 85].map((w, i) => (
              <div key={i} className="skeleton" style={{ width: `${w}px`, height: "28px", borderRadius: "99px" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  const [role, setRole] = useState("");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExploreResult | null>(null);

  const canSubmit = role.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role.trim(), top_k: topK }),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server connection error (${res.status}). Please try again in a moment.`);
      }
      if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
      setResult(data as ExploreResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page explorer-page-container">
      {/* ── Hero Section (Header + Graphic Stack) ────────────────────── */}
      <div className="explorer-hero">
        <div className="explorer-hero__left">
          <h1 className="hero-title">
            Role <span className="title-gradient-purple">Skill</span>{" "}
            <span className="title-gradient-cyan">Explorer</span>
          </h1>

          <p className="hero-subtitle">
            Search across our vector database of real job postings to synthesise
            core technical requirements, tooling expectations, and nice-to-have
            skills for any engineering or tech position.
          </p>

          <div className="feature-cards-row">
            <div className="feature-card">
              <span className="feature-card__icon">
                <BarChartIcon color="var(--accent-blue)" size={18} />
              </span>
              <div>
                <div className="feature-card__title">Market Job Data</div>
                <div className="feature-card__sub">Real job postings</div>
              </div>
            </div>

            <div className="feature-card">
              <span className="feature-card__icon">
                <CodeIcon color="var(--accent-purple)" size={18} />
              </span>
              <div>
                <div className="feature-card__title">Tech Stack Analysis</div>
                <div className="feature-card__sub">Skills & tools insights</div>
              </div>
            </div>

            <div className="feature-card">
              <span className="feature-card__icon">
                <ZapIcon color="var(--accent-yellow)" size={18} />
              </span>
              <div>
                <div className="feature-card__title">Customizable Search</div>
                <div className="feature-card__sub">Depth & focus control</div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Right Hero Graphic Stack */}
        <div className="explorer-hero__right">
          {/* Glass Search Lens 3D Badge */}
          <div className="hero-lens-card">
            <div className="hero-lens-card__inner">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="hero-lens-icon">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Top Skills Analytics Card */}
          <div className="hero-skills-widget glass-card">
            <div className="hero-widget__title">Top Skills</div>
            <div className="hero-skills-list">
              {[
                { name: "Python", pct: "92%", color: "var(--accent-purple)" },
                { name: "SQL", pct: "78%", color: "var(--accent-blue)" },
                { name: "AWS", pct: "70%", color: "var(--accent-blue)" },
                { name: "Docker", pct: "58%", color: "var(--accent-green)" },
                { name: "Kubernetes", pct: "42%", color: "var(--accent-green)" },
              ].map((item) => (
                <div key={item.name} className="hero-skill-row">
                  <span className="hero-skill-name">{item.name}</span>
                  <div className="hero-skill-bar-track">
                    <div
                      className="hero-skill-bar-fill"
                      style={{ width: item.pct, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market Demand Area Graph Card */}
          <div className="hero-demand-widget glass-card">
            <div className="hero-widget__title">Market Demand</div>
            <svg viewBox="0 0 200 45" className="hero-demand-graph">
              <defs>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 35 Q 25 15, 50 28 T 100 12 T 150 24 T 200 10 L 200 45 L 0 45 Z"
                fill="url(#demandGrad)"
              />
              <path
                d="M 0 35 Q 25 15, 50 28 T 100 12 T 150 24 T 200 10"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Main Step-by-Step Card Container ─────────────────────────── */}
      <form onSubmit={handleSubmit} className="explorer-card-form glass-card">
        {/* Step 1 */}
        <div className="form-step-section">
          <div className="step-header">
            <span className="step-number">1</span>
            <span className="step-title">Select or type your job role</span>
          </div>

          {/* Role Chip Buttons with Icons */}
          <div className="role-chips">
            {EXAMPLE_ROLES.map((r) => (
              <button
                key={r.label}
                type="button"
                className={`role-chip ${role === r.label ? "role-chip--active" : ""}`}
                onClick={() => setRole(r.label)}
                id={`chip-${r.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className="role-chip__icon">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Search Input with Icons */}
          <div className="search-input-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-input-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="input-role"
              type="text"
              className="input search-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Machine Learning Operations Engineer, Product Designer…"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Step 2 */}
        <div className="form-step-section">
          <div className="step-header">
            <span className="step-number">2</span>
            <span className="step-title">Choose search depth</span>
          </div>

          <div className="preset-grid">
            {PRESETS.map((preset) => {
              const isActive = topK === preset.topK;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-card preset-card--${preset.variant} ${
                    isActive ? "preset-card--active" : ""
                  }`}
                  onClick={() => setTopK(preset.topK)}
                  id={`preset-${preset.id}`}
                >
                  {/* Top Checkmark when active */}
                  {isActive && (
                    <div className="preset-card__checkmark">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}

                  <div className="preset-card__content">
                    <div className={`preset-card__icon-wrap preset-card__icon-wrap--${preset.variant}`}>
                      <span className="preset-card__icon">{preset.icon}</span>
                    </div>

                    <div className="preset-card__text">
                      <div className="preset-card__title">{preset.label}</div>
                      <p className="preset-card__desc">{preset.desc}</p>
                    </div>
                  </div>

                  {/* Time pill */}
                  <span className="preset-card__time">{preset.time}</span>
                </button>
              );
            })}
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
        <div className="explorer-card-footer">
          <div className="security-notice">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="security-icon">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>The timing of each run is influenced by the size of the dataset and may not be exact.</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary submit-btn hero-submit-btn"
            disabled={!canSubmit}
            id="btn-explore-role"
          >
            {loading ? (
              <>
                <Spinner size={18} label="" />
                Exploring…
              </>
            ) : (
              <>
                Explore Role
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
      {loading && <ExplorerSkeleton />}

      {/* Results */}
      {result && !loading && (
        result.found_data === false || (result.required_skills.length === 0 && result.nice_to_have_skills.length === 0) ? (
          <div className="explorer-results animate-fade-up">
            <div className="glass-card explorer-summary error-card" style={{ padding: "28px 32px" }}>
              <div className="explorer-summary__role" style={{ marginBottom: "8px" }}>
                <span className="role-chip-lg" style={{ borderColor: "rgba(251, 191, 36, 0.4)", background: "rgba(251, 191, 36, 0.12)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  No Matching Data
                </span>
              </div>
              <p className="summary-text" style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "1rem" }}>
                No job description data found in the database for <em>"{result.role}"</em>.
              </p>
              <p className="summary-text" style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Please select or search for a standard tech role (e.g. <strong>Data Analyst</strong>, <strong>Machine Learning Engineer</strong>, <strong>Software Development Engineer</strong>, <strong>DevOps Engineer</strong>, <strong>Product Manager</strong>, or <strong>Frontend Developer</strong>).
              </p>
            </div>
          </div>
        ) : (
          <div className="explorer-results animate-fade-up">
            {/* Summary header */}
            <div className="glass-card explorer-summary">
              <div className="explorer-summary__role">
                <span className="role-chip-lg">
                  {(() => {
                    const match = EXAMPLE_ROLES.find(
                      (r) => r.label.toLowerCase() === result.role.trim().toLowerCase()
                    );
                    return match ? (
                      <span className="role-chip-lg__icon">{match.icon}</span>
                    ) : null;
                  })()}
                  {result.role}
                </span>
              </div>
              <p className="summary-text">{result.summary}</p>
            </div>

            <div className="skills-grid">
              {/* Required skills */}
              <div className="glass-card skills-panel">
                <h3 className="skills-panel__title skills-panel__title--blue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Required Skills
                  <span className="skills-count">{result.required_skills.length}</span>
                </h3>
                <div className="flex-wrap">
                  {result.required_skills.map((s, i) => (
                    <SkillBadge key={s} label={s} variant="blue" delay={i * 35} />
                  ))}
                </div>
              </div>

              {/* Nice-to-have skills */}
              <div className="glass-card skills-panel">
                <h3 className="skills-panel__title skills-panel__title--yellow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Nice to Have
                  <span className="skills-count">{result.nice_to_have_skills.length}</span>
                </h3>
                <div className="flex-wrap">
                  {result.nice_to_have_skills.map((s, i) => (
                    <SkillBadge key={s} label={s} variant="yellow" delay={i * 35} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      )}
      <DatasetDisclaimer />
    </main>
  );
}

