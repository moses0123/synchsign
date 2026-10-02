"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export interface WeekPoint { week: string; sent: number; completed: number }

/** Single-series column chart: envelopes sent per week. Hover/tap a column for details. */
export function WeeklyChart({ data }: { data: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((d) => d.sent));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const label = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <figure className="w-full" aria-label="Envelopes sent per week, last 8 weeks">
      <div className="relative flex h-44 gap-3">
        {/* y axis */}
        <div className="flex w-6 flex-col-reverse justify-between text-right text-[11px] tabular-nums text-muted">
          {ticks.map((t) => <span key={t} className="-mb-1.5 leading-none">{t}</span>)}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <button key={d.week} type="button" className="relative flex h-full flex-1 items-end justify-center outline-none"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)} aria-label={`Week of ${label(d.week)}: ${d.sent} sent, ${d.completed} completed`}>
                <motion.span
                  className="block w-full max-w-[28px] rounded-t-[4px] bg-sky-600"
                  style={{ opacity: hover === null || hover === i ? 1 : 0.45 }}
                  initial={{ height: 0 }} animate={{ height: `${(d.sent / top) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.03, ease: "easeOut" }} />
                {hover === i && (
                  <span style={{ bottom: `min(calc(${(d.sent / top) * 100}% + 8px), calc(100% - 44px))` }} className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-xs shadow-md">
                    <span className="block font-semibold text-ink">Week of {label(d.week)}</span>
                    <span className="block text-muted">{d.sent} sent · {d.completed} completed</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-9 mt-2 flex gap-[2px] text-[11px] text-muted">
        {data.map((d, i) => <span key={d.week} className="flex-1 whitespace-nowrap text-center">{i % 2 === 0 && <span className={i % 4 === 0 ? "" : "hidden sm:inline"}>{label(d.week)}</span>}</span>)}
      </div>
      <details className="ml-9 mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none">View as table</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr className="text-ink"><th className="py-1 font-semibold">Week of</th><th className="font-semibold">Sent</th><th className="font-semibold">Completed</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.week} className="border-t border-line"><td className="py-1">{label(d.week)}</td><td className="tabular-nums">{d.sent}</td><td className="tabular-nums">{d.completed}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
