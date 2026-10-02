"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { MotionConfig } from "framer-motion";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      // In development, remove any worker left over from a production run so it can't serve stale or offline pages
      navigator.serviceWorker.getRegistrations().then((regs) => {
        if (!regs.length) return;
        Promise.all(regs.map((r) => r.unregister()))
          .then(() => (window.caches ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) : undefined))
          .then(() => window.location.reload());
      }).catch(() => {});
    }
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: "!rounded-xl" }} />
      </MotionConfig>
    </ThemeProvider>
  );
}
