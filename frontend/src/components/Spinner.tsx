import "./Spinner.css";

interface Props {
  size?: number;
  label?: string;
}

export default function Spinner({ size = 28, label = "Loading…" }: Props) {
  return (
    <div className="spinner-wrap" role="status" aria-label={label}>
      <svg
        className="spinner"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12" cy="12" r="10"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="3"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="url(#spinner-grad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="spinner-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8"/>
            <stop offset="100%" stopColor="#22d3a5"/>
          </linearGradient>
        </defs>
      </svg>
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
}
