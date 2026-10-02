import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, route, setSessionCookie } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const POST = route(async (req: Request) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const { name, email, password } = parsed.data;
  const db = await getDb();
  const { access } = await getSettings();
  const isFirst = !(await db.collection("users").findOne({}, { projection: { _id: 1 } }));
  if (!isFirst && access.registration === "closed") throw new HttpError(403, "New sign-ups are closed. Ask your administrator for an account.");
  if (!isFirst && access.registration === "domains") {
    const domain = email.split("@")[1] ?? "";
    if (!access.allowedDomains.map((d) => d.toLowerCase()).includes(domain)) throw new HttpError(403, `Sign-ups are limited to ${access.allowedDomains.map((d) => "@" + d).join(", ") || "approved domains"}.`);
  }
  if (await db.collection("users").findOne({ email })) throw new HttpError(409, "An account with this email already exists");
  const passwordHash = await bcrypt.hash(password, 11);
  const { insertedId } = await db.collection("users").insertOne({ name, email, passwordHash, role: isFirst ? "admin" : "user", createdAt: new Date(), lastLoginAt: new Date(), signature: null, initials: null });
  const res = NextResponse.json({ ok: true });
  return setSessionCookie(res, { uid: insertedId.toString(), email, name });
});
