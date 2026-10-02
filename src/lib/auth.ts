import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
}

const disabledCache = new Map<string, { at: number; disabled: boolean }>();

/** True if an admin has suspended this account (cached briefly to keep requests fast). */
export async function isDisabled(uid: string) {
  const hit = disabledCache.get(uid);
  if (hit && Date.now() - hit.at < 20_000) return hit.disabled;
  const { getDb } = await import("./db");
  const u = await (await getDb()).collection("users").findOne({ _id: new ObjectId(uid) }, { projection: { disabled: 1 } });
  const disabled = !u || Boolean(u.disabled);
  disabledCache.set(uid, { at: Date.now(), disabled });
  return disabled;
}
export function forgetDisabled(uid: string) { disabledCache.delete(uid); }

export async function requireUser() {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Please sign in");
  if (await isDisabled(s.uid)) throw new HttpError(403, "This account has been suspended. Contact your administrator.");
  return { ...s, oid: new ObjectId(s.uid) };
}

export async function setSessionCookie(res: NextResponse, p: SessionPayload) {
  res.cookies.set(SESSION_COOKIE, await signSession(p), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Wrap a route handler so thrown HttpErrors become JSON responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown");
}
