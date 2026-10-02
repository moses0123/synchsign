"use client";
import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui";

export default function Offline() {
  useEffect(() => {
    const back = () => window.location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto h-12 w-12" />
        <WifiOff className="mx-auto mt-8 h-7 w-7 text-muted" />
        <h1 className="mt-3 font-display text-2xl font-semibold">You&apos;re offline</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">SyncSign needs a connection to load or sign documents. This page reloads automatically when you&apos;re back online.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </div>
  );
}
