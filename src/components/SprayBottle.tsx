/** A spray bottle, like the one on the printed chart. */
export function SprayBottle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {/* mist */}
        <path d="M50 8l7-4M51 14h8M50 20l7 4" />
        {/* trigger head and nozzle */}
        <path d="M20 8h20c3 0 5 2 5 5v3c0 2-2 3-4 3H38l-2 6H24l-2-6" />
        <path d="M45 13h4" />
        {/* trigger */}
        <path d="M36 25c2 4 5 6 9 7" />
        {/* neck and body */}
        <path d="M24 25v5c-5 3-8 8-8 14v12c0 2 2 4 4 4h20c2 0 4-2 4-4V44c0-6-3-11-8-14v-5" />
      </g>
      {/* dots on the bottle, like the chart's print */}
      <g fill="currentColor">
        <circle cx="23" cy="44" r="1.8" />
        <circle cx="30" cy="40" r="1.8" />
        <circle cx="37" cy="44" r="1.8" />
        <circle cx="23" cy="52" r="1.8" />
        <circle cx="30" cy="48" r="1.8" />
        <circle cx="37" cy="52" r="1.8" />
        <circle cx="30" cy="56" r="1.8" />
      </g>
    </svg>
  );
}
