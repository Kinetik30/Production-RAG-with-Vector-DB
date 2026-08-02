import { useEffect, useRef, useState } from "react";
import "./ScoreMeter.css";

interface Props {
  score: number; // 0-100
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#22d3a5";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Fair Match";
  return "Poor Match";
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 339.3

export default function ScoreMeter({ score }: Props) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number>(0);
  const color = getScoreColor(score);
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  // Animate displayed number
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(ease * score));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  return (
    <div className="score-meter" aria-label={`Match score: ${score} out of 100`}>
      <svg className="score-ring" viewBox="0 0 120 120" width="180" height="180">
        {/* Track */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        {/* Fill — animated via CSS */}
        <circle
          className="score-ring__fill"
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ "--target-offset": offset } as React.CSSProperties}
        />
      </svg>
      <div className="score-meter__center">
        <span className="score-meter__number" style={{ color }}>
          {displayed}
        </span>
        <span className="score-meter__unit">/100</span>
        <span className="score-meter__label" style={{ color }}>
          {getScoreLabel(score)}
        </span>
      </div>
    </div>
  );
}
