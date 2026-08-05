type LogomarkProps = { className?: string };

export function Logomark({ className }: LogomarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path
        d="M12 10l-5 6 5 6M20 10l5 6-5 6"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
