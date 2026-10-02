// Shared (client + server) model for documents built inside SyncSign.
import type { RecipientRole } from "./types";

export type BlockType =
  | "heading" | "subheading" | "paragraph" | "bullets" | "numbered"
  | "table" | "divider" | "spacer" | "pagebreak" | "signature" | "note";

export interface Block {
  id: string;
  type: BlockType;
  text?: string;          // heading / subheading / paragraph / note
  items?: string[];       // bullets / numbered
  rows?: string[][];      // table (first row = header)
  roleId?: string;        // signature
  align?: "left" | "center";
  header?: boolean;       // table: style first row as a header (default true)
}

export interface DocRole { id: string; name: string; role: RecipientRole; order: number; color: string }

export interface DocBranding {
  companyName: string;
  logo: string | null;       // data URL (png/jpeg)
  accent: string;            // hex
  headerText: string;
  footerText: string;
  pageNumbers: boolean;
  fontSize: "small" | "normal" | "large";
}

export interface DocContent {
  blocks: Block[];
  roles: DocRole[];
  branding: DocBranding;
  variableLabels?: Record<string, string>;
}

export const DEFAULT_BRANDING: DocBranding = {
  companyName: "", logo: null, accent: "#0284c7", headerText: "", footerText: "Confidential", pageNumbers: true, fontSize: "normal",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Title", subheading: "Section heading", paragraph: "Paragraph", bullets: "Bulleted list", numbered: "Numbered list",
  table: "Table", divider: "Divider", spacer: "Spacer", pagebreak: "Page break", signature: "Signature block", note: "Callout",
};

const VAR_RE = /\{\{\s*([a-zA-Z][\w.]*)\s*\}\}/g;
export const BUILTIN_VARS: Record<string, string> = { today: "Today's date" };

export function blockTexts(b: Block): string[] {
  return [b.text ?? "", ...(b.items ?? []), ...(b.rows ?? []).flat()];
}

/** All {{variables}} used in the document, in first-seen order (built-ins excluded). */
export function extractVariables(c: Pick<DocContent, "blocks">): string[] {
  const seen = new Set<string>();
  for (const b of c.blocks) for (const t of blockTexts(b)) for (const m of t.matchAll(VAR_RE)) if (!(m[1]! in BUILTIN_VARS)) seen.add(m[1]!);
  return [...seen];
}

export function humanize(key: string) {
  return key.replace(/[._]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fillVariables(text: string, values: Record<string, string>, blank = "____________") {
  return text.replace(VAR_RE, (_, k: string) => {
    if (k === "today") return values.today || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const v = values[k]?.trim();
    return v ? v : blank;
  });
}

/** Split "**bold** text" into runs. */
export function runs(text: string): { t: string; b: boolean }[] {
  const out: { t: string; b: boolean }[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) out.push({ t: p.slice(2, -2), b: true });
    else out.push({ t: p, b: false });
  }
  return out;
}

export const FONT_SIZES = { small: 9.5, normal: 10.5, large: 12 } as const;
