"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileUp, PenLine, Send, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Segmented } from "@/components/ui";

function upload(fd: FormData, onProgress: (p: number) => void) {
  return new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/envelopes");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status < 300) resolve(data); else reject(new Error(data.error || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection"));
    xhr.send(fd);
  });
}

function NewEnvelope() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"send" | "self">(params.get("self") === "1" ? "self" : "send");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [maxMB, setMaxMB] = useState(20);
  useEffect(() => { fetch("/api/config").then((r) => r.json()).then((c) => c.maxUploadMB && setMaxMB(c.maxUploadMB)).catch(() => {}); }, []);

  const pick = useCallback((f?: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return toast.error("Please choose a PDF file");
    if (f.size > maxMB * 1024 * 1024) return toast.error(`PDF must be ${maxMB} MB or smaller`);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  }, [title, maxMB]);

  async function go() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("title", title); if (mode === "self") fd.append("self", "1");
    setProgress(0);
    try {
      const { id } = await upload(fd, setProgress);
      router.push(`/app/envelopes/${id}/edit${mode === "self" ? "?step=fields" : ""}`);
    } catch (e) { toast.error((e as Error).message); setProgress(null); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-12">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Start a new envelope</h1>
      <p className="mt-1 text-muted">Upload a PDF — you&apos;ll add people and fields next.</p>

      <Segmented className="mt-6 w-full sm:w-auto" value={mode} onChange={setMode} options={[
        { value: "send", label: <><Send className="h-4 w-4" />Send to others</> },
        { value: "self", label: <><PenLine className="h-4 w-4" />Only I need to sign</> },
      ]} />

      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        onClick={() => !file && input.current?.click()}
        animate={{ borderColor: drag ? "#0284c7" : "rgb(var(--line))", backgroundColor: drag ? "rgb(var(--surface-2))" : "rgb(var(--surface))" }}
        className="relative mt-5 flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-surface p-8 text-center"
      >
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center">
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <FileUp className="h-7 w-7" />
              </span>
              <p className="mt-6 font-display text-lg font-semibold">Drop your PDF here</p>
              <p className="mt-1 text-sm text-muted">or <span className="font-semibold text-sky-600">browse your files</span> · up to {maxMB} MB</p>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
              <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-2 p-4 text-left">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500"><FileText className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{file.name}</p>
                  <p className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {progress === null && <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Remove"><X className="h-4 w-4" /></button>}
              </div>
              {progress !== null && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div className="h-full bg-gradient-to-r from-sky-400 to-sky-600" animate={{ width: `${Math.max(5, progress * 100)}%` }} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4">
            <label className="block">
              <span className="label">Envelope title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
            </label>
            <Button size="lg" className="w-full sm:w-auto" onClick={go} loading={progress !== null}>
              {progress !== null ? (progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : "Preparing…") : mode === "self" ? "Continue to place my fields" : "Continue to recipients"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Page() { return <Suspense><NewEnvelope /></Suspense>; }
