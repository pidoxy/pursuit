import { requireUser } from "@/lib/auth";
import { insights } from "@/lib/data";
import { TYPE_LABEL } from "@/components/badges";

export const metadata = { title: "Insights" };

function niceMax(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const step = v <= 10 ? 2 : v <= 25 ? 5 : v <= 50 ? 10 : 20;
  return { max: Math.ceil(v / step) * step, step };
}

function MonthsChart({ series }: { series: { month: string; count: number }[] }) {
  const W = 720, H = 220, P = { l: 32, r: 8, t: 16, b: 26 };
  const { max, step } = niceMax(Math.max(...series.map((s) => s.count), 0));
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const band = iw / series.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => P.t + ih - (v / max) * ih;
  const label = (m: string) => new Date(m + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "short" });
  const peak = series.reduce((a, b) => (b.count > a.count ? b : a), series[0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Applications started per month, last 12 months">
      {Array.from({ length: max / step + 1 }, (_, i) => i * step).map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
          <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const cx = P.l + band * i + band / 2;
        const top = y(s.count), bottom = y(0);
        const h = bottom - top;
        const r = Math.min(4, h, bw / 2);
        const x0 = cx - bw / 2, x1 = cx + bw / 2;
        return (
          <g key={s.month}>
            <title>{`${label(s.month)} ${s.month.slice(0, 4)}: ${s.count} ${s.count === 1 ? "application" : "applications"}`}</title>
            <rect x={P.l + band * i} y={P.t} width={band} height={ih} fill="transparent" />
            {h > 0 && <path d={`M${x0},${bottom} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x1 - r},${top} Q${x1},${top} ${x1},${top + r} L${x1},${bottom} Z`} fill="var(--accent)" />}
            {s === peak && s.count > 0 && <text x={cx} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-2)">{s.count}</text>}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{label(s.month)}</text>
          </g>
        );
      })}
      <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth={1} shapeRendering="crispEdges" />
    </svg>
  );
}

export default async function InsightsPage() {
  const user = await requireUser();
  const i = insights(user.id);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const totals = Object.values(i.byType).reduce((a, t) => ({ total: a.total + t.total, responded: a.responded + t.responded }), { total: 0, responded: 0 });
  const funnel = [
    { label: "Applied", v: i.funnel.applied },
    { label: "Assessment or further", v: i.funnel.assessment },
    { label: "Interview or further", v: i.funnel.interview },
    { label: "Offer", v: i.funnel.offer },
  ];
  const fmax = Math.max(...funnel.map((f) => f.v), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-3xl">Insights</h1>
        <p className="mt-1 text-ink-2">How your search is going — and where it stalls.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Applications tracked", value: String(i.total) },
          { label: "Heard back", value: pct(totals.responded, totals.total) },
          { label: "Reached interview", value: pct(i.funnel.interview, i.funnel.applied) },
          { label: "Median days to first reply", value: i.medianDaysToResponse === null ? "—" : `${Math.round(i.medianDaysToResponse)}d` },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-[13px] text-muted">{s.label}</p>
            <p className="mt-1 text-[1.9rem] font-bold leading-none tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Applications per month</h2>
        <p className="text-sm text-muted">Last 12 months, by date applied</p>
        <div className="mt-4"><MonthsChart series={i.series} /></div>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-semibold text-muted">Show as table</summary>
          <table className="mt-2 w-full max-w-sm text-sm">
            <tbody>
              {i.series.map((s) => (
                <tr key={s.month} className="border-b border-line"><td className="py-1">{s.month}</td><td className="py-1 text-right tabular-nums">{s.count}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Funnel</h2>
          <p className="text-sm text-muted">Share of applications that reached each step</p>
          <ul className="mt-4 space-y-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="flex justify-between text-sm"><span>{f.label}</span><span className="font-semibold tabular-nums">{f.v} <span className="font-normal text-muted">· {pct(f.v, i.funnel.applied)}</span></span></div>
                <div className="mt-1 h-2.5 rounded-full bg-sunken"><div className="h-full rounded-full bg-accent" style={{ width: `${(f.v / fmax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-x-auto p-5">
          <h2 className="font-semibold">By type</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-semibold">Type</th>
                <th className="py-2 text-right font-semibold">Total</th>
                <th className="py-2 text-right font-semibold">Heard back</th>
                <th className="py-2 text-right font-semibold">Interviews</th>
                <th className="py-2 text-right font-semibold">Offers</th>
                <th className="py-2 text-right font-semibold">Rejected</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {Object.entries(i.byType).sort((a, b) => b[1].total - a[1].total).map(([t, v]) => (
                <tr key={t} className="border-b border-line last:border-0">
                  <td className="py-2">{TYPE_LABEL[t] ?? t}</td>
                  <td className="py-2 text-right">{v.total}</td>
                  <td className="py-2 text-right">{pct(v.responded, v.total)}</td>
                  <td className="py-2 text-right">{v.interviews}</td>
                  <td className="py-2 text-right">{v.offers}</td>
                  <td className="py-2 text-right">{v.rejected}</td>
                </tr>
              ))}
              {!Object.keys(i.byType).length && <tr><td colSpan={6} className="py-6 text-center text-muted">No data yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
