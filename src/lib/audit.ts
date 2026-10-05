import { ObjectId } from "mongodb";
import { getDb } from "./db";

export type AuditAction =
  | "created" | "updated" | "sent" | "viewed" | "code_verified" | "code_failed" | "signed" | "approved"
  | "declined" | "completed" | "voided" | "reminded" | "downloaded" | "expired" | "delivered" | "corrected"
  | "otp_sent" | "otp_failed" | "email_verified";

export async function logAudit(envelopeId: ObjectId, action: AuditAction, e: {
  actor?: string; email?: string; ip?: string; ua?: string; details?: string;
} = {}) {
  const db = await getDb();
  await db.collection("audit").insertOne({ envelopeId, action, at: new Date(), ...e });
}

export async function getAudit(envelopeId: ObjectId) {
  const db = await getDb();
  return db.collection("audit").find({ envelopeId }).sort({ at: 1 }).toArray();
}
