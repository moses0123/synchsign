import "server-only";
import { HttpError, requireUser } from "./auth";
import { getDb, oid } from "./db";
import type { Envelope, Template } from "./types";
import { token, uid } from "./utils";

export async function loadTemplate(id: string) {
  const me = await requireUser();
  const _id = oid(id);
  if (!_id) throw new HttpError(404, "Template not found");
  const db = await getDb();
  const col = db.collection<Template>("templates");
  const t = await col.findOne({ _id, ownerId: me.oid });
  if (!t) throw new HttpError(404, "Template not found");
  return { me, t, col, db };
}

export function envelopeFromTemplate(
  t: Template, me: { oid: Template["ownerId"]; name: string; email: string },
  people: Record<string, { name: string; email: string }>, originalHash: string, title?: string,
  defaults: { reminderDays: number | null; expiresAt: Date | null; verifyEmail?: boolean } = { reminderDays: 3, expiresAt: null },
): Omit<Envelope, "_id"> {
  const idMap = new Map<string, string>();
  const recipients = t.roles.map((role) => {
    const p = people[role.id];
    if (!p?.name || !p?.email) throw new HttpError(400, `Fill in a name and email for “${role.name}”`);
    const id = uid(); idMap.set(role.id, id);
    return { id, name: p.name.trim(), email: p.email.trim().toLowerCase(), role: role.role, order: role.order, color: role.color, status: "pending" as const, token: token(), accessCode: null, verifyEmail: role.role !== "cc" && Boolean(defaults.verifyEmail) };
  });
  const now = new Date();
  return {
    ownerId: me.oid, ownerName: me.name, ownerEmail: me.email,
    title: title || t.name, message: t.message, status: "draft", signingOrder: t.signingOrder,
    fileId: t.fileId, fileName: t.fileName, completedFileId: null, pages: t.pages,
    recipients, fields: t.fields.map((f) => ({ ...f, id: uid(), recipientId: idMap.get(f.recipientId) ?? f.recipientId, value: null })),
    originalHash, completedHash: null, expiresAt: defaults.expiresAt, reminderDays: defaults.reminderDays, tags: ["template"],
    createdAt: now, updatedAt: now,
  };
}
