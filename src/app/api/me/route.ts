import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, requireUser, route, setSessionCookie } from "@/lib/auth";
import type { User } from "@/lib/types";
import { isAdmin } from "@/lib/admin";

export const GET = route(async () => {
  const me = await requireUser();
  const db = await getDb();
  const u = await db.collection<User>("users").findOne({ _id: me.oid }, { projection: { passwordHash: 0 } });
  if (!u) throw new HttpError(401, "Account not found");
  return NextResponse.json({ user: { ...u, _id: u._id.toString(), isAdmin: await isAdmin(me.uid, me.email) } });
});

const img = z.string().startsWith("data:image/").max(600_000).nullable().optional();
const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  company: z.string().trim().max(120).optional(),
  title: z.string().trim().max(120).optional(),
  signature: img,
  initials: img,
});

export const PATCH = route(async (req: Request) => {
  const me = await requireUser();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const db = await getDb();
  await db.collection("users").updateOne({ _id: me.oid }, { $set: parsed.data });
  const res = NextResponse.json({ ok: true });
  if (parsed.data.name) await setSessionCookie(res, { uid: me.uid, email: me.email, name: parsed.data.name });
  return res;
});
