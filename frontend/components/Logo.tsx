export function Logo({
  className = "",
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "light";
}) {
  const text = tone === "light" ? "text-white" : "text-brand-800";
  const accent = tone === "light" ? "#f1f7f3" : "#2c6343";
  const bowl = tone === "light" ? "#ffffff" : "#234f37";
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${text} ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
        <path d="M6 15h20a10 10 0 0 1-20 0Z" fill={bowl} />
        <rect x="4" y="12.5" width="24" height="2.6" rx="1.3" fill={accent} />
        <path
          d="M11 12c0-3.3 2.2-6 5-6s5 2.7 5 6"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="16" cy="4.5" r="1.5" fill={accent} />
      </svg>
      <span className="leading-none">
        Ghar Se <span className={tone === "light" ? "text-brand-100" : "text-brand-500"}>Tiffin</span>
      </span>
    </span>
  );
}
