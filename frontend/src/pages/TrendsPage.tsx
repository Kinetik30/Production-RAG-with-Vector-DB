import { useState, useEffect } from "react";
import {
  ALL_ROLES,
  type RoleTrendsData,
} from "../data/trendsData";
import CustomSelect from "../components/CustomSelect";
import Spinner from "../components/Spinner";
import DatasetDisclaimer from "../components/DatasetDisclaimer";
import "./TrendsPage.css";



const cache = new Map<string, RoleTrendsData>();

const SKILL_EXP_COLORS = [
  "#8b5cf6", "#3b82f6", "#22c55e", "#f97316", "#06b6d4", "#ec4899",
];

function salaryLine1(name: string): string {
  const words = name.split(" ");
  if (words.length <= 1) return name;
  const half = Math.ceil(words.length / 2);
  return words.slice(0, half).join(" ");
}

function salaryLine2(name: string): string {
  const words = name.split(" ");
  if (words.length <= 1) return "";
  const half = Math.ceil(words.length / 2);
  return words.slice(half).join(" ");
}

export default function TrendsPage() {
  const [selectedRole, setSelectedRole] = useState("Data Engineer");
  const [hoveredPoint, setHoveredPoint] = useState<{ skill: string; month: string; val: number; color: string; x: number; y: number } | null>(null);

  const [data, setData] = useState<RoleTrendsData | null>(() => cache.get("Data Engineer") ?? null);
  const [loading, setLoading] = useState(!cache.has("Data Engineer"));
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(selectedRole)) {
      setData(cache.get(selectedRole)!);
      setLoading(false);
      setFetchError(null);
      return;
    }
    let isMounted = true;
    setLoading(true);
    setFetchError(null);
    async function fetchTrends() {
      try {
        const res = await fetch("/api/trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: selectedRole, time_range: "Last Year" }),
        });
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        const resData = await res.json();
        if (isMounted && resData && resData.role) {
          cache.set(selectedRole, resData as RoleTrendsData);
          setData(resData as RoleTrendsData);
        }
      } catch (err: unknown) {
        if (isMounted) setFetchError(err instanceof Error ? err.message : "Failed to load trends");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchTrends();
    return () => { isMounted = false; };
  }, [selectedRole]);


  // ── Derived chart helpers ────────────────────────────────────────
  // Compute a clean Y-axis ceiling for the demand-over-time chart
  const lineChartMax = (() => {
    if (!data) return 30;
    const allVals = data.demandOverTime.flatMap((s) => s.data);
    const rawMax = Math.max(...allVals, 1);
    // Round up to the nearest multiple of 5, minimum 10
    return Math.max(10, Math.ceil(rawMax / 5) * 5);
  })();

  // Y-axis tick labels for the line chart (4 evenly-spaced ticks)
  const lineChartTicks = [0, 1, 2, 3].map((i) => Math.round((lineChartMax / 3) * i));

  // Dynamic salary Y-axis — scale to actual data, rounded up to nearest 10
  const salaryMax = (() => {
    if (!data) return 80;
    const rawMax = Math.max(...data.salaryDistribution.map((d) => d.maxLpa), 1);
    return Math.max(50, Math.ceil(rawMax / 10) * 10);
  })();
  const salaryTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(salaryMax * f));

  // Dynamic column width so all roles fit inside a fixed 560 viewBox
  const SALARY_VB_W = 560;
  const SALARY_LEFT_PAD = 30; // room for Y-axis labels
  const SALARY_RIGHT_PAD = 12;
  const salaryColW = data
    ? (SALARY_VB_W - SALARY_LEFT_PAD - SALARY_RIGHT_PAD) / data.salaryDistribution.length
    : 90;

  return (
    <main className="page trends-page-container">
      {/* ── Top Header Controls Row ─────────────────────────────────── */}
      <header className="trends-header">
        <div className="trends-header__left">
          <h1 className="trends-header__title">Dash<span className="title-gradient-purple-green">board</span></h1>
          <p className="trends-header__sub">Real-time skill insights and market trends</p>
        </div>

        <div className="trends-header__controls">
          <CustomSelect
            label="Role"
            options={ALL_ROLES}
            value={selectedRole}
            onChange={setSelectedRole}
          />
        </div>
      </header>

      {/* ── Loading / Error States ───────────────────────────────────── */}
      {loading && (
        <div className="trends-loading-overlay">
          <Spinner size={36} label="" />
          <p className="trends-loading-text">Analysing job posting data…</p>
        </div>
      )}

      {fetchError && !loading && (
        <div className="error-banner animate-fade" role="alert" style={{ margin: "24px 0" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {fetchError}
        </div>
      )}

      {/* ── Dashboard Main Grid ─────────────────────────────────────── */}
      {data && !loading && <div className="trends-grid">
        {/* Real Market Statistics Cards (Top Row - 4 x 3 Cols) */}
        <section className="stat-card grid-col-3 stat-card--purple">
          <div className="stat-card__top">
            <div className="stat-card__icon-wrapper stat-card__icon-wrapper--purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <span className="stat-card__badge stat-card__badge--purple">Market Leader</span>
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Most Posted Role</span>
            <h3 className="stat-card__value">{data.marketStats?.mostPostedRole?.name ?? "Management"}</h3>
          </div>
          <div className="stat-card__footer">
            <span className="stat-card__sub-highlight">
              {(data.marketStats?.mostPostedRole?.count ?? 27696).toLocaleString()} Postings
            </span>
            <span className="stat-card__sub-muted">
              ({data.marketStats?.mostPostedRole?.pct ?? 14.4}% share)
            </span>
          </div>
        </section>

        <section className="stat-card grid-col-3 stat-card--emerald">
          <div className="stat-card__top">
            <div className="stat-card__icon-wrapper stat-card__icon-wrapper--emerald">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12" />
                <path d="M6 8h12" />
                <path d="M6 13h6a4 4 0 0 0 0-8H6" />
                <path d="M6 13l9 9" />
              </svg>
            </div>

            <span className="stat-card__badge stat-card__badge--emerald">Top Salary</span>
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Highest Paid Role</span>
            <h3 className="stat-card__value">{data.marketStats?.highestPaidRole?.name ?? "Cybersecurity"}</h3>
          </div>
          <div className="stat-card__footer">
            <span className="stat-card__sub-highlight stat-card__sub-highlight--emerald">
              {data.marketStats?.highestPaidRole?.medianLpa ?? 70.2} LPA
            </span>
            <span className="stat-card__sub-muted">Median Package</span>
          </div>
        </section>

        <section className="stat-card grid-col-3 stat-card--cyan">
          <div className="stat-card__top">
            <div className="stat-card__icon-wrapper stat-card__icon-wrapper--cyan">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <span className="stat-card__badge stat-card__badge--cyan">High Demand</span>
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Top Market Skill</span>
            <h3 className="stat-card__value">{data.marketStats?.topSkill?.name ?? "TypeScript"}</h3>
          </div>
          <div className="stat-card__footer">
            <span className="stat-card__sub-highlight">
              {(data.marketStats?.topSkill?.count ?? 10966).toLocaleString()} Mentions
            </span>
            <span className="stat-card__sub-muted">Across DB</span>
          </div>
        </section>

        <section className="stat-card grid-col-3 stat-card--amber">
          <div className="stat-card__top">
            <div className="stat-card__icon-wrapper stat-card__icon-wrapper--amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M21 19c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              </svg>
            </div>
            <span className="stat-card__badge stat-card__badge--amber">Live DB</span>
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Analyzed Postings</span>
            <h3 className="stat-card__value">{(data.marketStats?.totalDatabaseJds ?? 192458).toLocaleString()}</h3>
          </div>
          <div className="stat-card__footer">
            <span className="stat-card__sub-highlight">
              {(data.marketStats?.selectedRoleStats?.count ?? 1740).toLocaleString()} Postings
            </span>
            <span className="stat-card__sub-muted">for {selectedRole}</span>
          </div>
        </section>

        {/* Card 1: Skill Demand Over Time (Middle Left - 7 Cols) */}
        <section className="trend-card grid-col-7">
          <div className="trend-card__header">
            <div className="trend-card__title-group">
              <h2 className="trend-card__title">
                Skill demand over time
              </h2>
              <p className="trend-card__sub">% of job postings mentioning the skill</p>
            </div>
          </div>

          {/* Legend row */}
          <div className="legend-row">
            {data.demandOverTime.map((item) => (
              <span key={item.skill} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: item.color }} />
                {item.skill}
              </span>
            ))}
          </div>

          {/* Multi-line SVG chart */}
          <div className="svg-container">
            <svg className="svg-chart" viewBox="0 0 600 200" preserveAspectRatio="none">
              {/* Y Grid lines — dynamic scale */}
              {lineChartTicks.map((tickVal, idx) => {
                const y = 160 - (tickVal / lineChartMax) * 150;
                return (
                  <g key={idx}>
                    <line x1="30" y1={y + 10} x2="590" y2={y + 10} stroke="var(--border-color)" strokeDasharray="3 3" opacity="0.6" />
                    <text x="0" y={y + 14} fill="var(--text-tertiary, #94a3b8)" fontSize="10" fontWeight="500">{tickVal}%</text>
                  </g>
                );
              })}

              {/* Vertical Crosshair Guide Line when hovered */}
              {hoveredPoint && (
                <line
                  x1={hoveredPoint.x}
                  y1="10"
                  x2={hoveredPoint.x}
                  y2="160"
                  stroke={hoveredPoint.color}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
              )}

              {/* Skill SVG Paths */}
              {data.demandOverTime.map((series) => {
                // Map values 0..30 to Y coords 160..10
                const points = series.data.map((val, i) => {
                  const x = 40 + i * (540 / (series.data.length - 1));
                  const y = 160 - (val / lineChartMax) * 150;
                  return { x, y, val };
                });

                const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                return (
                  <g key={series.skill}>
                    <path d={pathD} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" />
                    {points.map((p, i) => {
                      const isHovered = hoveredPoint?.skill === series.skill && hoveredPoint?.x === p.x;
                      return (
                        <g key={i}>
                          {/* Visible Dot */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? "6" : "3.5"}
                            fill={series.color}
                            stroke={isHovered ? "#ffffff" : "var(--bg-card)"}
                            strokeWidth={isHovered ? "2.5" : "1.5"}
                            style={{ transition: "all 0.15s ease", cursor: "pointer" }}
                          />
                          {/* Generous 28px Invisible Hit Target so mouse doesn't flicker/vanish */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="14"
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() =>
                              setHoveredPoint({
                                skill: series.skill,
                                month: data.months[i],
                                val: p.val,
                                color: series.color,
                                x: p.x,
                                y: p.y,
                              })
                            }
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* X Axis Month Labels */}
              {data.months.map((m, i) => {
                const x = 40 + i * (540 / (data.months.length - 1));
                return (
                  <text key={m} x={x} y="192" fill="var(--text-tertiary, #94a3b8)" fontSize="9.5" textAnchor="middle" fontWeight="500">
                    {m}
                  </text>
                );
              })}
            </svg>

            {/* Smooth Floating Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="chart-tooltip-badge animate-fade-in-scale"
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "16px",
                  background: "var(--bg-card)",
                  border: `1px solid ${hoveredPoint.color}`,
                  borderRadius: "10px",
                  padding: "8px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  pointerEvents: "none",
                  zIndex: 20,
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: hoveredPoint.color,
                    display: "inline-block",
                    boxShadow: `0 0 8px ${hoveredPoint.color}`,
                  }}
                />
                <span>
                  <strong>{hoveredPoint.skill}</strong> ({hoveredPoint.month}):{" "}
                  <span style={{ color: hoveredPoint.color, fontWeight: 700 }}>
                    {hoveredPoint.val}%
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Card 2: Top Skills for Role (Middle Right - 5 Cols) */}
        <section className="trend-card grid-col-5">
          <div className="trend-card__header">
            <div className="trend-card__title-group">
              <h2 className="trend-card__title">
                Top skills for {selectedRole}
              </h2>
            </div>
          </div>

          <div className="bar-chart-list">
            {data.topSkills.map((item) => (
              <div key={item.skill} className="bar-row">
                <span className="bar-skill-name" title={item.skill}>{item.skill}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${item.percentage}%` }} />
                </div>
                <span className="bar-pct-label">{item.percentage}%</span>
              </div>
            ))}
          </div>

          <div className="bar-chart-axis">
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
            <span>60%</span>
            <span>80%</span>
          </div>
        </section>

        {/* Card 7: Postings by Required Experience */}
        <section className="trend-card grid-col-12">
          <div className="trend-card__header">
            <div className="trend-card__title-group">
              <h2 className="trend-card__title">
                Postings by required experience
              </h2>
              <p className="trend-card__sub">% of {selectedRole} postings within each experience band</p>
            </div>
          </div>

          <div className="exp-chart-list">
            {(data.experienceDistribution ?? []).map((band, idx) => {
              const color = SKILL_EXP_COLORS[idx % SKILL_EXP_COLORS.length];
              return (
                <div key={band.band} className="exp-row">
                  <span className="exp-band-name">{band.band}</span>
                  <div className="exp-bar-track">
                    <div
                      className="exp-bar-fill"
                      style={{
                        width: `${band.percentage}%`,
                        background: color,
                        animationDelay: `${idx * 60}ms`,
                      }}
                    />
                  </div>
                  <span className="exp-bar-label">{band.count.toLocaleString()}</span>
                  <span className="exp-pct-label">{band.percentage}%</span>
                </div>
              );
            })}
          </div>

          <div className="bar-chart-axis">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </section>




        {/* Card 5: Role / Salary Distribution (Bottom Left - 6 Cols) */}
        <section className="trend-card grid-col-6">
          <div className="trend-card__header">
            <div className="trend-card__title-group">
              <h2 className="trend-card__title">
                Role / Salary distribution
              </h2>
              <p className="trend-card__sub">Annual salary (INR LPA)</p>
            </div>
          </div>

          <div className="salary-chart-container">
            <svg width="100%" height="230" viewBox={`0 0 ${SALARY_VB_W} 210`}>
              {/* Dynamic Y-axis grid lines */}
              {salaryTicks.map((lpa) => {
                const y = 172 - (lpa / salaryMax) * 155;
                return (
                  <g key={lpa}>
                    <line x1={SALARY_LEFT_PAD} y1={y} x2={SALARY_VB_W - SALARY_RIGHT_PAD} y2={y}
                      stroke="var(--border-color)" strokeDasharray="3 3" opacity="0.6" />
                    <text x="0" y={y + 4} fill="var(--text-tertiary, #94a3b8)" fontSize="9.5">{lpa}</text>
                  </g>
                );
              })}

              {/* Box plots — one per role, evenly spaced */}
              {data.salaryDistribution.map((item, idx) => {
                // Centre of this column
                const cx = SALARY_LEFT_PAD + salaryColW * idx + salaryColW / 2;
                const toY = (v: number) => 172 - (v / salaryMax) * 155;

                const minY = toY(item.minLpa);
                const q1Y  = toY(item.q1Lpa);
                const medY = toY(item.medianLpa);
                const q3Y  = toY(item.q3Lpa);
                const maxY = toY(item.maxLpa);

                const halfBox = Math.min(salaryColW * 0.28, 18);
                // Badge sits just above top whisker, never higher than y=4
                const badgeY = Math.max(maxY - 30, 4);
                const badgeW = Math.min(salaryColW * 0.85, 72);

                return (
                  <g key={`salary-${item.role}-${idx}`}>
                    {/* Whisker */}
                    <line x1={cx} y1={minY} x2={cx} y2={maxY} stroke="#a855f7" strokeWidth="1.5" />
                    <line x1={cx - 6} y1={minY} x2={cx + 6} y2={minY} stroke="#a855f7" strokeWidth="1.5" />
                    <line x1={cx - 6} y1={maxY} x2={cx + 6} y2={maxY} stroke="#a855f7" strokeWidth="1.5" />

                    {/* IQR Box */}
                    <rect
                      x={cx - halfBox} y={q3Y}
                      width={halfBox * 2} height={Math.max(q1Y - q3Y, 4)}
                      fill="rgba(168,85,247,0.22)" stroke="#a855f7" strokeWidth="1.5" rx="3"
                    />

                    {/* Median line */}
                    <line x1={cx - halfBox} y1={medY} x2={cx + halfBox} y2={medY}
                      stroke="#c084fc" strokeWidth="2.5" />

                    {/* Floating median badge */}
                    <g>
                      <rect x={cx - badgeW / 2} y={badgeY} width={badgeW} height={22}
                        rx="5" fill="var(--bg-card)" stroke="rgba(168,85,247,0.45)" strokeWidth="1.2" />
                      <text x={cx} y={badgeY + 9} fill="var(--text-tertiary,#94a3b8)"
                        fontSize="7.5" textAnchor="middle" fontWeight="600">Median</text>
                      <text x={cx} y={badgeY + 19} fill="var(--text-primary)"
                        fontSize="9" textAnchor="middle" fontWeight="700">
                        {item.medianLpa.toFixed(1)} LPA
                      </text>
                    </g>

                    {/* X label */}
                    <text x={cx} y="199" fill="var(--text-secondary)" fontSize="7.5" textAnchor="middle" fontWeight="600">
                      {salaryLine1(item.role)}
                      {salaryLine2(item.role) && (
                        <tspan x={cx} dy="9">{salaryLine2(item.role)}</tspan>
                      )}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Card 6: Posting Volume by Role Over Time (Bottom Right - 6 Cols) */}
        <section className="trend-card grid-col-6">
          <div className="trend-card__header">
            <div className="trend-card__title-group">
              <h2 className="trend-card__title">
                Posting volume by role over time
              </h2>
            </div>
          </div>

          <div className="area-chart-container">
            <svg width="100%" height="220" viewBox="0 0 500 200" preserveAspectRatio="none">
              {/* Y axis Grid (0, 10K, 20K, 30K) */}
              {[0, 10, 20, 30].map((kVal) => {
                const y = 170 - (kVal / 30) * 150;
                return (
                  <g key={kVal}>
                    <line x1="30" y1={y} x2="490" y2={y} stroke="var(--border-color)" strokeDasharray="3 3" opacity="0.6" />
                    <text x="0" y={y + 4} fill="var(--text-tertiary, #94a3b8)" fontSize="10">{kVal === 0 ? "0" : `${kVal}K`}</text>
                  </g>
                );
              })}

              {/* Stacked Area Paths */}
              {(() => {
                // Stack values cumulative per month
                const numMonths = data.months.length;
                const cumData: number[][] = Array.from({ length: data.postingVolume.length }, () => []);

                for (let m = 0; m < numMonths; m++) {
                  let running = 0;
                  for (let r = 0; r < data.postingVolume.length; r++) {
                    running += data.postingVolume[r].data[m];
                    cumData[r][m] = running;
                  }
                }

                return data.postingVolume.map((vol, rIdx) => {
                  const upper = cumData[rIdx];
                  const lower = rIdx === 0 ? new Array(numMonths).fill(0) : cumData[rIdx - 1];

                  const upperPoints = upper.map((v, i) => {
                    const x = 35 + i * (450 / (numMonths - 1));
                    const y = 170 - (v / 30000) * 150;
                    return { x, y };
                  });

                  const lowerPoints = lower.map((v, i) => {
                    const x = 35 + i * (450 / (numMonths - 1));
                    const y = 170 - (v / 30000) * 150;
                    return { x, y };
                  }).reverse();

                  const pathD =
                    upperPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
                    " " +
                    lowerPoints.map((p) => `L ${p.x} ${p.y}`).join(" ") +
                    " Z";

                  return (
                    <path key={vol.role} d={pathD} fill={vol.color} opacity="0.75" />
                  );
                });
              })()}

              {/* X Axis Months */}
              {data.months.map((m, i) => {
                const x = 35 + i * (450 / (data.months.length - 1));
                return (
                  <text key={m} x={x} y="192" fill="var(--text-tertiary, #94a3b8)" fontSize="9" textAnchor="middle" fontWeight="500">
                    {m}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="legend-row" style={{ marginTop: "12px" }}>
            {data.postingVolume.map((vol) => (
              <span key={vol.role} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: vol.color }} />
                {vol.role}
              </span>
            ))}
          </div>
        </section>
      </div>}

      <DatasetDisclaimer />
    </main>
  );
}
