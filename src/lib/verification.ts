import "server-only";
import { createHash, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { getSettings, type VerificationMode } from "./settings";
import type { Recipient, User } from "./types";

/* ───────────── Policy ───────────── */

export interface VerificationPolicy { mode: VerificationMode; defaultOn: boolean; source: "workspace" | "user" }

/** Effective email-verification policy for envelopes sent by this user (per-user override beats workspace). */
export async function verificationPolicyFor(ownerId: ObjectId): Promise<VerificationPolicy> {
  const { signing } = await getSettings();
  const u = await (await getDb()).collection<User>("users").findOne({ _id: ownerId }, { projection: { emailVerification: 1 } });
  const override = u?.emailVerification;
  if (override && override !== "inherit") return { mode: override, defaultOn: override === "required" || signing.emailVerificationDefault, source: "user" };
  return { mode: signing.emailVerification, defaultOn: signing.emailVerification === "required" || signing.emailVerificationDefault, source: "workspace" };
}

/** Apply the policy to a recipient's requested setting. CC recipients never verify (they don't open a signing page to act). */
export function applyPolicy(policy: VerificationPolicy, r: Pick<Recipient, "role"> & { verifyEmail?: boolean }, useDefault = false) {
  if (r.role === "cc") return false;
  if (policy.mode === "off") return false;
  if (policy.mode === "required") return true;
  return useDefault ? policy.defaultOn : Boolean(r.verifyEmail);
}

/* ───────────── One-time codes ───────────── */

const CODE_TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 45_000;
const MAX_SENDS_PER_HOUR = 6;
const MAX_ATTEMPTS = 5;

const hashCode = (token: string, code: string) => createHash("sha256").update(`${token}:${code}`).digest("hex");

interface OtpDoc { _id: string; codeHash: string; expiresAt: Date; attempts: number; sentAt: Date; sends: Date[] }

export async function issueCode(token: string) {
  const col = (await getDb()).collection<OtpDoc>("otp");
  const now = Date.now();
  const prev = await col.findOne({ _id: token });
  const recent = (prev?.sends ?? []).filter((d) => now - new Date(d).getTime() < 3600_000);
  if (prev && now - new Date(prev.sentAt).getTime() < RESEND_AFTER_MS) {
    return { ok: false as const, wait: Math.ceil((RESEND_AFTER_MS - (now - new Date(prev.sentAt).getTime())) / 1000) };
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) return { ok: false as const, wait: 3600, limited: true };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await col.updateOne({ _id: token }, {
    $set: { codeHash: hashCode(token, code), expiresAt: new Date(now + CODE_TTL_MS), attempts: 0, sentAt: new Date(now), sends: [...recent, new Date(now)] },
  }, { upsert: true });
  return { ok: true as const, code, minutes: CODE_TTL_MS / 60_000 };
}

export async function checkCode(token: string, code: string) {
  const col = (await getDb()).collection<OtpDoc>("otp");
  const doc = await col.findOne({ _id: token });
  if (!doc) return { ok: false as const, reason: "Request a new code first." };
  if (new Date(doc.expiresAt).getTime() < Date.now()) return { ok: false as const, reason: "That code has expired. Request a new one." };
  if (doc.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: "Too many wrong attempts. Request a new code." };
  if (hashCode(token, code.replace(/\D/g, "")) !== doc.codeHash) {
    await col.updateOne({ _id: token }, { $inc: { attempts: 1 } });
    const left = MAX_ATTEMPTS - doc.attempts - 1;
    return { ok: false as const, reason: left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code." };
  }
  await col.deleteOne({ _id: token });
  return { ok: true as const };
}

/* ───────────── "This browser has verified" cookie (bound to one signing link) ───────────── */

const VERIFIED_HOURS = 12;
const cookieName = (token: string) => `ss_v_${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
function secret() {
  const s = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me" : "");
  return new TextEncoder().encode(`signer-verify:${s}`);
}

export async function verifiedCookie(token: string) {
  return {
    name: cookieName(token),
    value: await new SignJWT({ t: token }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${VERIFIED_HOURS}h`).sign(secret()),
    options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: VERIFIED_HOURS * 3600 },
  };
}

export async function isVerifiedHere(token: string) {
  const v = (await cookies()).get(cookieName(token))?.value;
  if (!v) return false;
  try { const { payload } = await jwtVerify(v, secret()); return payload.t === token; } catch { return false; }
}

export function maskEmail(e: string) {
  const [u = "", d = ""] = e.split("@");
  const keep = u.length <= 2 ? 1 : 2;
  return `${u.slice(0, keep)}${"•".repeat(Math.max(2, u.length - keep))}@${d}`;
}
