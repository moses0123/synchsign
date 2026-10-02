"use client";
import { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlignCenter, AlignLeft, ArrowDown, ArrowUp, Braces, CloudCheck, Copy, Download, Eye, Heading1, Heading2, ImagePlus, List,
  ListOrdered, Loader2, Minus, MoveVertical, Palette, Pilcrow, Plus, ScissorsLineDashed, Send, Signature, StickyNote,
  Table2, Trash2, Users, X, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, Spinner, api } from "@/components/ui";
import {
  BLOCK_LABELS, BUILTIN_VARS, FONT_SIZES, extractVariables, fillVariables, humanize, runs,
  type Block, type BlockType, type DocContent, type DocRole,
} from "@/lib/doc-model";
import { RECIPIENT_COLORS } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

const TYPE_ICON: Record<BlockType, typeof Pilcrow> = {
  heading: Heading1, subheading: Heading2, paragraph: Pilcrow, bullets: List, numbered: ListOrdered, table: Table2,
  divider: Minus, spacer: MoveVertical, pagebreak: ScissorsLineDashed, signature: Signature, note: StickyNote,
};
const INSERTABLE: BlockType[] = ["heading", "subheading", "paragraph", "bullets", "numbered", "table", "note", "signature", "divider", "spacer", "pagebreak"];
const ACCENTS = ["#0284c7", "#0f172a", "#1d4ed8", "#0f766e", "#7c3aed", "#b91c1c", "#b45309"];

type Panel = "insert" | "fields" | "signers" | "style";
interface Focus { blockId: string; part: string; start: number; end: number }

function newBlock(type: BlockType, roleId?: string): Block {
  const b: Block = { id: uid(8), type };
  if (type === "heading") { b.text = "Document title"; b.align = "center"; }
  if (type === "subheading") b.text = "Section heading";
  if (type === "paragraph") b.text = "";
  if (type === "note") b.text = "Important note";
  if (type === "bullets" || type === "numbered") b.items = [""];
  if (type === "table") b.rows = [["Item", "Detail"], ["", ""]];
  if (type === "signature") b.roleId = roleId;
  return b;
}

/* ─────────────── text box: formatted when idle, raw while editing ─────────────── */
const LabelsCtx = createContext<Record<string, string>>({});

function Rendered({ text, placeholder }: { text: string; placeholder?: string }) {
  const labels = useContext(LabelsCtx);
  if (!text.trim()) return <span className="text-slate-300">{placeholder}</span>;
  return (
    <>
      {runs(text).map((r, i) => {
        const parts = r.t.split(/(\{\{\s*[a-zA-Z][\w.]*\s*\}\})/g);
        const inner = parts.map((part, j) => {
          const m = part.match(/^\{\{\s*([a-zA-Z][\w.]*)\s*\}\}$/);
          if (!m) return <span key={j}>{part}</span>;
          const k = m[1]!;
          const label = k === "today" ? "Today's date" : labels[k] ?? humanize(k);
          return <span key={j} className="mx-px rounded bg-sky-100 px-1 py-px font-medium text-sky-800 ring-1 ring-inset ring-sky-200" style={{ fontSize: "0.92em" }}>{label}</span>;
        });
        return r.b ? <strong key={i}>{inner}</strong> : <span key={i}>{inner}</span>;
      })}
    </>
  );
}

function AutoText({ value, onChange, className, style, placeholder, onFocusEl, onKeyDown, autoFocus }: {
  value: string; onChange: (v: string) => void; className?: string; style?: React.CSSProperties; placeholder?: string;
  onFocusEl?: (el: HTMLTextAreaElement) => void; onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(Boolean(autoFocus));
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "0px"; el.style.height = `${el.scrollHeight}px`;
  }, [value, editing]);
  useEffect(() => { if (autoFocus) setEditing(true); }, [autoFocus]);
  useEffect(() => { if (editing) { const el = ref.current; if (el) { el.focus(); if (!autoFocus) el.setSelectionRange(el.value.length, el.value.length); } } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!editing) {
    return (
      <div role="textbox" tabIndex={0} onClick={() => setEditing(true)} onFocus={() => setEditing(true)}
        className={cn("block w-full cursor-text whitespace-pre-wrap break-words", className)} style={style}>
        <Rendered text={value} placeholder={placeholder} />
      </div>
    );
  }
  return (
    <textarea ref={ref} rows={1} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} onFocus={(e) => onFocusEl?.(e.currentTarget)} onKeyDown={onKeyDown}
      onSelect={(e) => onFocusEl?.(e.currentTarget)}
      onBlur={(e) => { onFocusEl?.(e.currentTarget); setEditing(false); }}
      className={cn("block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-slate-300", className)} style={style} />
  );
}

export default function DocumentEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<DocContent | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [panel, setPanel] = useState<Panel>("insert");
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [useOpen, setUseOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const focus = useRef<Focus | null>(null);
  const [focusNewItem, setFocusNewItem] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    api<{ document: { title: string; content: DocContent } }>(`/api/documents/${id}`).then(({ document }) => {
      setTitle(document.title); setContent(document.content);
      setTimeout(() => { loaded.current = true; }, 50);
    }).catch((e) => { toast.error(e.message); router.replace("/app/templates?tab=library"); });
  }, [id, router]);

  const save = useCallback(async () => {
    if (!content) return;
    setSaving("saving");
    try { await api(`/api/documents/${id}`, { method: "PATCH", json: { title: title.trim() || "Untitled document", content } }); setSaving("saved"); }
    catch (e) { setSaving("idle"); toast.error((e as Error).message); }
  }, [id, title, content]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
  }, [title, content, save]);

  const vars = useMemo(() => (content ? extractVariables(content) : []), [content]);

  if (!content) return <div className="grid min-h-dvh place-items-center"><Spinner className="h-7 w-7" /></div>;

  const setBlocks = (fn: (b: Block[]) => Block[]) => setContent((c) => (c ? { ...c, blocks: fn(c.blocks) } : c));
  const patchBlock = (bid: string, p: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === bid ? { ...b, ...p } : b)));
  const insertBlock = (type: BlockType, roleId?: string) => {
    const nb = newBlock(type, roleId ?? content.roles[0]?.id);
    setBlocks((bs) => {
      const i = selected ? bs.findIndex((b) => b.id === selected) : -1;
      const at = i >= 0 ? i + 1 : bs.length;
      return [...bs.slice(0, at), nb, ...bs.slice(at)];
    });
    setSelected(nb.id); setSheet(false);
    setTimeout(() => document.querySelector(`[data-block="${nb.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  const move = (bid: string, d: -1 | 1) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === bid); const j = i + d;
    if (i < 0 || j < 0 || j >= bs.length) return bs;
    const c = [...bs]; [c[i], c[j]] = [c[j]!, c[i]!]; return c;
  });
  const duplicate = (bid: string) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === bid); if (i < 0) return bs;
    const copy = JSON.parse(JSON.stringify(bs[i])) as Block; copy.id = uid(8);
    return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)];
  });
  const remove = (bid: string) => { setBlocks((bs) => bs.filter((b) => b.id !== bid)); setSelected(null); };

  /** Insert {{key}} at the last cursor position (or at the end of the selected block). */
  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    let f = focus.current;
    if (!f || !content!.blocks.some((b) => b.id === f!.blockId)) {
      const sel = content!.blocks.find((b) => b.id === selected && ["heading", "subheading", "paragraph", "note"].includes(b.type));
      if (!sel) { toast.message("Click into the text where the field should go, then choose it again."); return; }
      f = { blockId: sel.id, part: "text", start: (sel.text ?? "").length, end: (sel.text ?? "").length };
    }
    const at = f;
    const splice = (v: string) => { const a = Math.min(at.start, v.length), z = Math.min(at.end, v.length); return v.slice(0, a) + token + v.slice(z); };
    setBlocks((bs) => bs.map((b) => {
      if (b.id !== at.blockId) return b;
      if (at.part === "text") return { ...b, text: splice(b.text ?? "") };
      if (at.part.startsWith("item:")) { const k = Number(at.part.slice(5)); const items = [...(b.items ?? [])]; items[k] = splice(items[k] ?? ""); return { ...b, items }; }
      if (at.part.startsWith("cell:")) { const [r, c] = at.part.slice(5).split(",").map(Number) as [number, number]; const rows = (b.rows ?? []).map((row) => [...row]); rows[r]![c] = splice(rows[r]![c] ?? ""); return { ...b, rows }; }
      return b;
    }));
    focus.current = { ...at, start: at.start + token.length, end: at.start + token.length };
    setSheet(false);
  }

  async function previewPdf(values: Record<string, string> = {}, download = false) {
    const w = download ? null : window.open("", "_blank");
    setPreviewing(true);
    try {
      const res = await fetch("/api/documents/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, values, download }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not render PDF");
      const url = URL.createObjectURL(await res.blob());
      if (download) { const a = document.createElement("a"); a.href = url; a.download = `${title || "document"}.pdf`; a.click(); }
      else if (w) w.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { w?.close(); toast.error((e as Error).message); }
    setPreviewing(false);
  }

  const base = FONT_SIZES[content.branding.fontSize];
  // Consecutive signature blocks sit side by side, exactly like the PDF
  const halves = new Set<string>();
  for (let i = 0; i < content.blocks.length; i++) {
    const b = content.blocks[i]!, n = content.blocks[i + 1];
    if (b.type === "signature" && n?.type === "signature") { halves.add(b.id); halves.add(n.id); i++; }
  }
  const px = (pt: number) => `calc(${pt} * var(--pt))`;
  const onFocusEl = (blockId: string, part: string) => (el: HTMLTextAreaElement) => {
    focus.current = { blockId, part, start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length };
    setSelected(blockId);
  };
  const roleOf = (rid?: string) => content.roles.find((r) => r.id === rid);

  const panels: { v: Panel; l: string; icon: typeof Plus }[] = [
    { v: "insert", l: "Insert", icon: Plus }, { v: "fields", l: "Fields", icon: Braces },
    { v: "signers", l: "Signers", icon: Users }, { v: "style", l: "Style", icon: Palette },
  ];

  const panelBody = (
    <div className="space-y-5">
      {panel === "insert" && (
        <div>
          <p className="mb-3 text-xs text-muted">Adds below the selected block.</p>
          <div className="grid grid-cols-2 gap-2">
            {INSERTABLE.map((t) => {
              const I = TYPE_ICON[t];
              return (
                <button key={t} onClick={() => insertBlock(t)} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-xs font-medium transition-colors hover:border-sky-300 hover:bg-surface-2">
                  <I className="h-4 w-4 shrink-0 text-muted" />{BLOCK_LABELS[t]}
                </button>
              );
            })}
          </div>
          <div className="mt-5 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            <p className="font-semibold text-ink">Formatting</p>
            Wrap words in <code className="rounded bg-surface px-1">**double asterisks**</code> for bold. Type <code className="rounded bg-surface px-1">{"{{field_name}}"}</code> anywhere to create a fill-in field.
          </div>
        </div>
      )}
      {panel === "fields" && (
        <FieldsPanel vars={vars} labels={content.variableLabels ?? {}} onInsert={insertVariable}
          onLabel={(k, v) => setContent((c) => (c ? { ...c, variableLabels: { ...(c.variableLabels ?? {}), [k]: v } } : c))} />
      )}
      {panel === "signers" && (
        <SignersPanel roles={content.roles} blocks={content.blocks}
          onChange={(roles) => setContent((c) => (c ? { ...c, roles } : c))}
          onAddBlock={(rid) => insertBlock("signature", rid)}
          onRemoveRole={(rid) => setContent((c) => (c ? { ...c, roles: c.roles.filter((r) => r.id !== rid), blocks: c.blocks.filter((b) => !(b.type === "signature" && b.roleId === rid)) } : c))} />
      )}
      {panel === "style" && <StylePanel content={content} setContent={setContent} />}
    </div>
  );

  return (
    <LabelsCtx.Provider value={content.variableLabels ?? {}}>
    <div className="min-h-dvh bg-surface-2/60">
      <header className="glass sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-3 py-2.5 sm:px-5">
          <Link href="/app/templates?tab=library" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140}
            className="min-w-0 flex-1 truncate rounded-md bg-transparent px-2 py-1 font-display text-base font-semibold outline-none hover:bg-surface-2 focus:bg-surface-2" />
          <span className="hidden items-center gap-1.5 text-xs text-muted md:flex">
            {saving === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving</> : saving === "saved" ? <><CloudCheck className="h-3.5 w-3.5" />Saved</> : null}
          </span>
          <Button variant="ghost" size="sm" onClick={() => previewPdf()} loading={previewing} className="hidden sm:inline-flex"><Eye className="h-4 w-4" />Preview PDF</Button>
          <Button variant="ghost" size="icon" onClick={() => previewPdf({}, true)} title="Download blank PDF" aria-label="Download PDF" className="hidden sm:inline-flex"><Download className="h-4 w-4" /></Button>
          <Button size="sm" onClick={async () => { await save(); setUseOpen(true); }}><Send className="h-4 w-4" /><span className="hidden sm:inline">Send for signing</span><span className="sm:hidden">Send</span></Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[1fr_320px]">
        {/* Paper */}
        <div className="px-2 py-5 sm:px-6 lg:py-8" onClick={() => setSelected(null)}>
          <div className="mx-auto w-full max-w-[820px]" style={{ containerType: "inline-size" }}>
          <div className="w-full rounded-sm bg-white text-slate-900 shadow-[0_1px_3px_rgb(15_23_42/.08),0_12px_32px_-12px_rgb(15_23_42/.18)] ring-1 ring-black/5"
            style={{ ["--pt" as string]: "max(calc(100cqw / 595.28), 1.05px)", padding: `${px(40)} min(${px(64)}, 7cqw) ${px(56)}`, fontFamily: "Helvetica, Arial, sans-serif", minHeight: "calc(100cqw * 1.1)" }}>
            {(content.branding.logo || content.branding.companyName || content.branding.headerText) && (
              <div className="mb-8 flex items-end justify-between border-b-[1.5px] pb-3" style={{ borderColor: content.branding.accent }}>
                <div className="flex items-center gap-2.5">
                  {content.branding.logo && <img src={content.branding.logo} alt="" style={{ height: px(26) }} className="w-auto max-w-[140px] object-contain" />}
                  {content.branding.companyName && <span className="font-bold" style={{ fontSize: px(11) }}>{content.branding.companyName}</span>}
                </div>
                <span className="text-slate-500" style={{ fontSize: px(8.5) }}>{content.branding.headerText}</span>
              </div>
            )}

            <div className="flex flex-wrap">
            {content.blocks.map((b) => {
              const sel = selected === b.id;
              const half = halves.has(b.id);
              return (
                <div key={b.id} data-block={b.id} onClick={(e) => { e.stopPropagation(); setSelected(b.id); }}
                  className={cn("group relative rounded-md transition-colors", half ? "w-1/2 px-1" : "-mx-3 w-[calc(100%+1.5rem)] px-3", sel ? "bg-sky-50 ring-1 ring-sky-300" : "hover:bg-slate-50")}>
                  {sel && (
                    <div className="absolute -top-9 right-0 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-ink shadow-md" onClick={(e) => e.stopPropagation()}>
                      <span className="px-2 text-[11px] font-medium text-muted">{BLOCK_LABELS[b.type]}</span>
                      {(b.type === "heading" || b.type === "paragraph") && (
                        <button className="rounded-md p-1.5 hover:bg-surface-2" title="Alignment" onClick={() => patchBlock(b.id, { align: b.align === "center" ? "left" : "center" })}>
                          {b.align === "center" ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignLeft className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button className="rounded-md p-1.5 hover:bg-surface-2" title="Move up" onClick={() => move(b.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button className="rounded-md p-1.5 hover:bg-surface-2" title="Move down" onClick={() => move(b.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button className="rounded-md p-1.5 hover:bg-surface-2" title="Duplicate" onClick={() => duplicate(b.id)}><Copy className="h-3.5 w-3.5" /></button>
                      <button className="rounded-md p-1.5 text-rose-600 hover:bg-surface-2" title="Delete" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  <BlockView b={b} base={base} px={px} accent={content.branding.accent} role={roleOf(b.roleId)} roles={content.roles}
                    onPatch={(p) => patchBlock(b.id, p)} onFocusEl={(part) => onFocusEl(b.id, part)}
                    focusItem={focusNewItem} setFocusItem={setFocusNewItem} selected={sel} />
                </div>
              );
            })}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setSelected(content.blocks[content.blocks.length - 1]?.id ?? null); setPanel("insert"); setSheet(true); }}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-sky-400 hover:text-sky-700 lg:hidden">
              <Plus className="h-4 w-4" />Add block
            </button>

            <div className="mt-10 flex justify-between border-t border-slate-100 pt-3 text-slate-400" style={{ fontSize: px(7.5) }}>
              <span>{fillVariables(content.branding.footerText, {}, "")}</span>
              {content.branding.pageNumbers && <span>Page 1 of N</span>}
            </div>
          </div>
          </div>
          <p className="mx-auto mt-3 max-w-[820px] text-center text-xs text-muted">The PDF uses the same layout with automatic page breaks. Use <strong>Preview PDF</strong> to see the final pages.</p>
        </div>

        {/* Side panel (desktop) */}
        <aside className="sticky top-[57px] hidden h-[calc(100dvh-57px)] overflow-y-auto border-l border-line bg-surface lg:block">
          <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
            {panels.map((p) => (
              <button key={p.v} onClick={() => setPanel(p.v)} className={cn("relative flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium", panel === p.v ? "text-ink" : "text-muted hover:text-ink")}>
                <p.icon className="h-3.5 w-3.5" />{p.l}
                {panel === p.v && <motion.span layoutId="doc-panel" className="absolute inset-x-2 bottom-0 h-0.5 bg-sky-600" />}
              </button>
            ))}
          </div>
          <div className="p-4">{panelBody}</div>
        </aside>
      </div>

      {/* Mobile toolbar */}
      <div className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 px-2 pt-1">
          {panels.map((p) => (
            <button key={p.v} onClick={() => { setPanel(p.v); setSheet(true); }} className="flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted">
              <p.icon className="h-5 w-5" />{p.l}
            </button>
          ))}
          <button onClick={() => previewPdf()} className="flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted"><Eye className="h-5 w-5" />Preview</button>
        </div>
      </div>
      <div className="h-20 lg:hidden" />
      <Modal open={sheet} onClose={() => setSheet(false)} title={panels.find((p) => p.v === panel)?.l}>{panelBody}</Modal>

      <UseDocumentModal open={useOpen} onClose={() => setUseOpen(false)} docId={id} title={title} content={content} vars={vars}
        onPreview={(values) => previewPdf(values)} onCreated={(eid) => router.push(`/app/envelopes/${eid}/edit?step=review`)} />
    </div>
    </LabelsCtx.Provider>
  );
}

/* ─────────────── block rendering ─────────────── */

function BlockView({ b, base, px, accent, role, roles, onPatch, onFocusEl, focusItem, setFocusItem, selected }: {
  selected: boolean; b: Block; base: number; px: (n: number) => string; accent: string; role?: DocRole; roles: DocRole[];
  onPatch: (p: Partial<Block>) => void; onFocusEl: (part: string) => (el: HTMLTextAreaElement) => void;
  focusItem: string | null; setFocusItem: (s: string | null) => void;
}) {
  const lh = 1.5;
  switch (b.type) {
    case "heading":
      return <AutoText value={b.text ?? ""} onChange={(text) => onPatch({ text })} onFocusEl={onFocusEl("text")} placeholder="Title"
        className={cn("py-1 font-bold leading-tight", b.align === "center" && "text-center")} style={{ fontSize: px(base * 1.9), marginBottom: px(base * 0.6) }} />;
    case "subheading":
      return <AutoText value={b.text ?? ""} onChange={(text) => onPatch({ text })} onFocusEl={onFocusEl("text")} placeholder="Section heading"
        className="py-0.5 font-bold" style={{ fontSize: px(base * 1.15), color: accent, marginTop: px(base * 0.7) }} />;
    case "paragraph":
      return <AutoText value={b.text ?? ""} onChange={(text) => onPatch({ text })} onFocusEl={onFocusEl("text")} placeholder="Start typing…"
        className={cn("py-0.5", b.align === "center" && "text-center")} style={{ fontSize: px(base), lineHeight: lh, marginBottom: px(base * 0.5) }} />;
    case "note":
      return (
        <div className="my-1 border-l-[3px] py-2 pl-3 pr-2" style={{ borderColor: accent, background: `${accent}14` }}>
          <AutoText value={b.text ?? ""} onChange={(text) => onPatch({ text })} onFocusEl={onFocusEl("text")} placeholder="Callout text" style={{ fontSize: px(base * 0.95), lineHeight: lh }} />
        </div>
      );
    case "bullets":
    case "numbered": {
      const items = b.items ?? [""];
      return (
        <div className="py-0.5" style={{ fontSize: px(base), lineHeight: lh }}>
          {items.map((it, k) => {
            const key = `${b.id}:${k}`;
            return (
              <div key={k} className="flex gap-2" style={{ marginBottom: px(base * 0.25) }}>
                <span className="w-5 shrink-0 text-right font-semibold" style={{ color: b.type === "numbered" ? accent : undefined }}>{b.type === "numbered" ? `${k + 1}.` : "•"}</span>
                <AutoText value={it} autoFocus={focusItem === key} placeholder="List item" onFocusEl={(el) => { onFocusEl(`item:${k}`)(el); if (focusItem === key) setFocusItem(null); }}
                  onChange={(v) => { const n = [...items]; n[k] = v; onPatch({ items: n }); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const n = [...items]; n.splice(k + 1, 0, ""); onPatch({ items: n }); setFocusItem(`${b.id}:${k + 1}`); }
                    if (e.key === "Backspace" && !it && items.length > 1) { e.preventDefault(); const n = items.filter((_, j) => j !== k); onPatch({ items: n }); setFocusItem(`${b.id}:${Math.max(0, k - 1)}`); }
                  }} />
              </div>
            );
          })}
        </div>
      );
    }
    case "table": {
      const rows = b.rows ?? [[""]];
      const cols = Math.max(...rows.map((r) => r.length));
      const setCell = (r: number, c: number, v: string) => { const n = rows.map((row) => [...row]); n[r]![c] = v; onPatch({ rows: n }); };
      const header = b.header !== false;
      return (
        <div className="my-1.5">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontSize: px(base * 0.95) }}>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {Array.from({ length: cols }, (_, c) => (
                      <td key={c} className="border border-slate-300 align-top" style={{ background: header && r === 0 ? `${accent}1a` : undefined, width: cols === 2 ? (c === 0 ? "38%" : "62%") : undefined }}>
                        <AutoText value={row[c] ?? ""} onChange={(v) => setCell(r, c, v)} onFocusEl={onFocusEl(`cell:${r},${c}`)}
                          className={cn("px-1.5 py-1", header && r === 0 && "font-bold")} style={{ lineHeight: 1.4 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { l: "+ Row", f: () => onPatch({ rows: [...rows, Array(cols).fill("")] }) },
              { l: "+ Column", f: () => cols < 8 && onPatch({ rows: rows.map((row) => [...row, ""]) }) },
              { l: "− Row", f: () => rows.length > 1 && onPatch({ rows: rows.slice(0, -1) }) },
              { l: "− Column", f: () => cols > 1 && onPatch({ rows: rows.map((row) => row.slice(0, cols - 1)) }) },
              { l: header ? "Header row: on" : "Header row: off", f: () => onPatch({ header: !header }) },
            ].map((x) => <button key={x.l} onClick={(e) => { e.stopPropagation(); x.f(); }} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-sky-300">{x.l}</button>)}
          </div>}
        </div>
      );
    }
    case "divider":
      return <div className="py-3"><div className="h-px bg-slate-300" /></div>;
    case "spacer":
      return <div className="grid h-8 place-items-center text-[10px] uppercase tracking-wider text-slate-300">Space</div>;
    case "pagebreak":
      return <div className="flex items-center gap-2 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400"><span className="h-px flex-1 border-t border-dashed border-slate-300" />Page break<span className="h-px flex-1 border-t border-dashed border-slate-300" /></div>;
    case "signature":
      return (
        <div className="py-3 pr-4" style={{ maxWidth: px(300) }}>
          <select value={b.roleId ?? ""} onChange={(e) => onPatch({ roleId: e.target.value })} onClick={(e) => e.stopPropagation()}
            className="-ml-1 rounded bg-transparent px-1 font-bold uppercase tracking-wide text-slate-500 outline-none hover:bg-slate-100" style={{ fontSize: px(7.5) }}>
            {!role && <option value="">Choose signer…</option>}
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="relative mt-1 flex items-end border-b border-slate-800" style={{ height: px(46), background: role ? `${role.color}0f` : undefined }}>
            <span className="mb-1 ml-1 flex items-center gap-1 text-[10px] font-medium" style={{ color: role?.color ?? "#94a3b8" }}><Signature className="h-3 w-3" />{role?.name ?? "Unassigned"} signs here</span>
          </div>
          <p className="mt-0.5 text-slate-400" style={{ fontSize: px(7) }}>Signature</p>
          <div className="mt-4 border-b border-slate-200" style={{ height: px(14) }} /><p className="mt-0.5 text-slate-400" style={{ fontSize: px(7) }}>Name</p>
          <div className="mt-4 w-3/5 border-b border-slate-200" style={{ height: px(14) }} /><p className="mt-0.5 text-slate-400" style={{ fontSize: px(7) }}>Date</p>
        </div>
      );
  }
}

/* ─────────────── panels ─────────────── */

function FieldsPanel({ vars, labels, onInsert, onLabel }: { vars: string[]; labels: Record<string, string>; onInsert: (k: string) => void; onLabel: (k: string, v: string) => void }) {
  const [name, setName] = useState("");
  const key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">Fill-in fields are completed when you send the document — names, dates, amounts. Click into the text, then choose a field to insert it at the cursor.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (key) { onInsert(key); onLabel(key, name.trim()); setName(""); } }}>
        <input className="input !py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="New field, e.g. Client name" />
        <Button size="sm" type="submit" disabled={!key}>Insert</Button>
      </form>
      <div>
        <p className="label">In this document</p>
        {!vars.length && <p className="text-xs text-muted">No fields yet.</p>}
        <div className="space-y-1.5">
          {vars.map((v) => (
            <div key={v} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={labels[v] ?? humanize(v)} onChange={(e) => onLabel(v, e.target.value)} title="Label shown when filling in" />
              <button onClick={() => onInsert(v)} className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-surface-2 dark:text-sky-400">Insert</button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Automatic</p>
        <div className="space-y-1.5">
          {[...Object.entries(BUILTIN_VARS), ["company_name", "Your company name (from Style)"]].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-2 text-sm">
              <span>{l}</span><button onClick={() => onInsert(k)} className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-surface dark:text-sky-400">Insert</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignersPanel({ roles, blocks, onChange, onAddBlock, onRemoveRole }: {
  roles: DocRole[]; blocks: Block[]; onChange: (r: DocRole[]) => void; onAddBlock: (rid: string) => void; onRemoveRole: (rid: string) => void;
}) {
  const upd = (rid: string, p: Partial<DocRole>) => onChange(roles.map((r) => (r.id === rid ? { ...r, ...p } : r)));
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">Roles are placeholders like “Client” or “Landlord”. You&apos;ll enter the real people when sending. Signature, name and date fields are placed automatically at each signature block.</p>
      {roles.sort((a, b) => a.order - b.order).map((r) => {
        const count = blocks.filter((b) => b.type === "signature" && b.roleId === r.id).length;
        return (
          <div key={r.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
              <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} />
              {roles.length > 1 && <button onClick={() => onRemoveRole(r.id)} className="rounded p-1 text-muted hover:text-rose-500" aria-label="Remove role"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select className="input !w-auto !py-1.5 !text-xs" value={r.role} onChange={(e) => upd(r.id, { role: e.target.value as DocRole["role"] })}>
                <option value="signer">Signs</option><option value="approver">Approves</option><option value="cc">Gets a copy</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-muted">Order <input type="number" min={1} max={20} value={r.order} onChange={(e) => upd(r.id, { order: Math.max(1, Number(e.target.value) || 1) })} className="input !w-14 !px-2 !py-1.5 !text-xs" /></label>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={count ? "text-muted" : "text-amber-600"}>{count ? `${count} signature block${count > 1 ? "s" : ""}` : "No signature block yet"}</span>
              {r.role !== "cc" && <button onClick={() => onAddBlock(r.id)} className="font-medium text-sky-700 dark:text-sky-400">+ Signature block</button>}
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-full" disabled={roles.length >= 10}
        onClick={() => onChange([...roles, { id: uid(6), name: `Signer ${roles.length + 1}`, role: "signer", order: roles.length + 1, color: RECIPIENT_COLORS[roles.length % RECIPIENT_COLORS.length]! }])}>
        <Plus className="h-4 w-4" />Add role
      </Button>
    </div>
  );
}

function StylePanel({ content, setContent }: { content: DocContent; setContent: React.Dispatch<React.SetStateAction<DocContent | null>> }) {
  const b = content.branding;
  const set = (p: Partial<DocContent["branding"]>) => setContent((c) => (c ? { ...c, branding: { ...c.branding, ...p } } : c));
  return (
    <div className="space-y-4">
      <label className="block"><span className="label">Company name</span><input className="input" value={b.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Shown in the header" /></label>
      <div>
        <span className="label">Logo</span>
        <div className="flex items-center gap-3">
          <label className="flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line text-xs text-muted hover:border-sky-300">
            {b.logo ? <img src={b.logo} alt="Logo" className="max-h-10 max-w-[80%] object-contain" /> : <><ImagePlus className="h-4 w-4" />Upload PNG or JPG</>}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              if (f.size > 1_500_000) { toast.error("Logo must be under 1.5 MB"); return; }
              const img = new Image(); const r = new FileReader();
              r.onload = () => { img.onload = () => {
                const scale = Math.min(1, 480 / img.width, 160 / img.height);
                const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
                c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
                set({ logo: c.toDataURL("image/png") });
              }; img.src = String(r.result); };
              r.readAsDataURL(f);
            }} />
          </label>
          {b.logo && <button onClick={() => set({ logo: null })} className="text-xs font-medium text-rose-600">Remove</button>}
        </div>
      </div>
      <div>
        <span className="label">Accent colour</span>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => <button key={c} onClick={() => set({ accent: c })} className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-surface", b.accent === c && "ring-2 ring-slate-400")} style={{ background: c }} aria-label={c} />)}
          <input type="color" value={b.accent} onChange={(e) => set({ accent: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" title="Custom colour" />
        </div>
      </div>
      <label className="block"><span className="label">Header text</span><input className="input" value={b.headerText} onChange={(e) => set({ headerText: e.target.value })} placeholder="e.g. website or reference" /></label>
      <label className="block"><span className="label">Footer text</span><input className="input" value={b.footerText} onChange={(e) => set({ footerText: e.target.value })} placeholder="e.g. Confidential" /></label>
      <div>
        <span className="label">Text size</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface-2 p-1">
          {(["small", "normal", "large"] as const).map((s) => (
            <button key={s} onClick={() => set({ fontSize: s })} className={cn("rounded-md py-1.5 text-xs font-medium capitalize", b.fontSize === s ? "bg-surface text-ink shadow-sm" : "text-muted")}>{s}</button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between rounded-lg border border-line p-3 text-sm">Page numbers
        <input type="checkbox" className="h-4 w-4 accent-sky-600" checked={b.pageNumbers} onChange={(e) => set({ pageNumbers: e.target.checked })} />
      </label>
    </div>
  );
}

/* ─────────────── send / use modal ─────────────── */

interface ContactLite { name: string; email: string }

function UseDocumentModal({ open, onClose, docId, title, content, vars, onPreview, onCreated }: {
  open: boolean; onClose: () => void; docId: string; title: string; content: DocContent; vars: string[];
  onPreview: (values: Record<string, string>) => void; onCreated: (envelopeId: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Record<string, { name: string; email: string }>>({});
  const [envTitle, setEnvTitle] = useState(title);
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<ContactLite[]>([]);
  useEffect(() => { if (open) { setEnvTitle(title); api<{ contacts: ContactLite[] }>("/api/contacts").then((d) => setBook(d.contacts)).catch(() => {}); } }, [open, title]);
  const labels = content.variableLabels ?? {};
  const missing = vars.filter((v) => !values[v]?.trim()).length;

  async function create() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>(`/api/documents/${docId}/envelope`, { method: "POST", json: { values, people, title: envTitle } });
      toast.success("Envelope ready — review and send");
      onCreated(r.id);
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  }
  const setP = (rid: string, p: Partial<{ name: string; email: string }>) => setPeople((s) => {
    const cur = { ...{ name: "", email: "" }, ...s[rid], ...p };
    const em = p.email?.trim().toLowerCase();
    if (em) { const hit = book.find((c) => c.email === em); if (hit && !cur.name) cur.name = hit.name; }
    return { ...s, [rid]: cur };
  });

  return (
    <Modal open={open} onClose={onClose} title="Send for signing" wide
      footer={<>
        <Button variant="ghost" onClick={() => onPreview(values)}><Eye className="h-4 w-4" />Preview filled PDF</Button>
        <Button onClick={create} loading={busy}>Continue to review</Button>
      </>}>
      <div className="space-y-6">
        <label className="block"><span className="label">Envelope title</span><input className="input" value={envTitle} onChange={(e) => setEnvTitle(e.target.value)} /></label>

        {vars.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-semibold">Fill in the details</h3><span className="text-xs text-muted">{missing ? `${missing} left blank` : "All filled"}</span></div>
            <p className="mb-3 text-xs text-muted">Blank fields print as a line to complete by hand.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {vars.map((v) => (
                <label key={v} className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">{labels[v] ?? humanize(v)}</span>
                  <input className="input" value={values[v] ?? ""} onChange={(e) => setValues({ ...values, [v]: e.target.value })} />
                </label>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-3 text-sm font-semibold">Who is signing?</h3>
          <datalist id="contact-book">{book.map((c) => <option key={c.email} value={c.email}>{c.name}</option>)}</datalist>
          <div className="space-y-2">
            {[...content.roles].sort((a, b) => a.order - b.order).map((r) => (
              <div key={r.id} className="rounded-lg border border-line p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name} · {r.role === "cc" ? "copy" : r.role}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="input" placeholder="Email" type="email" list="contact-book" value={people[r.id]?.email ?? ""} onChange={(e) => setP(r.id, { email: e.target.value })} />
                  <input className="input" placeholder="Full name" value={people[r.id]?.name ?? ""} onChange={(e) => setP(r.id, { name: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <p className="text-xs text-muted">Next you&apos;ll see the envelope with signature fields already placed. You can adjust them, add a message and send.</p>
      </div>
    </Modal>
  );
}
