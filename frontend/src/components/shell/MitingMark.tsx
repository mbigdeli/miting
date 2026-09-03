/**
 * The Miting mark: three rounded bars (tall / short / tall) — an abstracted
 * "M" that doubles as a level meter. Inline SVG so it inherits currentColor
 * and stays crisp at any size, unlike the letter "M" placeholder it replaces.
 */
export function MitingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" fill="currentColor" aria-hidden className={className}>
      <path d="m192.11 72c52.52 0 95.1 42.58 95.1 95.11v690.45c0 52.53-42.58 95.11-95.1 95.11-52.53 0-95.11-42.58-95.11-95.11v-690.45c0-52.53 42.58-95.11 95.11-95.11z" />
      <path d="m515.62 371.55c52.52 0 95.1 42.58 95.1 95.1v390.91c0 52.53-42.58 95.11-95.1 95.11-52.53 0-95.11-42.58-95.11-95.11v-390.91c0-52.52 42.58-95.1 95.11-95.1z" />
      <path d="m831.64 72c52.53 0 95.11 42.58 95.11 95.11v690.45c0 52.53-42.58 95.11-95.11 95.11-52.53 0-95.11-42.58-95.11-95.11v-690.45c0-52.53 42.58-95.11 95.11-95.11z" />
    </svg>
  );
}

/** The mark on a brand-teal rounded tile — the app's logo lockup. */
export function MitingLogoTile({ size = 26, radius = 8 }: { size?: number; radius?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center bg-brand text-white"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <MitingMark className="h-[62%] w-[62%]" />
    </span>
  );
}
