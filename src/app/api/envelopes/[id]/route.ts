import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, route } from "@/lib/auth";
import { deleteFile, getDb } from "@/lib/db";
import { serialize } from "@/lib/envelope";
import { loadOwned, type Ctx } from "@/lib/owned";
import { token as newToken } from "@/lib/utils";
import type { Recipient } from "@/lib/types";
import { applyPolicy, verificationPolicyFor } from "@/lib/verification";

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { env } = await loadOwned((await params).id);
  return NextResponse.json({ envelope: serialize(env) });
});

const recipient = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Every recipient needs a name").max(100),
  email: z.string().trim().toLowerCase().email("Check recipient email addresses"),
  role: z.enum(["signer", "approver", "cc"]),
  order: z.number().int().min(1).max(50),
  color: z.string().max(20),
  accessCode: z.string().trim().max(32).nullable().optional(),
  verifyEmail: z.boolean().optional(),
});
const field = z.object({
  id: z.string().min(1).max(40),
  recipientId: z.string(),
  type: z.enum(["signature", "initials", "date", "name", "email", "text", "checkbox", "company", "title"]),
  page: z.number().int().min(0),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  w: z.number().min(0.005).max(1), h: z.number().min(0.005).max(1),
  required: z.boolean(),
  label: z.string().max(80).optional(),
  value: z.string().max(2000).nullable().optional(),
});
const schema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  message: z.string().max(2000).optional(),
  signingOrder: z.enum(["sequential", "parallel"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reminderDays: z.number().int().min(0).max(30).nullable().optional(),
  recipients: z.array(recipient).max(30).optional(),
  fields: z.array(field).max(500).optional(),
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { env, col } = await loadOwned((await params).id);
  if (env.status !== "draft") throw new HttpError(409, "Only drafts can be edited. Use “Correct” to change a sent envelope.");
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (d.title !== undefined) $set.title = d.title;
  if (d.message !== undefined) $set.message = d.message;
  if (d.signingOrder) $set.signingOrder = d.signingOrder;
  if (d.expiresAt !== undefined) $set.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
  if (d.reminderDays !== undefined) $set.reminderDays = d.reminderDays;
  if (d.recipients) {
    const prev = new Map(env.recipients.map((r) => [r.id, r]));
    const policy = await verificationPolicyFor(env.ownerId);
    $set.recipients = d.recipients.map<Recipient>((r) => ({
      ...r, accessCode: r.accessCode || null,
      verifyEmail: applyPolicy(policy, r, r.verifyEmail === undefined),
      status: "pending", token: prev.get(r.id)?.token ?? newToken(),
    }));
  }
  if (d.fields) {
    const ids = new Set((d.recipients ?? env.recipients).map((r) => r.id));
    $set.fields = d.fields.filter((f) => ids.has(f.recipientId) && f.page < env.pages.length);
  }
  await col.updateOne({ _id: env._id }, { $set });
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { env, col } = await loadOwned((await params).id);
  if (env.status === "sent") throw new HttpError(409, "Void this envelope before deleting it");
  await col.deleteOne({ _id: env._id });
  const db = await getDb();
  await db.collection("audit").deleteMany({ envelopeId: env._id });
  const stillUsed = await db.collection("templates").findOne({ fileId: env.fileId });
  if (!stillUsed) await deleteFile(env.fileId);
  await deleteFile(env.completedFileId);
  return NextResponse.json({ ok: true });
});
