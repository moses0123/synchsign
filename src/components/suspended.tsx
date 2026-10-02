"use client";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { LogoMark } from "./logo";
import { Button } from "./ui";

export function Suspended() {
  const router = useRouter();
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto h-11 w-11" />
        <Ban className="mx-auto mt-8 h-7 w-7 text-rose-500" />
        <h1 className="mt-3 font-display text-xl font-semibold">Account suspended</h1>
        <p className="mt-2 text-sm text-muted">Your access to SyncSign has been suspended by an administrator. Contact them if you think this is a mistake.</p>
        <Button variant="outline" className="mt-6" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>Sign out</Button>
      </div>
    </div>
  );
}
