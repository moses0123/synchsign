import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

export interface Contact { _id: ObjectId; ownerId: ObjectId; name: string; email: string; company?: string; phone?: string; notes?: string; uses: number; lastUsedAt: Date; createdAt: Date; favorite?: boolean }

export async function contacts() {
  const db = await getDb();
  const col = db.collection<Contact>("contacts");
  return col;
}

/** Remember everyone the user sends to, so they autocomplete next time. */
export async function saveContacts(ownerId: ObjectId, people: { name: string; email: string }[]) {
  const col = await contacts();
  const now = new Date();
  await Promise.all(people.filter((p) => p.email).map((p) => col.updateOne(
    { ownerId, email: p.email.toLowerCase() },
    { $set: { name: p.name, lastUsedAt: now }, $inc: { uses: 1 }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )));
}
