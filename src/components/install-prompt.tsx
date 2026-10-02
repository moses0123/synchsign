"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, X } from "lucide-react";
import { Button } from "./ui";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem("ss-install-dismissed") === "1"; } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;
    const onBip = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setShow(true); };
    window.addEventListener("beforeinstallprompt", onBip);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isIos) { setIos(true); t = setTimeout(() => setShow(true), 4000); }
    return () => { window.removeEventListener("beforeinstallprompt", onBip); if (t) clearTimeout(t); };
  }, []);

  const dismiss = () => { setShow(false); try { localStorage.setItem("ss-install-dismissed", "1"); } catch {} };

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-md md:bottom-6">
          <div className="card glass flex items-center gap-3 p-3.5 pr-2">
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Install SyncSign</p>
              <p className="text-xs text-muted">
                {ios ? <>Tap <Share className="inline h-3.5 w-3.5" /> then “Add to Home Screen”.</> : "Sign faster with the app on your home screen — works offline too."}
              </p>
            </div>
            {!ios && evt && (
              <Button size="sm" onClick={async () => { await evt.prompt(); await evt.userChoice; dismiss(); }}>
                <Download className="h-4 w-4" />Install
              </Button>
            )}
            <button onClick={dismiss} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
