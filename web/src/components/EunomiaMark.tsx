// The mark: an E whose middle arm is cut loose from the body.
//
// Top and bottom arms stay attached — what remains in the treasury. The middle one is short,
// detached and green: the share allotted to the agent, and the gap between them is the limit
// itself. The reading comes from the name — *nomos* (law) grows from *nemein*, "to allot".
//
// The accent is a CSS variable rather than a fixed fill so the mark can collapse to a single
// colour. On a green background the green arm would otherwise vanish; there, `mono` paints it
// in the body colour instead.

interface Props {
  /** Rendered size in pixels. The mark is drawn on a 64-unit grid and scales cleanly. */
  size?: number;
  /** Single-colour rendering — for green backgrounds, favicons on colour, and print. */
  mono?: boolean;
  className?: string;
}

export default function EunomiaMark({ size = 20, mono = false, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={mono ? { ["--mark-accent" as string]: "currentColor" } : undefined}
    >
      {/* Body: spine, top arm, bottom arm — one path, so colour changes stay in sync. */}
      <path d="M8 6h10v52H8zM18 6h38v10H18zM18 48h38v10H18z" fill="currentColor" />
      {/* The allotted share. Held 10 units clear of the spine: at 8 the gap closed up around
          16px and the mark read as a plain E. */}
      <rect x="28" y="26" width="20" height="10" fill="var(--mark-accent, #A2CB28)" />
    </svg>
  );
}
