import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import type { Envelope } from "./types";

export type NotifyKind = "viewed" | "signed" | "approved" | "declined" | "completed" | "expired";

export async function notifyOwner(env: Pick<Envelope, "_id" | "ownerId" | "title">, kind: NotifyKind, actor: string) {
  const db = await getDb();
  await db.collection("notifications").insertOne({
    ownerId: env.ownerId as ObjectId, envelopeId: env._id, title: env.title, kind, actor, at: new Date(), read: false,
  });
}
