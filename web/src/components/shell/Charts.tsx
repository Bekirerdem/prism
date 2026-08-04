// Three small charts, drawn by hand in SVG.
//
// A charting library would be ~60KB for what amounts to a polyline, an arc and some
// rectangles, and every one of its defaults would then have to be argued back into this
// palette. These read the same CSS variables as everything else, so a theme switch carries
// them along and green stays fill-only.
import type { DayBucket } from "../../lib/insights";

/** Spend over the last week, beside the balance. Flat when nothing has moved — a straight
 *  line is the honest picture of an idle treasury, not an empty box. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 132;
  const h = 34;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`)
    .join(" ");

  return (
    <svg className="chart chart--spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--green)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Today's limit as an arc. The number stays the subject; the arc is how full it is. */
export function RadialLimit({
  spent,
  limit,
  children,
}: {
  spent: number;
  limit: number;
  children: React.ReactNode;
}) {
  const size = 132;
  const r = 56;
  const c = 2 * Math.PI * r;
  const pct = limit > 0 ? Math.min(1, spent / limit) : 0;

  return (
    <div className="chart__radial">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct * 100)}% of today's limit used`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--green)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(c * pct).toFixed(1)} ${c.toFixed(1)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="chart__radial-mid">{children}</div>
    </div>
  );
}

/** A week of decisions: what the rules let through, and what they stopped. This is the
 *  product's claim as a picture — the red is not an error rate, it is the thing working. */
export function DecisionBars({ buckets }: { buckets: DayBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.allowed + b.blocked), 1);

  return (
    <div className="chart__bars" role="img" aria-label="Payment decisions over the last seven days">
      {buckets.map((b) => {
        const total = b.allowed + b.blocked;
        return (
          <div className="chart__col" key={b.day}>
            <div className="chart__stack" style={{ height: `${(total / max) * 100}%` }}>
              {b.blocked > 0 && (
                <i
                  className="chart__seg chart__seg--blocked"
                  style={{ flex: b.blocked }}
                  title={`${b.blocked} stopped`}
                />
              )}
              {b.allowed > 0 && (
                <i
                  className="chart__seg chart__seg--ok"
                  style={{ flex: b.allowed }}
                  title={`${b.allowed} allowed`}
                />
              )}
            </div>
            <span className="chart__tick">{b.label[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
