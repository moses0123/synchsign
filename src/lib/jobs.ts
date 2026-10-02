import "server-only";
import { envelopes, expireIfNeeded, signLink } from "./envelope";
import { mails } from "./mail";
import { logAudit } from "./audit";
import { getDb } from "./db";

/** Send automatic reminders and expire overdue envelopes. Used by the daily cron and the admin portal. */
export async function runReminders(trigger: "cron" | "admin") {
  const col = await envelopes();
  const list = await col.find({ status: "sent" }).limit(2000).toArray();
  let reminded = 0, expired = 0;
  const now = Date.now();
  for (const env of list) {
    await expireIfNeeded(env);
    if (env.status === "expired") { expired++; continue; }
    if (!env.reminderDays) continue;
    let changed = false;
    for (const r of env.recipients) {
      if (r.status !== "sent" && r.status !== "viewed") continue;
      const last = new Date(r.lastReminderAt ?? r.sentAt ?? env.sentAt ?? env.createdAt).getTime();
      if (now - last >= env.reminderDays * 86400_000) {
        await mails.reminder(r.email, r.name, env.ownerName, env.title, signLink(r));
        await logAudit(env._id, "reminded", { actor: "SyncSign", email: r.email, details: "Automatic reminder" });
        r.lastReminderAt = new Date(); changed = true; reminded++;
      }
    }
    if (changed) await col.updateOne({ _id: env._id }, { $set: { recipients: env.recipients } });
  }
  const result = { reminded, expired, checked: list.length, at: new Date(), trigger };
  await (await getDb()).collection<{ _id: string }>("settings").updateOne({ _id: "jobs" }, { $set: { reminders: result } }, { upsert: true });
  return result;
}
