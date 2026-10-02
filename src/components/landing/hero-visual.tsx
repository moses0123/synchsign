"use client";
import { motion } from "framer-motion";
import { Check, Clock, Eye, ShieldCheck } from "lucide-react";

const people = [
  { n: "Amara K.", c: "#0ea5e9", s: "Signed", icon: Check, delay: 1.2 },
  { n: "Jonas P.", c: "#8b5cf6", s: "Viewed", icon: Eye, delay: 2.2 },
  { n: "Lindiwe M.", c: "#f59e0b", s: "Next up", icon: Clock, delay: 3 },
];

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-[4/4.3] w-full max-w-[460px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-sky-300/20 blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-6 top-4 bottom-10 rounded-2xl border border-line bg-white p-7 shadow-2xl dark:bg-slate-50">
        <div className="mb-5 flex items-center justify-between">
          <div className="h-3 w-32 rounded-full bg-slate-800/80" />
          <div className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-700">MSA · v3</div>
        </div>
        {[92, 100, 86, 97, 70, 100, 80].map((w, i) => (
          <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3 + i * 0.06, duration: 0.5 }}
            className="mb-2.5 h-2 origin-left rounded-full bg-slate-200" style={{ width: `${w}%` }} />
        ))}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signature</p>
            <div className="relative h-16 rounded-lg border border-sky-300 bg-sky-50/60">
              <svg viewBox="0 0 200 60" className="absolute inset-0 h-full w-full p-1.5">
                <motion.path d="M10 40 C 25 5, 40 5, 38 32 S 55 55, 70 30 S 90 5, 95 35 C 100 55, 115 20, 125 30 S 150 45, 160 22 S 185 30, 192 26"
                  fill="none" stroke="#0b3a63" strokeWidth="3" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1, duration: 1.8, ease: "easeInOut" }} />
              </svg>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date</p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }}
              className="flex h-16 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              26 Sep 2026
            </motion.div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Name</p><div className="h-9 rounded-lg border border-slate-200" /></div>
          <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Title</p><div className="h-9 rounded-lg border border-slate-200" /></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
        className="card glass absolute -right-2 top-16 w-52 p-3 sm:-right-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Live progress</p>
        <div className="space-y-2">
          {people.map((p) => (
            <motion.div key={p.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.delay }}
              className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: p.c }}>{p.n.split(" ").map((x) => x[0]).join("")}</span>
              <span className="flex-1 text-xs font-semibold">{p.n}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted"><p.icon className="h-3 w-3" />{p.s}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.4 }}
        className="card glass absolute -left-2 bottom-2 flex items-center gap-3 p-3 pr-4 sm:-left-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-bold">Tamper-evident</p>
          <p className="font-mono text-[10px] text-muted">sha256 · 9f2c…e41a</p>
        </div>
      </motion.div>
    </div>
  );
}
