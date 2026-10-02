import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ss_session";

function secret() {
  const s = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me" : "");
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export interface SessionPayload { uid: string; email: string; name: string }

export async function signSession(p: SessionPayload) {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.scope === "admin") return null; // admin tokens are not app sessions
    return { uid: String(payload.uid), email: String(payload.email), name: String(payload.name) };
  } catch {
    return null;
  }
}

/* ── Admin portal session: separate cookie, separate login, shorter lifetime ── */
export const ADMIN_COOKIE = "ss_admin";
export const ADMIN_SESSION_HOURS = 8;

export async function signAdminSession(p: SessionPayload) {
  return new SignJWT({ ...p, scope: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifyAdminSession(token?: string | null): Promise<(SessionPayload & { exp: number }) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.scope !== "admin") return null;
    return { uid: String(payload.uid), email: String(payload.email), name: String(payload.name), exp: Number(payload.exp) };
  } catch {
    return null;
  }
}
