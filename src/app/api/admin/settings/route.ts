import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { encryptSecret, getSettings, publicSettings, saveSettings } from "@/lib/settings";

export const GET = route(async () => {
  await requireAdmin();
  return NextResponse.json({ settings: publicSettings(await getSettings(true)), envSmtp: Boolean(process.env.SMTP_HOST) });
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0284c7");
const schema = z.object({
  email: z.object({
    enabled: z.boolean(), host: z.string().trim().max(200), port: z.number().int().min(1).max(65535),
    security: z.enum(["ssl", "starttls", "none"]), user: z.string().trim().max(200),
    password: z.string().max(500).optional(), clearPassword: z.boolean().optional(),
    fromName: z.string().trim().max(120), fromEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid From address")]),
    replyTo: z.union([z.literal(""), z.string().trim().email("Enter a valid Reply-To address")]), provider: z.string().max(40),
  }).partial().optional(),
  notifications: z.object({ invite: z.boolean(), reminder: z.boolean(), signerDone: z.boolean(), completed: z.boolean(), declined: z.boolean(), voided: z.boolean() }).partial().optional(),
  signing: z.object({
    defaultReminderDays: z.number().int().min(1).max(60).nullable(), defaultExpiryDays: z.number().int().min(1).max(365).nullable(),
    maxUploadMB: z.number().int().min(1).max(50), allowDecline: z.boolean(), consentText: z.string().trim().min(10).max(1000),
  }).partial().optional(),
  access: z.object({
    registration: z.enum(["open", "domains", "closed"]),
    allowedDomains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter domains like company.com")).max(50),
  }).partial().optional(),
  branding: z.object({ orgName: z.string().trim().min(1).max(80), supportEmail: z.union([z.literal(""), z.string().trim().email()]), emailFooter: z.string().trim().max(400), emailAccent: hex }).partial().optional(),
});

export const PATCH = route(async (req: Request) => {
  const me = await requireAdmin();
  const p = schema.safeParse(await req.json());
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid settings");
  const { email, ...rest } = p.data;
  const patch: Record<string, unknown> = { ...rest };
  if (email) {
    const { password, clearPassword, ...e } = email;
    const out: Record<string, unknown> = { ...e };
    if (clearPassword) out.passEnc = null;
    else if (password) out.passEnc = encryptSecret(password);
    const current = (await getSettings(true)).email;
    if (e.enabled && !(e.host ?? current.host)) throw new HttpError(400, "Enter and save the SMTP server details before turning email on");
    patch.email = out;
  }
  const saved = await saveSettings(patch, me.email);
  return NextResponse.json({ settings: publicSettings(saved) });
});
