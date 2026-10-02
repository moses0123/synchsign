import Link from "next/link";
import { LogoMark } from "@/components/logo";
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto h-14 w-14" />
        <h1 className="mt-6 font-display text-5xl font-bold text-gradient">404</h1>
        <p className="mt-2 text-muted">This page wandered off. Let&apos;s get you back.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-sky-500 px-5 font-semibold text-white">Go home</Link>
      </div>
    </div>
  );
}
