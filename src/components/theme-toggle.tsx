"use client";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const opts = [
  { v: "light", icon: Sun, label: "Light" },
  { v: "system", icon: Monitor, label: "Device" },
  { v: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle({ className, labels }: { className?: string; labels?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? "system" : "system";
  return (
    <div className={cn("relative inline-flex rounded-xl border border-line bg-surface-2 p-1", className)} role="radiogroup" aria-label="Theme">
      {opts.map(({ v, icon: Icon, label }) => (
        <button key={v} role="radio" aria-checked={current === v} title={label} onClick={() => setTheme(v)}
          className={cn("relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors", current === v ? "text-sky-600 dark:text-sky-300" : "text-muted hover:text-ink", labels && "flex-1 justify-center")}>
          {current === v && <motion.span layoutId="theme-pill" className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-soft" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
          <Icon className="h-4 w-4" />{labels && label}
        </button>
      ))}
    </div>
  );
}
