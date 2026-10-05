import "server-only";
import { HttpError } from "./auth";
import { ensureSeparated, expireIfNeeded, findByToken } from "./envelope";
import { isVerifiedHere } from "./verification";

/**
 * Load the envelope behind a signing link and check the recipient's identity gates:
 *  1. access code (if the sender set one), then
 *  2. email verification (one-time code sent to the recipient's inbox).
 * With requireAccess, any unmet gate is a 403.
 */
export async function loadSigner(req: Request, tok: string, opts: { requireAccess?: boolean } = { requireAccess: true }) {
  const found = await findByToken(tok);
  if (!found) throw new HttpError(404, "This signing link is invalid or has been replaced.");
  await expireIfNeeded(found.env);
  await ensureSeparated(found.env);
  const code = req.headers.get("x-access-code") ?? new URL(req.url).searchParams.get("code");
  const unlocked = !found.r.accessCode || (code ?? "").trim().toLowerCase() === found.r.accessCode.trim().toLowerCase();
  const needsEmail = Boolean(found.r.verifyEmail);
  const emailVerified = !needsEmail || (await isVerifiedHere(tok));
  if (opts.requireAccess && !unlocked) throw new HttpError(403, "Access code required");
  if (opts.requireAccess && !emailVerified) throw new HttpError(403, "Please verify your email address to continue");
  return { ...found, unlocked, code, needsEmail, emailVerified };
}

export type TokenCtx = { params: Promise<{ token: string }> };
