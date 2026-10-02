import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { HttpError, clientIp, route } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS, signAdminSession } from "@/lib/session";
import { checkLock, clearFailures, recordFailure } from "@/lib/rate-limit";
import type { User } from "@/lib/types";

export const POST = route(async (req: Request) => {
  const { email: raw, password } = (await req.json()) as { email?: string; password?: string };
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !password) throw new HttpError(400, "Enter your email and password");
  const ip = clientIp(req);
  const key = `admin:${ip}:${email}`;
  const locked = checkLock(key);
  if (locked) throw new HttpError(429, `Too many attempts. Try again in ${locked} minute${locked === 1 ? "" : "s"}.`);

  const db = await getDb();
  const user = await db.collection<User>("users").findOne({ email });
  const valid = user && !user.disabled && (await bcrypt.compare(password, user.passwordHash));
  const admin = valid && (await isAdmin(user!._id.toString(), user!.email));
  if (!valid || !admin) {
    const left = recordFailure(key);
    await db.collection("admin_audit").insertOne({ action: "login_failed", email, ip, at: new Date(), reason: !valid ? "bad_credentials" : "not_admin" });
    throw new HttpError(401, left > 0 ? "Incorrect email or password, or this account isn't an administrator." : "Too many attempts. Try again in 15 minutes.");
  }
  clearFailures(key);
  await db.collection("users").updateOne({ _id: user!._id }, { $set: { lastAdminLoginAt: new Date() } });
  await db.collection("admin_audit").insertOne({ action: "login", email, ip, ua: req.headers.get("user-agent"), at: new Date() });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await signAdminSession({ uid: user!._id.toString(), email: user!.email, name: user!.name }), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ADMIN_SESSION_HOURS * 3600,
  });
  return res;
});
