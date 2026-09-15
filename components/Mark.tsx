// Closing seal: an open ink ring, closed by the vermilion countersignature.
export function Mark({ size = 28, animate = false, title = "Countersig" }: { size?: number; animate?: boolean; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--ink)" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="113 38" transform="rotate(-8 32 32)" />
      <path
        className={animate ? "ink-draw" : undefined}
        style={{ ["--len" as string]: 80 }}
        d="M17 36c4-9 9-12 12-7 2 4-3 9 1 10 5 1 9-12 14-9 3 2 1 6 4 6 3 0 6-3 8-6"
        fill="none"
        stroke="var(--seal-bright)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="56" cy="30" r="3.2" fill="var(--seal-bright)" />
    </svg>
  );
}
