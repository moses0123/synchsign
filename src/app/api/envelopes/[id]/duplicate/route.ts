import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { loadOwned, type Ctx } from "@/lib/owned";
import { readFile, saveFile } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { token } from "@/lib/utils";
import type { Envelope } from "@/lib/types";

export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { env, col, me } = await loadOwned((await params).id);
  const buf = await readFile(env.fileId);
  const fileId = await saveFile(buf, env.fileName, { ownerId: me.oid, kind: "original" });
  const now = new Date();
  const { _id: _omit, ...rest } = env;
  void _omit;
  const copy: Omit<Envelope, "_id"> & { finalizing: boolean } = {
    ...rest, title: `${env.title} (copy)`, status: "draft", fileId, completedFileId: null, completedHash: null,
    recipients: env.recipients.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, order: r.order, color: r.color, accessCode: r.accessCode, status: "pending", token: token() })),
    fields: env.fields.map((f) => ({ ...f, value: null })),
    createdAt: now, updatedAt: now, sentAt: null, finalizing: false, completedAt: null, voidReason: null, expiresAt: null,
  };
  const { insertedId } = await col.insertOne(copy as unknown as Envelope);
  await logAudit(insertedId, "created", { actor: me.name, email: me.email, details: `Duplicated from ${env._id}` });
  return NextResponse.json({ id: insertedId.toString() });
});
