"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle2, Clock, Eye, PenLine, XCircle } from "lucide-react";
import { api } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

interface Note { id: string; envelopeId: string; title: string; kind: string; actor: string; at: string; read: boolean }
const ICON: Record<string, typeof Bell> = { viewed: Eye, signed: PenLine, approved: CheckCircle2, declined: XCircle, completed: CheckCircle2, expired: Clock };
const VERB: Record<string, string> = { viewed: "opened", signed: "signed", approved: "approved", declined: "declined", completed: "completed", expired: "expired" };

export function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: Note[] }>({ unread: 0, items: [] });
  const load = useCallback(() => api<{ unread: number; items: Note[] }>("/api/notifications").then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  async function toggle() {
    const next = !open; setOpen(next);
    if (next && data.unread) { await api("/api/notifications", { method: "POST" }).catch(() => {}); setData((d) => ({ ...d, unread: 0 })); }
  }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Notifications">
        <Bell className="h-[18px] w-[18px]" />
        {data.unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
              className={cn("card absolute z-50 mt-2 w-[min(92vw,360px)] overflow-hidden shadow-lg", align === "right" ? "right-0" : "left-0")}>
              <div className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</div>
              <div className="max-h-[60vh] overflow-y-auto">
                {!data.items.length && <p className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</p>}
                {data.items.map((n) => {
                  const I = ICON[n.kind] ?? Bell;
                  return (
                    <Link key={n.id} href={`/app/envelopes/${n.envelopeId}`} onClick={() => setOpen(false)}
                      className={cn("flex gap-3 border-b border-line px-4 py-3 text-sm last:border-0 hover:bg-surface-2", !n.read && "bg-sky-500/[.04]")}>
                      <I className={cn("mt-0.5 h-4 w-4 shrink-0", n.kind === "declined" ? "text-rose-500" : n.kind === "completed" || n.kind === "signed" || n.kind === "approved" ? "text-emerald-600" : "text-muted")} />
                      <span className="min-w-0 flex-1">
                        <span className="block"><span className="font-semibold">{n.actor}</span> {VERB[n.kind] ?? n.kind} <span className="font-medium">“{n.title}”</span></span>
                        <span className="text-xs text-muted">{timeAgo(n.at)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
