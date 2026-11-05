import { requireUser } from "@/lib/auth";
import { insights } from "@/lib/data";
import { TYPE_LABEL } from "@/components/badges";
import { receiptLine, weeklyReceipt } from "@/lib/brief";

export const metadata = { title: "Insights" };

function niceMax(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const step = v <= 10 ? 2 : v <= 25 ? 5 : v <= 50 ? 10 : 20;
  return { max: Math.ceil(v / step) * step, step };
}

function BarChart({ series, label, noun, aria }: { series: { key: string; count: number }[]; label: (k: string) => string; noun: [string, string]; aria: string }) {
  const W = 720, H = 220, P = { l: 32, r: 8, t: 16, b: 26 };
  const { max, step } = niceMax(Math.max(...series.map((s) => s.count), 0));
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const band = iw / series.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => P.t + ih - (v / max) * ih;
  const peak = series.reduce((a, b) => (b.count > a.count ? b : a), series[0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={aria}>
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
          <g key={s.key}>
            <title>{`${label(s.key)}: ${s.count} ${s.count === 1 ? noun[0] : noun[1]}`}</title>
            <rect x={P.l + band * i} y={P.t} width={band} height={ih} fill="transparent" />
            {h > 0 && <path d={`M${x0},${bottom} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x1 - r},${top} Q${x1},${top} ${x1},${top + r} L${x1},${bottom} Z`} fill="var(--accent)" />}
            {s === peak && s.count > 0 && <text x={cx} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-2)">{s.count}</text>}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{label(s.key)}</text>
          </g>
        );
      })}
      <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth={1} shapeRendering="crispEdges" />
    </svg>
  );
}

const month = (m: string) => new Date(m + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const week = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Table({ rows, head }: { rows: [string, number][]; head: [string, string] }) {
  return (
    <details className="mt-2 text-[13px]">
      <summary className="cursor-pointer font-medium text-muted">Show as table</summary>
      <table className="mt-2 w-full max-w-sm">
        <thead><tr className="border-b border-line text-left text-[12px] text-muted"><th className="py-1 font-medium">{head[0]}</th><th className="py-1 text-right font-medium">{head[1]}</th></tr></thead>
        <tbody>{rows.map(([k, v]) => <tr key={k} className="border-b border-line"><td className="py-1">{k}</td><td className="py-1 text-right">{v}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

export default async function InsightsPage() {
  const user = await requireUser();
  const i = insights(user.id);
  const receipt = receiptLine(weeklyReceipt(user.id));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const totals = Object.values(i.byType).reduce((a, t) => ({ total: a.total + t.total, responded: a.responded + t.responded }), { total: 0, responded: 0 });
  const funnel = [
    { label: "Applied", v: i.funnel.applied },
    { label: "Assessment or further", v: i.funnel.assessment },
    { label: "Interview or further", v: i.funnel.interview },
    { label: "Offer", v: i.funnel.offer },
  ];
  const fmax = Math.max(...funnel.map((f) => f.v), 1);
  const e = i.effort;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-page">Insights</h1>
        <p className="mt-1 text-[14px] text-muted">What you&apos;ve put in. Effort is the part you control.</p>
      </div>

      <section aria-label="This week">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
          {[
            { label: "Emails sent this week", value: e.sent },
            { label: "Applications started", value: e.applied },
            { label: "Follow-ups sent", value: e.followUpsSent },
            { label: "Tasks done", value: e.tasksDone },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-4 py-3">
              <p className="text-[12px] text-muted">{s.label}</p>
              <p className="tabular mt-1 text-[24px] font-semibold leading-8">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">{receipt}</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Emails sent per week">
          <h2 className="h-section">Emails you sent</h2>
          <p className="text-[13px] text-muted">Per week, last 8 weeks</p>
          <div className="mt-3">
            <BarChart series={i.weeks.map((w) => ({ key: w.week, count: w.sent }))} label={week} noun={["email", "emails"]} aria="Emails you sent per week, last 8 weeks" />
          </div>
          <Table head={["Week of", "Sent"]} rows={i.weeks.map((w) => [w.week, w.sent])} />
        </section>
        <section aria-label="Applications per month">
          <h2 className="h-section">Applications started</h2>
          <p className="text-[13px] text-muted">Per month, last 12 months</p>
          <div className="mt-3">
            <BarChart series={i.series.map((s) => ({ key: s.month, count: s.count }))} label={month} noun={["application", "applications"]} aria="Applications started per month, last 12 months" />
          </div>
          <Table head={["Month", "Applications"]} rows={i.series.map((s) => [s.month, s.count])} />
        </section>
      </div>

      {i.answers.length > 0 && (
        <section aria-label="Answer reuse">
          <h2 className="h-section">Answers you reuse</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {i.answers.map((a) => (
              <li key={a.title} className="flex justify-between py-2 text-[14px]"><span>{a.title}</span><span className="tabular text-muted">copied {a.uses}×</span></li>
            ))}
          </ul>
        </section>
      )}

      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
          <span className="h-section">Outcomes and response times</span>
          <span className="text-[13px] text-muted"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
        </summary>
        <div className="space-y-6 border-t border-line px-5 py-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Applications tracked", value: String(i.total) },
              { label: "Heard back", value: pct(totals.responded, totals.total) },
              { label: "Reached interview", value: pct(i.funnel.interview, i.funnel.applied) },
              { label: "Median days to first reply", value: i.medianDaysToResponse === null ? "—" : `${Math.round(i.medianDaysToResponse)}d` },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[12px] text-muted">{s.label}</p>
                <p className="tabular mt-0.5 text-[20px] font-semibold leading-7">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-[14px] font-medium">Funnel</h3>
              <p className="text-[12px] text-muted">Share of applications that reached each step</p>
              <ul className="mt-3 space-y-3">
                {funnel.map((f) => (
                  <li key={f.label}>
                    <div className="flex justify-between text-[13px]"><span>{f.label}</span><span className="tabular font-medium">{f.v} <span className="font-normal text-muted">· {pct(f.v, i.funnel.applied)}</span></span></div>
                    <div className="mt-1 h-2 rounded-full bg-sunken"><div className="h-full rounded-full bg-accent" style={{ width: `${(f.v / fmax) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-x-auto">
              <h3 className="text-[14px] font-medium">By type</h3>
              <table className="mt-2 w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 text-right font-medium">Total</th>
                    <th className="py-2 text-right font-medium">Heard back</th>
                    <th className="py-2 text-right font-medium">Interviews</th>
                    <th className="py-2 text-right font-medium">Offers</th>
                    <th className="py-2 text-right font-medium">Closed</th>
                  </tr>
                </thead>
                <tbody>
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
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
