"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect } from "react";
import { cn, initialsOf } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/30 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        size === "icon" && "h-10 w-10",
        variant === "primary" && "bg-sky-600 text-white shadow-sm hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950",
        variant === "secondary" && "border border-line bg-surface-2 text-ink hover:border-sky-300",
        variant === "outline" && "border border-line bg-surface text-ink hover:border-sky-300 hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-rose-500 text-white hover:bg-rose-600",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-sky-500", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-surface-2", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5" />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true"
            className={cn("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
            initial={{ y: 60, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            {title && (
              <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
                <h2 className="font-display text-lg font-semibold">{title}</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
            {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3 sm:px-6">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300", dot: "bg-slate-400" },
  sent: { label: "In progress", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  declined: { label: "Declined", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  voided: { label: "Voided", cls: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-400" },
  expired: { label: "Expired", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  pending: { label: "Waiting", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300", dot: "bg-slate-400" },
  viewed: { label: "Viewed", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  signed: { label: "Signed", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
};

export function StatusBadge({ status, recipient }: { status: string; recipient?: boolean }) {
  const s = STATUS[status] ?? STATUS.draft!;
  const label = recipient && status === "sent" ? "Awaiting" : s.label;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{label}
    </span>
  );
}

export function Avatar({ name, color, size = 32, className }: { name: string; color?: string; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? "linear-gradient(135deg,#38bdf8,#0284c7)" }}>
      {initialsOf(name || "?")}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-surface-2 text-muted">{icon}</div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string;
}) {
  return (
    <div className={cn("relative inline-flex rounded-xl border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors", value === o.value ? "text-ink" : "text-muted hover:text-ink")}>
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-soft"
              transition={{ type: "spring", damping: 30, stiffness: 400 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url.startsWith("/api/admin") && !url.startsWith("/api/admin/auth/login") && typeof window !== "undefined") {
    window.location.href = `/api/admin/auth/logout?next=${encodeURIComponent(`/admin/login?expired=1&next=${window.location.pathname}`)}`;
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}
