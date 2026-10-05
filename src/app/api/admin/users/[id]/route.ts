import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, forgetDisabled, route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getDb, oid } from "@/lib/db";

const schema = z.object({ emailVerification: z.enum(["inherit", "off", "optional", "required"]).optional(), role: z.enum(["admin", "user"]).optional(), disabled: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional() });

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireAdmin();
  const id = (await params).id;
  const _id = oid(id); if (!_id) throw new HttpError(404, "User not found");
  const p = schema.safeParse(await req.json());
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid input");
  if (id === me.uid && (p.data.disabled || p.data.role === "user")) throw new HttpError(400, "You can't suspend or demote your own account");
  const db = await getDb();
  if (p.data.role === "user") {
    const admins = await db.collection("users").countDocuments({ role: "admin", _id: { $ne: _id } });
    if (!admins && !process.env.ADMIN_EMAILS) throw new HttpError(400, "There must be at least one admin");
  }
  const res = await db.collection("users").updateOne({ _id }, { $set: p.data });
  if (!res.matchedCount) throw new HttpError(404, "User not found");
  forgetDisabled(id);
  return NextResponse.json({ ok: true });
});
