import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { HttpError, requireUser, route } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { User } from "@/lib/types";

export const POST = route(async (req: Request) => {
  const me = await requireUser();
  const { current = "", next = "" } = (await req.json()) as { current?: string; next?: string };
  if (next.length < 8) throw new HttpError(400, "New password must be at least 8 characters");
  const db = await getDb();
  const u = await db.collection<User>("users").findOne({ _id: me.oid });
  if (!u || !(await bcrypt.compare(current, u.passwordHash))) throw new HttpError(400, "Your current password is incorrect");
  await db.collection("users").updateOne({ _id: me.oid }, { $set: { passwordHash: await bcrypt.hash(next, 11), passwordChangedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
