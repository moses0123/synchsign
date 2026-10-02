import "server-only";
import { HttpError, requireUser } from "./auth";
import { oid } from "./db";
import { ensureSeparated, envelopes, expireIfNeeded } from "./envelope";

export async function loadOwned(id: string) {
  const me = await requireUser();
  const _id = oid(id);
  if (!_id) throw new HttpError(404, "Envelope not found");
  const col = await envelopes();
  const env = await col.findOne({ _id, ownerId: me.oid });
  if (!env) throw new HttpError(404, "Envelope not found");
  await expireIfNeeded(env);
  await ensureSeparated(env);
  return { me, env, col };
}

export type Ctx = { params: Promise<{ id: string }> };
