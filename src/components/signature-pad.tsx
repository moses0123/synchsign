"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type, Upload, Undo2 } from "lucide-react";
import { Button, Modal, Segmented } from "./ui";
import { cn, initialsOf } from "@/lib/utils";

const INKS = [
  { v: "#0b3a63", label: "Navy" },
  { v: "#111827", label: "Black" },
  { v: "#0369a1", label: "Blue" },
];
const FONTS = ["--font-sig", "--font-sig2", "--font-sig3", "--font-sig4"];

type Pt = { x: number; y: number; t: number; w: number };

/** Crop transparent padding and return a PNG data URL */
function trim(canvas: HTMLCanvasElement, pad = 8): string | null {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3]! > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width, maxX + pad); maxY = Math.min(height, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX; out.height = maxY - minY;
  out.getContext("2d")!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function fontFamily(varName: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "cursive";
}

function DrawPad({ ink, onChange, clearKey }: { ink: string; onChange: (has: boolean, c: HTMLCanvasElement) => void; clearKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const drawing = useRef(false);

  const redraw = useCallback(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.fillStyle = ink;
    for (const s of strokes.current) {
      if (s.length === 1) { ctx.beginPath(); ctx.arc(s[0]!.x, s[0]!.y, s[0]!.w / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!, b = s[i]!;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.beginPath(); ctx.lineWidth = (a.w + b.w) / 2;
        const prev = i > 1 ? { x: (s[i - 2]!.x + a.x) / 2, y: (s[i - 2]!.y + a.y) / 2 } : a;
        ctx.moveTo(prev.x, prev.y); ctx.quadraticCurveTo(a.x, a.y, m.x, m.y); ctx.stroke();
      }
    }
    onChange(strokes.current.length > 0, c);
  }, [ink, onChange]);

  useEffect(() => {
    const c = ref.current!;
    const fit = () => {
      const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr; c.height = r.height * dpr;
      c.getContext("2d")!.setTransform(1, 0, 0, 1, 0, 0);
      strokes.current = []; redraw();
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { strokes.current = []; redraw(); }, [clearKey, redraw]);
  useEffect(() => { redraw(); }, [ink, redraw]);

  const pos = (e: React.PointerEvent): Pt => {
    const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = c.width / r.width;
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, t: e.timeStamp, w: 3.2 * dpr };
  };
  return (
    <div className="relative">
      <canvas ref={ref}
        className="h-48 w-full touch-none rounded-xl border-2 border-dashed border-sky-300/70 bg-white sm:h-56 dark:border-sky-700"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; strokes.current.push([pos(e)]); redraw(); navigator.vibrate?.(5); }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const s = strokes.current[strokes.current.length - 1]!; const p = pos(e); const last = s[s.length - 1]!;
          const dist = Math.hypot(p.x - last.x, p.y - last.y); const dt = Math.max(1, p.t - last.t);
          const pressure = e.pressure && e.pointerType === "pen" ? e.pressure : 0.5;
          const target = Math.max(1.4, Math.min(5.5, (pressure * 7) / (1 + (dist / dt) * 0.6))) * (ref.current!.width / ref.current!.getBoundingClientRect().width);
          p.w = last.w * 0.6 + target * 0.4;
          if (dist > 1) { s.push(p); redraw(); }
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      />
      <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-300" />
      <span className="pointer-events-none absolute bottom-3 left-6 text-xs text-slate-400">Sign above the line</span>
      <button type="button" onClick={() => { strokes.current.pop(); redraw(); }} className="absolute right-3 top-3 rounded-lg bg-slate-100 p-2 text-slate-500 hover:text-slate-800" aria-label="Undo stroke">
        <Undo2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SignatureModal({ open, onClose, onAdopt, kind = "signature", name, initial }: {
  open: boolean; onClose: () => void; onAdopt: (dataUrl: string) => void;
  kind?: "signature" | "initials"; name: string; initial?: string | null;
}) {
  const [tab, setTab] = useState<"type" | "draw" | "upload">("type");
  const [ink, setInk] = useState(INKS[0]!.v);
  const [text, setText] = useState("");
  const [font, setFont] = useState(0);
  const [clearKey, setClearKey] = useState(0);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [upload, setUpload] = useState<string | null>(null);
  const drawCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => { if (open) { setText(kind === "initials" ? initialsOf(name) : name); setUpload(null); } }, [open, kind, name]);

  const onDrawChange = useCallback((has: boolean, c: HTMLCanvasElement) => { setHasDrawing(has); drawCanvas.current = c; }, []);

  async function renderTyped(): Promise<string | null> {
    if (!text.trim()) return null;
    const fam = fontFamily(FONTS[font]!);
    await document.fonts.load(`120px ${fam}`).catch(() => {});
    const c = document.createElement("canvas"); c.width = 1400; c.height = 360;
    const ctx = c.getContext("2d")!;
    let size = 150; ctx.font = `${size}px ${fam}`;
    while (ctx.measureText(text).width > 1300 && size > 40) { size -= 6; ctx.font = `${size}px ${fam}`; }
    ctx.fillStyle = ink; ctx.textBaseline = "middle"; ctx.fillText(text, 50, 190);
    return trim(c, 12);
  }

  async function adopt() {
    let url: string | null = null;
    if (tab === "type") url = await renderTyped();
    if (tab === "draw" && drawCanvas.current) url = trim(drawCanvas.current, 10);
    if (tab === "upload") url = upload;
    if (url) { onAdopt(url); navigator.vibrate?.([10, 40, 10]); onClose(); }
  }

  const ready = tab === "type" ? Boolean(text.trim()) : tab === "draw" ? hasDrawing : Boolean(upload);

  return (
    <Modal open={open} onClose={onClose} title={kind === "initials" ? "Adopt your initials" : "Adopt your signature"} wide
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {initial && <Button variant="outline" onClick={() => { onAdopt(initial); onClose(); }}>Use saved</Button>}
        <Button onClick={adopt} disabled={!ready}>Adopt &amp; {kind === "initials" ? "initial" : "sign"}</Button>
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented value={tab} onChange={setTab} options={[
            { value: "type", label: <><Type className="h-4 w-4" />Type</> },
            { value: "draw", label: <><PenLine className="h-4 w-4" />Draw</> },
            { value: "upload", label: <><Upload className="h-4 w-4" />Upload</> },
          ]} />
          {tab !== "upload" && (
            <div className="flex items-center gap-2">
              {INKS.map((i) => (
                <button key={i.v} type="button" title={i.label} onClick={() => setInk(i.v)}
                  className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition", ink === i.v ? "ring-sky-400 scale-110" : "ring-transparent")}
                  style={{ background: i.v }} />
              ))}
            </div>
          )}
        </div>

        {tab === "type" && (
          <div className="space-y-3">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "initials" ? "Your initials" : "Your full name"} maxLength={kind === "initials" ? 6 : 60} />
            <div className="grid gap-2 sm:grid-cols-2">
              {FONTS.map((f, i) => (
                <button key={f} type="button" onClick={() => setFont(i)}
                  className={cn("flex h-20 items-center overflow-hidden rounded-xl border-2 bg-white pl-8 pr-4 text-left transition", font === i ? "border-sky-400 shadow-sm" : "border-line hover:border-sky-200")}>
                  <span className="truncate text-4xl" style={{ fontFamily: `var(${f})`, color: ink }}>{text || name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "draw" && (
          <div className="space-y-2">
            <DrawPad ink={ink} onChange={onDrawChange} clearKey={clearKey} />
            <div className="flex justify-between text-xs text-muted">
              <span>Use your finger, stylus or mouse. Pressure-sensitive on supported pens.</span>
              <button type="button" className="inline-flex items-center gap-1 font-semibold text-sky-600" onClick={() => setClearKey((k) => k + 1)}><Eraser className="h-3.5 w-3.5" />Clear</button>
            </div>
          </div>
        )}
        {tab === "upload" && (
          <label className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-300/70 bg-surface-2 text-sm text-muted hover:border-sky-400">
            {upload ? <img src={upload} alt="Uploaded signature" className="max-h-36 max-w-[80%] object-contain" /> : <><Upload className="h-6 w-6 text-sky-500" />Upload an image of your signature (PNG/JPG)</>}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const img = new Image(); const r = new FileReader();
              r.onload = () => { img.onload = () => {
                const c = document.createElement("canvas"); const s = Math.min(1, 1200 / img.width);
                c.width = img.width * s; c.height = img.height * s;
                const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, c.width, c.height);
                // knock out near-white background
                const d = ctx.getImageData(0, 0, c.width, c.height);
                for (let i = 0; i < d.data.length; i += 4) { const l = (d.data[i]! + d.data[i + 1]! + d.data[i + 2]!) / 3; if (l > 225) d.data[i + 3] = 0; }
                ctx.putImageData(d, 0, 0); setUpload(trim(c, 6));
              }; img.src = String(r.result); };
              r.readAsDataURL(f);
            }} />
          </label>
        )}
        <p className="text-xs leading-relaxed text-muted">
          By selecting <strong>Adopt</strong>, I agree that this mark is the electronic representation of my {kind} for all purposes when I use it on documents, just the same as a pen-and-paper {kind}.
        </p>
      </div>
    </Modal>
  );
}
