"use client";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, FileText } from "lucide-react";
import type { ClientEnvelope } from "@/lib/client-types";
import { Avatar, StatusBadge } from "./ui";
import { timeAgo } from "@/lib/utils";

export function EnvelopeRow({ e, i = 0 }: { e: ClientEnvelope; i?: number }) {
  const actionable = e.recipients.filter((r) => r.role !== "cc");
  const done = actionable.filter((r) => r.status === "signed" || r.status === "approved").length;
  const pct = actionable.length ? (done / actionable.length) * 100 : 0;
  const href = e.status === "draft" ? `/app/envelopes/${e._id}/edit` : `/app/envelopes/${e._id}`;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
      <Link href={href} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-line hover:bg-surface sm:gap-4 sm:px-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{e.title}</p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="truncate">{actionable.length ? actionable.map((r) => r.name).join(", ") : "No recipients yet"}</span>
            <span>·</span><span className="shrink-0">{timeAgo(e.updatedAt)}</span>
          </div>
          {e.status === "sent" && actionable.length > 0 && (
            <div className="mt-2 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-2">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
            </div>
          )}
        </div>
        <div className="hidden -space-x-2 md:flex">
          {actionable.slice(0, 4).map((r) => <Avatar key={r.id} name={r.name} color={r.color} size={28} />)}
        </div>
        <StatusBadge status={e.status} />
        <ChevronRight className="hidden h-4 w-4 text-muted transition group-hover:translate-x-0.5 sm:block" />
      </Link>
    </motion.div>
  );
}

export function EnvelopeList({ items }: { items: ClientEnvelope[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
        {items.map((e, i) => <EnvelopeRow key={e._id} e={e} i={i} />)}
      </AnimatePresence>
    </div>
  );
}
