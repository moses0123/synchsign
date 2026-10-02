import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { HttpError, route, setSessionCookie } from "@/lib/auth";
import type { User } from "@/lib/types";

export const POST = route(async (req: Request) => {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) throw new HttpError(400, "Email and password are required");
  const db = await getDb();
  const user = await db.collection<User>("users").findOne({ email: email.trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, "Incorrect email or password");
  if (user.disabled) throw new HttpError(403, "This account has been suspended. Contact your administrator.");
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  const res = NextResponse.json({ ok: true });
  return setSessionCookie(res, { uid: user._id.toString(), email: user.email, name: user.name });
});
