import { NextResponse } from "next/server";
import { HttpError, requireUser, route } from "@/lib/auth";
import { saveFile } from "@/lib/db";
import { envelopes, serialize } from "@/lib/envelope";
import { inspectPdf, sha256 } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";
import { RECIPIENT_COLORS, type Envelope } from "@/lib/types";
import { token, uid } from "@/lib/utils";
import { envelopeDefaults, getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export const GET = route(async (req: Request) => {
  const me = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const filter: Record<string, unknown> = { ownerId: me.oid };
  if (status && status !== "all") {
    if (status === "action") {
      filter.status = "sent";
      filter.recipients = { $elemMatch: { email: me.email, status: { $in: ["sent", "viewed"] } } };
    } else if (status === "waiting") filter.status = "sent";
    else filter.status = status;
  }
  if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const col = await envelopes();
  const list = await col.find(filter, { projection: { fields: 0 } }).sort({ updatedAt: -1 }).limit(200).toArray();
  const now = new Date();
  return NextResponse.json({
    envelopes: list.map((e) => {
      const expired = e.status === "sent" && e.expiresAt && new Date(e.expiresAt) < now;
      return { ...serialize({ ...e, fields: [] } as Envelope), status: expired ? "expired" : e.status };
    }),
  });
});

export const POST = route(async (req: Request) => {
  const me = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  const self = form.get("self") === "1";
  if (!(file instanceof File)) throw new HttpError(400, "Please attach a PDF");
  const { signing } = await getSettings();
  if (file.size > signing.maxUploadMB * 1024 * 1024) throw new HttpError(413, `PDF must be ${signing.maxUploadMB} MB or smaller`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new HttpError(400, "That file isn't a valid PDF");
  let pages;
  try { pages = await inspectPdf(buf); } catch { throw new HttpError(400, "We couldn't read that PDF (it may be encrypted or damaged)"); }
  const title = (String(form.get("title") || "") || file.name.replace(/\.pdf$/i, "")).slice(0, 140);
  const fileId = await saveFile(buf, file.name, { ownerId: me.oid, kind: "original" });
  const now = new Date();
  const doc: Omit<Envelope, "_id"> = {
    ownerId: me.oid, ownerName: me.name, ownerEmail: me.email,
    title, message: "", status: "draft", signingOrder: "sequential",
    fileId, fileName: file.name, completedFileId: null, pages,
    recipients: self ? [{
      id: uid(), name: me.name, email: me.email, role: "signer", order: 1, color: RECIPIENT_COLORS[0]!,
      status: "pending", token: token(), accessCode: null,
    }] : [],
    fields: [], originalHash: sha256(buf), completedHash: null,
    ...(await envelopeDefaults()), tags: self ? ["self-sign"] : [],
    createdAt: now, updatedAt: now,
  };
  const col = await envelopes();
  const { insertedId } = await col.insertOne(doc as Envelope);
  await logAudit(insertedId, "created", { actor: me.name, email: me.email, ip: req.headers.get("x-forwarded-for") ?? undefined, details: `Uploaded ${file.name} (${pages.length} pages)` });
  return NextResponse.json({ id: insertedId.toString() });
});
