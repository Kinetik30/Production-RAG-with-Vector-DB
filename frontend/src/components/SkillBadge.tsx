interface Props {
  label: string;
  variant: "green" | "red" | "blue" | "yellow";
  delay?: number;
}

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export default function SkillBadge({ label, variant, delay = 0 }: Props) {
  return (
    <span
      className={`badge badge-${variant} badge-animated`}
      style={{ animationDelay: `${delay}ms` }}
      title={label}
    >
      {(variant === "green" || variant === "blue") && <CheckIcon />}
      {variant === "red" && <CloseIcon />}
      {variant === "yellow" && <InfoIcon />}
      {label}
    </span>
  );
}
