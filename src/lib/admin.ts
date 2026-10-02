import "server-only";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { HttpError, isDisabled } from "./auth";
import { ADMIN_COOKIE, verifyAdminSession } from "./session";
import { getDb } from "./db";
import type { User } from "./types";

const envAdmins = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Who is an admin:
 *  - anyone listed in ADMIN_EMAILS, or
 *  - users with role "admin" in the database, or
 *  - if there are no admins at all yet, the first account ever created (bootstrap).
 */
export async function isAdmin(uid: string, email: string) {
  if (envAdmins().includes(email.toLowerCase())) return true;
  const users = (await getDb()).collection<User>("users");
  const me = await users.findOne({ _id: new ObjectId(uid) }, { projection: { role: 1, disabled: 1 } });
  if (!me || me.disabled) return false;
  if (me.role === "admin") return true;
  if (envAdmins().length) return false;
  const anyAdmin = await users.findOne({ role: "admin" }, { projection: { _id: 1 } });
  if (anyAdmin) return false;
  const first = await users.find({}, { projection: { _id: 1 } }).sort({ createdAt: 1, _id: 1 }).limit(1).next();
  if (first && first._id.equals(me._id)) {
    await users.updateOne({ _id: me._id }, { $set: { role: "admin" } });
    return true;
  }
  return false;
}

/** The signed-in admin portal session, re-checked against the database (role may have been removed). */
export async function getAdminSession() {
  const s = await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!s) return null;
  if ((await isDisabled(s.uid)) || !(await isAdmin(s.uid, s.email))) return null;
  return { ...s, oid: new ObjectId(s.uid) };
}

export async function requireAdmin() {
  const me = await getAdminSession();
  if (!me) throw new HttpError(401, "Your admin session has ended. Please sign in to the admin portal again.");
  return me;
}
