type IconProps = { className?: string };

const shared = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ReadIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path d="M4 5v13a1 1 0 0 0 1 1c2 0 5 .8 7 2 2-1.2 5-2 7-2a1 1 0 0 0 1-1V5" />
      <path d="M12 21V7" />
      <path d="M4 5c2 0 5 .8 7 2 2-1.2 5-2 7-2" />
    </svg>
  );
}

export function TrackIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path d="M4 17l5-5 4 4 7-8" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

export function TestIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
