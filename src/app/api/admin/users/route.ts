import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { HttpError, route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { APP_URL, sendMail } from "@/lib/mail";
import type { User } from "@/lib/types";

export const GET = route(async (req: Request) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const db = await getDb();
  const filter = q ? { $or: [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {};
  const users = await db.collection<User>("users").find(filter, { projection: { passwordHash: 0, signature: 0, initials: 0 } }).sort({ createdAt: 1 }).limit(500).toArray();
  const counts = await db.collection("envelopes").aggregate<{ _id: unknown; n: number; done: number }>([
    { $group: { _id: "$ownerId", n: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
  ]).toArray();
  const map = new Map(counts.map((c) => [String(c._id), c]));
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return NextResponse.json({
    users: users.map((u) => ({
      _id: u._id.toString(), name: u.name, email: u.email, company: u.company ?? "", role: admins.includes(u.email) ? "admin" : u.role ?? "user",
      envAdmin: admins.includes(u.email), disabled: Boolean(u.disabled), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null,
      emailVerification: u.emailVerification ?? "inherit",
      envelopes: map.get(u._id.toString())?.n ?? 0, completed: map.get(u._id.toString())?.done ?? 0,
    })),
  });
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["admin", "user"]).default("user"),
  sendInvite: z.boolean().default(true),
});

/** Create an account for someone (useful when public sign-up is closed). Returns a temporary password. */
export const POST = route(async (req: Request) => {
  const me = await requireAdmin();
  const p = schema.safeParse(await req.json());
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid input");
  const db = await getDb();
  if (await db.collection("users").findOne({ email: p.data.email })) throw new HttpError(409, "A user with this email already exists");
  const temp = randomBytes(9).toString("base64url");
  await db.collection("users").insertOne({
    name: p.data.name, email: p.data.email, role: p.data.role, passwordHash: await bcrypt.hash(temp, 11),
    createdAt: new Date(), signature: null, initials: null, invitedBy: me.email,
  });
  let emailed = false;
  if (p.data.sendInvite) {
    emailed = await sendMail("invite", p.data.email, "Your SyncSign account is ready", `Welcome, ${p.data.name}`,
      `<p>${me.name} created a SyncSign account for you.</p><p>Email: <strong>${p.data.email}</strong><br>Temporary password: <strong style="font-family:monospace">${temp}</strong></p><p>Please change it after signing in (Settings → Password).</p>`,
      { href: `${APP_URL()}/login?email=${encodeURIComponent(p.data.email)}`, label: "Sign in" });
  }
  return NextResponse.json({ ok: true, tempPassword: temp, emailed });
});
