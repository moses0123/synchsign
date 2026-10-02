import "server-only";
import { ObjectId } from "mongodb";
import { getDb, readFile, saveFile } from "./db";
import { PDFDocument } from "pdf-lib";
import type { Envelope, Recipient } from "./types";
import { logAudit, getAudit } from "./audit";
import { APP_URL, mails } from "./mail";
import { notifyOwner } from "./notify";
import { buildCertificatePdf, buildSignedPdf, sha256, type AuditRow } from "./pdf";

export const actionable = (r: Recipient) => r.role === "signer" || r.role === "approver";
export const isDone = (r: Recipient) => r.status === "signed" || r.status === "approved";
export const signLink = (r: Recipient) => `${APP_URL()}/sign/${r.token}`;

export async function envelopes() {
  return (await getDb()).collection<Envelope>("envelopes");
}

/** Serialize for the owner's UI */
export function serialize(e: Envelope) {
  return {
    ...e,
    _id: e._id.toString(),
    ownerId: e.ownerId.toString(),
    fileId: e.fileId.toString(),
    completedFileId: e.completedFileId?.toString() ?? null,
    certificateFileId: e.certificateFileId?.toString() ?? null,
    recipients: e.recipients.map((r) => ({ ...r, link: signLink(r) })),
  };
}
export type SerializedEnvelope = ReturnType<typeof serialize>;

/** Activate whichever recipients should be acting now and notify them. */
export async function dispatch(env: Envelope) {
  const col = await envelopes();
  const pending = env.recipients.filter((r) => actionable(r) && !isDone(r));
  let active: Recipient[];
  if (env.signingOrder === "parallel") active = pending;
  else {
    const min = Math.min(...pending.map((r) => r.order));
    active = pending.filter((r) => r.order === min);
  }
  const now = new Date();
  for (const r of active) {
    if (r.status !== "pending") continue;
    r.status = "sent";
    r.sentAt = now;
    // It's this person's turn: email them their personal signing link
    const emailed = await mails.invite(r.email, r.name, env.ownerName, env.title, env.message, signLink(r), r.role);
    await logAudit(env._id, "delivered", {
      actor: r.name, email: r.email,
      details: emailed ? `Signing link emailed (${r.role})` : `Their turn (${r.role}) — email NOT sent; see Admin → Email log. Share the link manually.`,
    });
  }
  await col.updateOne({ _id: env._id }, { $set: { recipients: env.recipients, updatedAt: now } });
  return env;
}

export async function finalize(env: Envelope) {
  const col = await envelopes();
  env.completedAt = new Date();
  env.status = "completed";
  const original = await readFile(env.fileId);
  const audit = await getAudit(env._id);
  let signed: Buffer, cert: Buffer, hash: string;
  try {
    signed = await buildSignedPdf(env, original, APP_URL());
    hash = sha256(signed);
    const rows = [...audit, { action: "completed", at: env.completedAt, actor: "SyncSign", details: "All parties completed" }] as AuditRow[];
    cert = await buildCertificatePdf(env, rows, APP_URL(), hash);
  } catch (e) {
    await col.updateOne({ _id: env._id }, { $set: { finalizing: false } } as never);
    throw e;
  }
  const fid = await saveFile(signed, `${env.title} (signed).pdf`, { envelopeId: env._id, kind: "final" });
  const cid = await saveFile(cert, `${env.title} (certificate).pdf`, { envelopeId: env._id, kind: "certificate" });
  const certificateHash = sha256(cert);
  await col.updateOne({ _id: env._id }, { $set: { status: "completed", completedAt: env.completedAt, completedFileId: fid, certificateFileId: cid, completedHash: hash, certificateHash, updatedAt: new Date() } });
  await logAudit(env._id, "completed", { actor: "SyncSign", details: `Final SHA-256 ${hash}` });
  await notifyOwner(env, "completed", "All parties");

  const notified = new Set<string>();
  for (const r of env.recipients) {
    if (notified.has(r.email)) continue;
    notified.add(r.email);
    await mails.completed(r.email, r.name, env.title, `${signLink(r)}?done=1`);
  }
  if (!notified.has(env.ownerEmail)) await mails.completed(env.ownerEmail, env.ownerName, env.title, `${APP_URL()}/app/envelopes/${env._id}`);
}

export async function findByToken(token: string) {
  const col = await envelopes();
  const env = await col.findOne({ "recipients.token": token });
  if (!env) return null;
  const r = env.recipients.find((x) => x.token === token)!;
  return { env, r };
}

/** Mark expired envelopes (called lazily and by cron) */
export async function expireIfNeeded(env: Envelope) {
  if (env.status === "sent" && env.expiresAt && new Date(env.expiresAt) < new Date()) {
    const col = await envelopes();
    await col.updateOne({ _id: env._id }, { $set: { status: "expired", updatedAt: new Date() } });
    await logAudit(env._id, "expired", { actor: "SyncSign" });
    await notifyOwner(env, "expired", "SyncSign");
    env.status = "expired";
  }
  return env;
}

export function ownerFilter(id: ObjectId, ownerId: ObjectId) {
  return { _id: id, ownerId };
}

/**
 * Envelopes completed by older versions stored the certificate as extra pages inside the signed PDF.
 * Split those once into a clean signed document + a separate certificate file.
 */
export async function ensureSeparated(env: Envelope) {
  if (env.status !== "completed" || !env.completedFileId || env.certificateFileId) return env;
  try {
    const combined = await readFile(env.completedFileId);
    const src = await PDFDocument.load(combined, { ignoreEncryption: true });
    const n = env.pages.length;
    const total = src.getPageCount();
    if (total <= n) return env; // nothing appended
    const make = async (idx: number[], title: string) => {
      const d = await PDFDocument.create();
      (await d.copyPages(src, idx)).forEach((p) => d.addPage(p));
      d.setTitle(title); d.setProducer("SyncSign"); d.setCreator("SyncSign");
      return Buffer.from(await d.save());
    };
    const signed = await make([...Array(n).keys()], env.title);
    const cert = await make(Array.from({ length: total - n }, (_, i) => n + i), `Certificate of Completion – ${env.title}`);
    const fid = await saveFile(signed, `${env.title} (signed).pdf`, { envelopeId: env._id, kind: "final" });
    const cid = await saveFile(cert, `${env.title} (certificate).pdf`, { envelopeId: env._id, kind: "certificate" });
    const set = {
      completedFileId: fid, certificateFileId: cid, completedHash: sha256(signed), certificateHash: sha256(cert),
      legacyCompletedFileId: env.completedFileId, legacyCompletedHash: env.completedHash ?? null,
    };
    const col = await envelopes();
    const res = await col.updateOne({ _id: env._id, certificateFileId: { $in: [null, undefined] } } as never, { $set: set } as never);
    if (res.modifiedCount) Object.assign(env, set);
    else { const fresh = await col.findOne({ _id: env._id }); if (fresh) Object.assign(env, fresh); }
  } catch (e) {
    console.error("Could not separate certificate", e);
  }
  return env;
}
