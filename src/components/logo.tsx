import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-grid h-8 w-8 shrink-0 place-items-center rounded-[26%] bg-sky-600", className)} aria-hidden>
      <svg viewBox="0 0 48 48" className="h-full w-full">
        <path d="M33.6 12.5c-6-4.5-17-1-11.7 9.5 5.4 5.4 12 8.6 2.8 13.3-3.7 1.4-7.5.8-10.3-.3"
          fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <path d="M10.6 40.3c6.7-2 12-.2 16-.8 3.3-.4 6.7-1.2 11.8-1.9" fill="none" stroke="#e0f2fe" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-display text-lg font-bold tracking-tight", className)}>
      <LogoMark />
      <span>Sync<span className="text-sky-500">Sign</span></span>
    </Link>
  );
}
