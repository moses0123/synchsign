"use client";
import { useEffect, useRef, useState, memo } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Skeleton } from "./ui";
import { cn } from "@/lib/utils";

export interface PdfSource { url: string; headers?: Record<string, string> }

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

export function usePdf(src: PdfSource | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = src ? src.url + JSON.stringify(src.headers ?? {}) : "";
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const res = await fetch(src.url, { headers: src.headers });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not load document");
        const data = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await loadPdfjs();
        loaded = await pdfjs.getDocument({ data }).promise;
        if (!cancelled) setDoc(loaded);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load document");
      }
    })();
    return () => { cancelled = true; loaded?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { doc, error };
}

const PdfPage = memo(function PdfPage({ doc, index, width, aspect, children }: {
  doc: PDFDocumentProxy; index: number; width: number; aspect: number; children?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(index < 2);
  const [rendered, setRendered] = useState(false);
  const height = width * aspect;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !width) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(index + 1);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvasRef.current;
      if (!c) return;
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport: vp }) as unknown as typeof task;
      try { await task!.promise; if (!cancelled) setRendered(true); } catch { /* cancelled */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, index, visible, width]);

  return (
    <div ref={wrapRef} data-page={index} className="relative mx-auto overflow-hidden rounded-lg bg-white shadow-[0_2px_6px_rgb(2_40_70/.08),0_16px_40px_-16px_rgb(2_60_100/.35)] ring-1 ring-black/5"
      style={{ width, height }}>
      {!rendered && <Skeleton className="absolute inset-0 !rounded-none !bg-slate-100" />}
      <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full transition-opacity duration-500", rendered ? "opacity-100" : "opacity-0")} />
      <div className="absolute inset-0">{children}</div>
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {index + 1}
      </span>
    </div>
  );
});

export function PdfViewer({ source, pages, renderOverlay, maxWidth = 900, className, onReady }: {
  source: PdfSource;
  pages: { w: number; h: number }[];
  renderOverlay?: (pageIndex: number, size: { width: number; height: number }) => React.ReactNode;
  maxWidth?: number;
  className?: string;
  onReady?: () => void;
}) {
  const { doc, error } = usePdf(source);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e) setWidth(Math.min(maxWidth, Math.floor(e.contentRect.width))); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);

  useEffect(() => { if (doc) onReady?.(); }, [doc, onReady]);
  // Signed copies include extra certificate pages that aren't in the envelope's page list
  const all = doc && doc.numPages > pages.length
    ? [...pages, ...Array.from({ length: doc.numPages - pages.length }, () => ({ w: 595.28, h: 841.89 }))]
    : pages;

  return (
    <div ref={boxRef} className={cn("w-full", className)}>
      {error && <div className="card mx-auto max-w-md p-6 text-center text-sm text-rose-600">{error}</div>}
      {!error && width > 0 && (
        <div className="flex flex-col gap-5">
          {all.map((p, i) => doc ? (
            <PdfPage key={i} doc={doc} index={i} width={width} aspect={p.h / p.w}>
              {renderOverlay?.(i, { width, height: width * (p.h / p.w) })}
            </PdfPage>
          ) : (
            <div key={i} className="mx-auto" style={{ width, height: width * (p.h / p.w) }}><Skeleton className="h-full w-full" /></div>
          ))}
        </div>
      )}
    </div>
  );
}
