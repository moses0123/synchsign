import "server-only";
import { HttpError } from "./auth";
import { ensureSeparated, expireIfNeeded, findByToken } from "./envelope";

export async function loadSigner(req: Request, tok: string, opts: { requireCode?: boolean } = { requireCode: true }) {
  const found = await findByToken(tok);
  if (!found) throw new HttpError(404, "This signing link is invalid or has been replaced.");
  await expireIfNeeded(found.env);
  await ensureSeparated(found.env);
  const code = req.headers.get("x-access-code") ?? new URL(req.url).searchParams.get("code");
  const unlocked = !found.r.accessCode || (code ?? "").trim().toLowerCase() === found.r.accessCode.trim().toLowerCase();
  if (opts.requireCode && !unlocked) throw new HttpError(403, "Access code required");
  return { ...found, unlocked, code };
}

export type TokenCtx = { params: Promise<{ token: string }> };
