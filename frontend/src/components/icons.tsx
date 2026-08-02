interface IconProps {
  size?: number;
  color?: string;
}

const base = (size: number | undefined, color: string | undefined) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const SearchIcon = ({ size = 18, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const ZapIcon = ({ size = 18, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const BarChartIcon = ({ size = 18, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export const TrendingUpIcon = ({ size = 18, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const FileTextIcon = ({ size = 18, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

export const TargetIcon = ({ size = 18, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);

export const ShieldIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const BrainIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.04-3.54A3 3 0 0 1 5 9a2.5 2.5 0 0 1 .5-5A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.04-3.54A3 3 0 0 0 19 9a2.5 2.5 0 0 0-.5-5A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

export const CodeIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

export const CloudIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
  </svg>
);

export const BriefcaseIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export const TerminalIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const ScaleIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h18" />
  </svg>
);

export const SunIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

export const MoonIcon = ({ size = 16, color = "currentColor" }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
