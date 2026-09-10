export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
        <path
          d="M16 3c5 0 9 3.6 9 8H7c0-4.4 4-8 9-8Z"
          fill="#df6524"
        />
        <rect x="5" y="12" width="22" height="3.5" rx="1.75" fill="#a63a18" />
        <path
          d="M7 17h18c0 5-4 9-9 9s-9-4-9-9Z"
          fill="#f9b024"
        />
        <circle cx="16" cy="7.5" r="1.4" fill="#fffaf3" />
      </svg>
      <span className="font-bold tracking-tight">
        GharSe<span className="text-masala-600"> Tiffin</span>
      </span>
    </span>
  );
}
