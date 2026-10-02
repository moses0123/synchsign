import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { FONT_SIZES, fillVariables, runs, type DocContent } from "./doc-model";
import type { FieldType } from "./types";

export interface PlacedField { roleId: string; type: FieldType; page: number; x: number; y: number; w: number; h: number }

const A4 = { w: 595.28, h: 841.89 };
const ML = 64, MR = 64, MB = 64;

function hex(h: string): RGB {
  const n = parseInt((h || "#0284c7").replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
function tint(c: RGB, t: number): RGB {
  return rgb(c.red + (1 - c.red) * t, c.green + (1 - c.green) * t, c.blue + (1 - c.blue) * t);
}

const INK = rgb(0.09, 0.12, 0.18);
const MUTED = rgb(0.42, 0.47, 0.55);
const RULE = rgb(0.8, 0.84, 0.89);

export async function renderDocument(content: DocContent, values: Record<string, string>, opts: { title: string; blank?: string }) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const br = content.branding;
  const accent = hex(br.accent);
  const base = FONT_SIZES[br.fontSize] ?? FONT_SIZES.normal;
  const LH = 1.5;
  const W = A4.w - ML - MR;
  const fields: PlacedField[] = [];
  const blank = opts.blank ?? "____________";

  const safe = (f: PDFFont, s: string) => {
    let out = "";
    for (const ch of s.replace(/\t/g, "  ")) { try { f.encodeText(ch); out += ch; } catch { out += "?"; } }
    return out;
  };
  values = { company_name: content.branding.companyName, ...values };
  const fill = (t: string) => fillVariables(t, values, blank);

  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (br.logo?.startsWith("data:image/")) {
    try {
      const bytes = Buffer.from(br.logo.split(",")[1] ?? "", "base64");
      logo = br.logo.startsWith("data:image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch { logo = null; }
  }
  const hasHeader = Boolean(logo || br.companyName || br.headerText);
  const topMargin = hasHeader ? 104 : 64;

  let page: PDFPage = null!;
  let pageIndex = -1;
  let y = 0;

  const drawHeader = (p: PDFPage) => {
    if (!hasHeader) return;
    const top = A4.h - 40;
    let x = ML;
    if (logo) {
      const h = 26, w = Math.min(120, (logo.width / logo.height) * h);
      p.drawImage(logo, { x, y: top - h, width: w, height: h });
      x += w + 10;
    }
    if (br.companyName) p.drawText(safe(bold, br.companyName), { x, y: top - 17, size: 11, font: bold, color: INK });
    if (br.headerText) {
      const t = safe(regular, br.headerText);
      const tw = regular.widthOfTextAtSize(t, 8.5);
      p.drawText(t, { x: A4.w - MR - tw, y: top - 16, size: 8.5, font: regular, color: MUTED });
    }
    p.drawLine({ start: { x: ML, y: top - 36 }, end: { x: A4.w - MR, y: top - 36 }, thickness: 1.2, color: accent });
  };
  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    pageIndex++;
    drawHeader(page);
    y = A4.h - topMargin;
  };
  const ensure = (h: number) => { if (y - h < MB) newPage(); };
  newPage();

  type Run = { t: string; b: boolean };
  const fontOf = (b: boolean, it?: boolean) => (b ? bold : it ? italic : regular);

  /** Word-wrap rich runs into lines of (text, bold) segments. */
  function wrap(text: string, size: number, maxW: number, forceBold = false, it = false): Run[][] {
    const lines: Run[][] = [];
    for (const para of text.split("\n")) {
      let line: Run[] = []; let lw = 0;
      const tokens: Run[] = [];
      for (const r of runs(para)) for (const part of r.t.split(/(\s+)/)) if (part) tokens.push({ t: part, b: forceBold || r.b });
      for (const tok of tokens) {
        const f = fontOf(tok.b, it); const t = safe(f, tok.t);
        const w = f.widthOfTextAtSize(t, size);
        if (/^\s+$/.test(t)) { if (line.length) { line.push({ t: " ", b: tok.b }); lw += f.widthOfTextAtSize(" ", size); } continue; }
        if (lw + w > maxW && line.length) {
          while (line.length && line[line.length - 1]!.t === " ") line.pop();
          lines.push(line); line = []; lw = 0;
        }
        // very long single word: hard-split
        if (w > maxW) {
          let chunk = "";
          for (const ch of t) { if (f.widthOfTextAtSize(chunk + ch, size) > maxW) { lines.push([{ t: chunk, b: tok.b }]); chunk = ""; } chunk += ch; }
          line = [{ t: chunk, b: tok.b }]; lw = f.widthOfTextAtSize(chunk, size); continue;
        }
        line.push({ t, b: tok.b }); lw += w;
      }
      while (line.length && line[line.length - 1]!.t === " ") line.pop();
      lines.push(line);
    }
    return lines;
  }
  const lineWidth = (l: Run[], size: number, it = false) => l.reduce((a, r) => a + fontOf(r.b, it).widthOfTextAtSize(r.t, size), 0);
  function drawLine(l: Run[], x: number, yy: number, size: number, color: RGB = INK, it = false) {
    let cx = x;
    for (const r of l) { const f = fontOf(r.b, it); page.drawText(r.t, { x: cx, y: yy, size, font: f, color }); cx += f.widthOfTextAtSize(r.t, size); }
  }
  function paragraph(text: string, o: { size?: number; x?: number; w?: number; bold?: boolean; color?: RGB; align?: "left" | "center"; after?: number; italic?: boolean } = {}) {
    const size = o.size ?? base; const x = o.x ?? ML; const w = o.w ?? W;
    const lines = wrap(fill(text), size, w, o.bold, o.italic);
    for (const l of lines) {
      ensure(size * LH);
      const lx = o.align === "center" ? x + (w - lineWidth(l, size, o.italic)) / 2 : x;
      drawLine(l, lx, y - size, size, o.color ?? INK, o.italic);
      y -= size * LH;
    }
    y -= o.after ?? base * 0.7;
  }

  const blocks = content.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    switch (b.type) {
      case "heading":
        ensure(base * 4);
        paragraph(b.text ?? "", { size: base * 1.9, bold: true, align: b.align ?? "center", after: base * 1.1 });
        break;
      case "subheading":
        ensure(base * 5); // keep with next line
        y -= base * 0.5;
        paragraph(b.text ?? "", { size: base * 1.15, bold: true, color: accent, after: base * 0.45 });
        break;
      case "paragraph":
        paragraph(b.text ?? "", { align: b.align });
        break;
      case "note": {
        const size = base * 0.95; const pad = 10;
        const lines = wrap(fill(b.text ?? ""), size, W - pad * 2 - 4);
        const h = lines.length * size * LH + pad * 2 - size * 0.4;
        ensure(h + 6);
        page.drawRectangle({ x: ML, y: y - h, width: W, height: h, color: tint(accent, 0.92) });
        page.drawRectangle({ x: ML, y: y - h, width: 3, height: h, color: accent });
        let ly = y - pad;
        for (const l of lines) { drawLine(l, ML + pad + 4, ly - size, size); ly -= size * LH; }
        y -= h + base * 0.9;
        break;
      }
      case "bullets":
      case "numbered": {
        const items = b.items ?? [];
        items.forEach((it, k) => {
          const marker = b.type === "bullets" ? "•" : `${k + 1}.`;
          const lines = wrap(fill(it), base, W - 22);
          lines.forEach((l, j) => {
            ensure(base * LH);
            if (j === 0) page.drawText(marker, { x: ML + 4, y: y - base, size: base, font: b.type === "numbered" ? bold : regular, color: b.type === "numbered" ? accent : INK });
            drawLine(l, ML + 22, y - base, base);
            y -= base * LH;
          });
          y -= base * 0.25;
        });
        y -= base * 0.5;
        break;
      }
      case "table": {
        const rows = (b.rows ?? []).filter((r) => r.length);
        if (!rows.length) break;
        const cols = Math.max(...rows.map((r) => r.length));
        const widths = cols === 2 ? [W * 0.38, W * 0.62] : Array.from({ length: cols }, () => W / cols);
        const size = base * 0.95, pad = 6;
        rows.forEach((r, ri) => {
          const header = b.header !== false && ri === 0 && cols > 1 && rows.length > 1;
          const cells = widths.map((cw, ci) => wrap(fill(r[ci] ?? ""), size, cw - pad * 2, header));
          const h = Math.max(...cells.map((c) => c.length)) * size * LH + pad * 2 - size * 0.4;
          ensure(h);
          let cx = ML;
          cells.forEach((c, ci) => {
            const cw = widths[ci]!;
            page.drawRectangle({ x: cx, y: y - h, width: cw, height: h, color: header ? tint(accent, 0.9) : ri % 2 === 0 ? rgb(0.985, 0.988, 0.992) : rgb(1, 1, 1), borderColor: RULE, borderWidth: 0.6 });
            let ly = y - pad;
            for (const l of c) { drawLine(l, cx + pad, ly - size, size, INK); ly -= size * LH; }
            cx += cw;
          });
          y -= h;
        });
        y -= base * 1.1;
        break;
      }
      case "divider":
        ensure(base * 2);
        y -= base * 0.6;
        page.drawLine({ start: { x: ML, y }, end: { x: A4.w - MR, y }, thickness: 0.7, color: RULE });
        y -= base * 1.2;
        break;
      case "spacer":
        y -= base * 2;
        break;
      case "pagebreak":
        newPage();
        break;
      case "signature": {
        // Pair consecutive signature blocks side by side
        const group = [b];
        if (blocks[i + 1]?.type === "signature") { group.push(blocks[i + 1]!); i++; }
        const gap = 28;
        const colW = group.length === 2 ? (W - gap) / 2 : Math.min(W, 260);
        const H = 128;
        ensure(H + 8);
        y -= base * 0.6;
        group.forEach((g, gi) => {
          const x = ML + gi * (colW + gap);
          const r = content.roles.find((ro) => ro.id === g.roleId);
          const label = safe(bold, (r?.name ?? "Signer").toUpperCase());
          page.drawText(label, { x, y: y - 9, size: 7.5, font: bold, color: MUTED });
          const sigTop = y - 16, sigH = 46, sigW = Math.min(colW, 220);
          page.drawLine({ start: { x, y: sigTop - sigH }, end: { x: x + colW, y: sigTop - sigH }, thickness: 0.8, color: INK });
          page.drawText("Signature", { x, y: sigTop - sigH - 10, size: 7, font: regular, color: MUTED });
          const nameY = sigTop - sigH - 34;
          page.drawLine({ start: { x, y: nameY }, end: { x: x + colW, y: nameY }, thickness: 0.5, color: RULE });
          page.drawText("Name", { x, y: nameY - 9, size: 7, font: regular, color: MUTED });
          const dateY = nameY - 30;
          page.drawLine({ start: { x, y: dateY }, end: { x: x + colW * 0.6, y: dateY }, thickness: 0.5, color: RULE });
          page.drawText("Date", { x, y: dateY - 9, size: 7, font: regular, color: MUTED });
          if (g.roleId) {
            const toF = (fx: number, fyTop: number, fw: number, fh: number) => ({ x: fx / A4.w, y: (A4.h - fyTop) / A4.h, w: fw / A4.w, h: fh / A4.h });
            fields.push({ roleId: g.roleId, type: "signature", page: pageIndex, ...toF(x, sigTop - 2, sigW, sigH - 3) });
            fields.push({ roleId: g.roleId, type: "name", page: pageIndex, ...toF(x, nameY + 17, Math.min(colW, 220), 15) });
            fields.push({ roleId: g.roleId, type: "date", page: pageIndex, ...toF(x, dateY + 17, Math.min(colW * 0.6, 140), 15) });
          }
        });
        y -= H;
        break;
      }
    }
  }

  // Footer + page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (br.footerText) p.drawText(safe(regular, fill(br.footerText)), { x: ML, y: 34, size: 7.5, font: regular, color: MUTED });
    if (br.pageNumbers) {
      const t = `Page ${i + 1} of ${pages.length}`;
      p.drawText(t, { x: A4.w - MR - regular.widthOfTextAtSize(t, 7.5), y: 34, size: 7.5, font: regular, color: MUTED });
    }
  });

  doc.setTitle(opts.title);
  doc.setProducer("SyncSign");
  doc.setCreator("SyncSign Document Builder");
  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), pages: pages.map(() => ({ w: A4.w, h: A4.h })), fields };
}
