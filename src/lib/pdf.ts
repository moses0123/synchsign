import "server-only";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { createHash } from "node:crypto";
import type { Envelope, Field } from "./types";

export const sha256 = (b: Uint8Array | Buffer) => createHash("sha256").update(b).digest("hex");

export async function inspectPdf(buf: Buffer) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    const rot = p.getRotation().angle % 180 !== 0;
    return rot ? { w: height, h: width } : { w: width, h: height };
  });
}

const safe = (font: PDFFont, s: string) => {
  let out = "";
  for (const ch of s) {
    try { font.encodeText(ch); out += ch; } catch { out += "?"; }
  }
  return out;
};

function fitText(font: PDFFont, text: string, maxW: number, maxSize: number) {
  let size = maxSize;
  while (size > 5 && font.widthOfTextAtSize(text, size) > maxW) size -= 0.5;
  return size;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function stampField(doc: PDFDocument, page: PDFPage, f: Field, font: PDFFont) {
  if (!f.value) return;
  const { width: W, height: H } = page.getSize();
  const x = f.x * W, w = f.w * W, h = f.h * H;
  const y = H - (f.y + f.h) * H;

  if ((f.type === "signature" || f.type === "initials") && f.value.startsWith("data:image")) {
    const b64 = f.value.split(",")[1] ?? "";
    const bytes = Buffer.from(b64, "base64");
    const img = f.value.startsWith("data:image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const scale = Math.min(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
    // subtle bracket like a verified stamp
    page.drawLine({ start: { x, y: y - 1 }, end: { x: x + w, y: y - 1 }, thickness: 0.6, color: rgb(0.05, 0.55, 0.85), opacity: 0.8 });
    return;
  }
  if (f.type === "checkbox") {
    if (f.value !== "true") return;
    const s = Math.min(w, h);
    const cx = x + (w - s) / 2, cy = y + (h - s) / 2;
    page.drawLine({ start: { x: cx + s * 0.18, y: cy + s * 0.5 }, end: { x: cx + s * 0.42, y: cy + s * 0.22 }, thickness: Math.max(1, s * 0.12), color: rgb(0.03, 0.18, 0.29) });
    page.drawLine({ start: { x: cx + s * 0.42, y: cy + s * 0.22 }, end: { x: cx + s * 0.85, y: cy + s * 0.8 }, thickness: Math.max(1, s * 0.12), color: rgb(0.03, 0.18, 0.29) });
    return;
  }
  const text = safe(font, f.value);
  const size = fitText(font, text, w - 4, Math.min(h * 0.62, 13));
  page.drawText(text, { x: x + 2, y: y + (h - size) / 2 + size * 0.18, size, font, color: rgb(0.03, 0.18, 0.29) });
}

export type AuditRow = { action: string; at: Date; actor?: string; email?: string; ip?: string; details?: string };

/** The signed document on its own: original pages with every field value burned in. */
export async function buildSignedPdf(env: Envelope, original: Buffer, appUrl: string) {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const envId = env._id.toString();

  for (const f of env.fields) {
    const p = pages[f.page];
    if (p) await stampField(doc, p, f, font);
  }
  for (const p of pages) {
    const { height } = p.getSize();
    p.drawText(`SyncSign Envelope ID: ${envId}  ·  Verify: ${appUrl}/verify/${envId}`, { x: 14, y: height - 12, size: 6.5, font, color: rgb(0.35, 0.45, 0.55) });
  }
  doc.setTitle(env.title);
  doc.setProducer("SyncSign");
  doc.setCreator("SyncSign");
  return Buffer.from(await doc.save());
}

/** A standalone Certificate of Completion, linked to the signed document by its SHA-256. */
export async function buildCertificatePdf(env: Envelope, audit: AuditRow[], appUrl: string, signedHash: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const envId = env._id.toString();
  const verifyUrl = `${appUrl}/verify/${envId}`;
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 240, color: { dark: "#0c4a6e", light: "#ffffff" } });
  const qr = await doc.embedPng(qrPng);

  const A4 = { w: 595.28, h: 841.89 };
  let page = doc.addPage([A4.w, A4.h]);
  const M = 44;
  let y = A4.h - M;
  const sky = rgb(0.055, 0.647, 0.914);
  const ink = rgb(0.03, 0.18, 0.29);
  const mut = rgb(0.39, 0.45, 0.55);

  const newPage = () => { page = doc.addPage([A4.w, A4.h]); y = A4.h - M; };
  const ensure = (need: number) => { if (y - need < M) newPage(); };
  const text = (s: string, o: { x?: number; size?: number; f?: PDFFont; c?: ReturnType<typeof rgb>; maxW?: number } = {}) => {
    const f = o.f ?? font; const size = o.size ?? 9;
    let t = safe(f, s);
    if (o.maxW) while (t.length > 3 && f.widthOfTextAtSize(t, size) > o.maxW) t = t.slice(0, -4) + "...";
    page.drawText(t, { x: o.x ?? M, y, size, font: f, color: o.c ?? ink });
  };

  page.drawRectangle({ x: 0, y: A4.h - 96, width: A4.w, height: 96, color: sky });
  page.drawText("SyncSign", { x: M, y: A4.h - 50, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Certificate of Completion", { x: M, y: A4.h - 72, size: 12, font, color: rgb(0.94, 0.98, 1) });
  page.drawImage(qr, { x: A4.w - M - 78, y: A4.h - 90, width: 78, height: 78 });
  y = A4.h - 128;

  const kv = (k: string, v: string) => { ensure(14); text(k, { f: bold, size: 8.5, c: mut }); text(v, { x: M + 120, size: 8.5, maxW: A4.w - M * 2 - 120 }); y -= 14; };
  text("Envelope summary", { f: bold, size: 12 }); y -= 18;
  kv("Document", env.title);
  kv("Envelope ID", envId);
  kv("Sender", `${env.ownerName} <${env.ownerEmail}>`);
  kv("Created", env.createdAt.toUTCString());
  kv("Completed", (env.completedAt ?? new Date()).toUTCString());
  kv("Pages", String(env.pages.length));
  kv("Signing order", env.signingOrder === "sequential" ? "Sequential" : "Parallel");
  kv("Original SHA-256", env.originalHash);
  kv("Signed doc SHA-256", signedHash);
  kv("Verify at", verifyUrl);
  y -= 10;

  ensure(40);
  text("Recipients", { f: bold, size: 12 }); y -= 18;
  for (const r of env.recipients) {
    ensure(52);
    page.drawRectangle({ x: M, y: y - 34, width: A4.w - M * 2, height: 44, color: rgb(0.94, 0.976, 1), borderColor: rgb(0.73, 0.9, 0.99), borderWidth: 0.6 });
    page.drawRectangle({ x: M, y: y - 34, width: 3, height: 44, color: hexToRgb(r.color) });
    text(`${r.name}  <${r.email}>`, { x: M + 12, f: bold, size: 9.5, maxW: 330 });
    text(r.role.toUpperCase() + " · " + r.status.toUpperCase(), { x: A4.w - M - 150, size: 8, c: sky, f: bold });
    y -= 14;
    text(`Sent: ${r.sentAt ? new Date(r.sentAt).toUTCString() : "—"}    Viewed: ${r.viewedAt ? new Date(r.viewedAt).toUTCString() : "—"}`, { x: M + 12, size: 7.5, c: mut });
    y -= 11;
    text(`Completed: ${r.completedAt ? new Date(r.completedAt).toUTCString() : "—"}    IP: ${r.ip ?? "—"}    Access code: ${r.accessCode ? "required" : "none"}`, { x: M + 12, size: 7.5, c: mut });
    y -= 30;
  }

  ensure(40);
  text("Audit trail", { f: bold, size: 12 }); y -= 18;
  for (const a of audit) {
    ensure(26);
    text(new Date(a.at).toISOString().replace("T", " ").slice(0, 19) + " UTC", { size: 7.5, c: mut });
    text(a.action.replace("_", " ").toUpperCase(), { x: M + 110, size: 7.5, f: bold, c: sky });
    text(`${a.actor ?? ""}${a.email ? ` <${a.email}>` : ""}${a.ip ? `  ·  IP ${a.ip}` : ""}`, { x: M + 190, size: 7.5, maxW: A4.w - M * 2 - 190 });
    y -= 11;
    if (a.details) { text(a.details, { x: M + 190, size: 7, c: mut, maxW: A4.w - M * 2 - 190 }); y -= 11; }
    y -= 3;
  }
  y -= 12; ensure(40);
  text("This certificate accompanies the signed document identified by the SHA-256 above. Any change to that", { size: 7.5, c: mut }); y -= 10;
  text("document alters its fingerprint and causes verification at the URL above to fail.", { size: 7.5, c: mut });

  doc.setTitle(`Certificate of Completion – ${env.title}`);
  doc.setProducer("SyncSign");
  doc.setCreator("SyncSign");
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
