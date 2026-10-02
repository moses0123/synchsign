import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { smtpConfig } from "@/lib/settings";

export const GET = route(async () => {
  await requireAdmin();
  const db = await getDb();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [users, admins, suspended, activeWeek, byStatus, completedMonth, documents, templates, storage, mailWeek, jobs] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("users").countDocuments({ role: "admin" }),
    db.collection("users").countDocuments({ disabled: true }),
    db.collection("users").countDocuments({ lastLoginAt: { $gte: weekAgo } }),
    db.collection("envelopes").aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    db.collection("envelopes").countDocuments({ status: "completed", completedAt: { $gte: monthStart } }),
    db.collection("documents").countDocuments(),
    db.collection("templates").countDocuments(),
    db.collection("files.files").aggregate<{ bytes: number; n: number }>([{ $group: { _id: null, bytes: { $sum: "$length" }, n: { $sum: 1 } } }]).toArray(),
    db.collection("mail_log").aggregate<{ _id: string; n: number }>([{ $match: { at: { $gte: weekAgo } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    db.collection<{ _id: string; reminders?: unknown }>("settings").findOne({ _id: "jobs" }),
  ]);
  const smtp = await smtpConfig();
  const status = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
  return NextResponse.json({
    users: { total: users, admins, suspended, activeWeek },
    envelopes: { total: byStatus.reduce((a, x) => a + x.n, 0), ...status, completedMonth },
    documents, templates,
    storage: { bytes: storage[0]?.bytes ?? 0, files: storage[0]?.n ?? 0 },
    mail: { configured: Boolean(smtp), source: smtp?.source ?? null, host: smtp?.host ?? null, week: Object.fromEntries(mailWeek.map((x) => [x._id, x.n])) },
    jobs: jobs?.reminders ?? null,
    appUrl: process.env.APP_URL || null,
    cronProtected: Boolean(process.env.CRON_SECRET),
  });
});
