import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";

/* Platform-wide settings managed from the admin portal (stored in the `settings` collection). */

export interface EmailSettings {
  enabled: boolean;
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none"; // ssl = implicit TLS (465), starttls = upgrade (587)
  user: string;
  passEnc: string | null;   // AES-256-GCM, never sent to the browser
  fromName: string;
  fromEmail: string;
  replyTo: string;
  provider: string;
}

export interface NotificationSettings {
  invite: boolean; reminder: boolean; signerDone: boolean; completed: boolean; declined: boolean; voided: boolean;
}

export interface SigningSettings {
  defaultReminderDays: number | null;
  defaultExpiryDays: number | null;
  maxUploadMB: number;
  allowDecline: boolean;
  consentText: string;
  /** off = not available · optional = senders choose per recipient · required = always on */
  emailVerification: VerificationMode;
  /** When senders choose: is verification ticked by default for new recipients? */
  emailVerificationDefault: boolean;
}

export type VerificationMode = "off" | "optional" | "required";

export interface AccessSettings {
  registration: "open" | "domains" | "closed";
  allowedDomains: string[];
}

export interface BrandingSettings {
  orgName: string;
  supportEmail: string;
  emailFooter: string;
  emailAccent: string;
}

export interface AppSettings {
  email: EmailSettings;
  notifications: NotificationSettings;
  signing: SigningSettings;
  access: AccessSettings;
  branding: BrandingSettings;
  updatedAt?: Date;
  updatedBy?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  email: { enabled: false, host: "", port: 587, security: "starttls", user: "", passEnc: null, fromName: "SyncSign", fromEmail: "", replyTo: "", provider: "custom" },
  notifications: { invite: true, reminder: true, signerDone: true, completed: true, declined: true, voided: true },
  signing: {
    defaultReminderDays: 3, defaultExpiryDays: null, maxUploadMB: 20, allowDecline: true,
    emailVerification: "optional", emailVerificationDefault: false,
    consentText: "I agree to use electronic records and signatures, and I confirm I am the person named above.",
  },
  access: { registration: "open", allowedDomains: [] },
  branding: { orgName: "SyncSign", supportEmail: "", emailFooter: "Sent securely with SyncSign. Do not forward this email — the link is personal to you.", emailAccent: "#0284c7" },
};

/* ── secret encryption (key derived from AUTH_SECRET) ── */
function key() {
  const s = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me" : "");
  if (!s) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`syncsign-settings:${s}`).digest();
}
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}
export function decryptSecret(blob: string | null | undefined) {
  if (!blob) return "";
  try {
    const [, iv, tag, data] = blob.split(":");
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv!, "base64"));
    d.setAuthTag(Buffer.from(tag!, "base64"));
    return Buffer.concat([d.update(Buffer.from(data!, "base64")), d.final()]).toString("utf8");
  } catch {
    return ""; // AUTH_SECRET changed — password must be re-entered
  }
}

/* ── cached read ── */
let cache: { at: number; value: AppSettings } | null = null;
const TTL = 5_000;

function merge(stored: Partial<AppSettings> | null): AppSettings {
  const s = stored ?? {};
  return {
    email: { ...DEFAULT_SETTINGS.email, ...(s.email ?? {}) },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(s.notifications ?? {}) },
    signing: { ...DEFAULT_SETTINGS.signing, ...(s.signing ?? {}) },
    access: { ...DEFAULT_SETTINGS.access, ...(s.access ?? {}) },
    branding: { ...DEFAULT_SETTINGS.branding, ...(s.branding ?? {}) },
    updatedAt: s.updatedAt, updatedBy: s.updatedBy,
  };
}

export async function getSettings(fresh = false): Promise<AppSettings> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.value;
  const db = await getDb();
  const doc = await db.collection<{ _id: string } & Partial<AppSettings>>("settings").findOne({ _id: "app" });
  const value = merge(doc);
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(patch: Partial<AppSettings>, by: string) {
  const db = await getDb();
  const $set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: by };
  for (const [section, values] of Object.entries(patch)) {
    if (values && typeof values === "object" && !Array.isArray(values) && !(values instanceof Date)) {
      for (const [k, v] of Object.entries(values)) $set[`${section}.${k}`] = v;
    }
  }
  await db.collection<{ _id: string }>("settings").updateOne({ _id: "app" }, { $set }, { upsert: true });
  cache = null;
  return getSettings(true);
}

/** What the browser is allowed to see (no secrets). */
export function publicSettings(s: AppSettings) {
  const { passEnc, ...email } = s.email;
  return { ...s, email: { ...email, hasPassword: Boolean(passEnc), passwordUnreadable: Boolean(passEnc) && !decryptSecret(passEnc) } };
}

/** Effective SMTP config: admin portal settings first, then .env as a fallback. */
export async function smtpConfig() {
  const s = await getSettings();
  const e = s.email;
  if (e.enabled && e.host) {
    return {
      source: "portal" as const,
      host: e.host, port: e.port, security: e.security, user: e.user, pass: decryptSecret(e.passEnc),
      passwordUnreadable: Boolean(e.passEnc) && !decryptSecret(e.passEnc),
      from: e.fromEmail ? `"${(e.fromName || s.branding.orgName).replace(/"/g, "")}" <${e.fromEmail}>` : undefined,
      replyTo: e.replyTo || undefined,
    };
  }
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    return {
      source: "env" as const,
      host: process.env.SMTP_HOST, port, security: (port === 465 ? "ssl" : "starttls") as EmailSettings["security"],
      user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "",
      from: process.env.MAIL_FROM || undefined, replyTo: undefined, passwordUnreadable: false,
    };
  }
  return null;
}

/** Defaults applied to every new envelope. */
export async function envelopeDefaults() {
  const { signing } = await getSettings();
  return {
    reminderDays: signing.defaultReminderDays,
    expiresAt: signing.defaultExpiryDays ? new Date(Date.now() + signing.defaultExpiryDays * 86400_000) : null,
  };
}
