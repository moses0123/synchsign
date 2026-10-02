# SyncSign

A DocuSign-style e-signature **Progressive Web App** built with **Next.js 15 (App Router)** and **MongoDB Atlas**.
Sky-blue & white design, light / dark / follow-device themes (chosen in Settings), subtle animations, and separate mobile and desktop layouts.

## Quick start

```bash
npm install                 # also copies the pdf.js worker into /public
cp .env.example .env.local  # then fill in MONGODB_URI and AUTH_SECRET
npm run dev                 # http://localhost:3000
```

### MongoDB Atlas setup
1. Create a free cluster at cloud.mongodb.com → **Database → Connect → Drivers** and copy the `mongodb+srv://…` string into `MONGODB_URI`.
2. **Network Access** → allow your IP (or `0.0.0.0/0` when deploying to Vercel).
3. That's it — collections, indexes and the GridFS bucket (PDF storage) are created automatically on first run.

### Email (optional)
Set `SMTP_*` to send invitations, reminders and completion emails (works with Resend, SendGrid, Mailgun, Gmail SMTP, etc.).
Without SMTP the app still works: signing links appear on the envelope page with **Copy link / Share** buttons.

### Deploy (Vercel)
Import the repo, add the env vars from `.env.example`, deploy. `vercel.json` schedules `/api/cron/reminders` daily
(automatic reminders + expiry). Set `CRON_SECRET` and Vercel sends it automatically.

## Features

**Core (DocuSign parity)**
- Upload PDF → add recipients → drag-and-drop fields → send
- Roles: **signer, approver, CC**; **sequential, parallel or grouped** routing (same step number = sign together)
- 9 field types: signature, initials, date signed, full name, email, company, job title, text, checkbox (required/optional)
- Signature adoption: **type** (4 handwriting fonts), **draw** (pressure-sensitive, smoothed ink), or **upload** (background auto-removed)
- Signers need no account; decline with reason; sender can remind, void, correct, duplicate, delete
- Templates (save any envelope's roles + fields) and **bulk send** (paste a list, one envelope each)
- Expiry dates, automatic reminders, full **audit trail** (IP, device, timestamps)
- On completion you get two separate files: the **signed document** (fields burned in) and a standalone **Certificate of Completion** (audit trail, hashes, QR). Both download separately and both can be verified

**Document builder (Templates → Document builder)**
- Write documents inside SyncSign: titles, sections, paragraphs, lists, tables, callouts, dividers, page breaks
- Starter library: Mutual NDA, Service Agreement, Employment Offer, Contractor Agreement, Residential Lease, MOU, Quotation Acceptance, Media Consent, or blank
- Fill-in fields (`{{client_name}}`) shown as labelled chips; you fill them in when sending
- Signer roles + signature blocks. Signature, name and date fields are placed automatically in the generated PDF
- Branding: logo, company name, accent colour, header/footer text, page numbers, text size
- Live A4 preview, "Preview PDF", download, duplicate, reuse

**Beyond DocuSign**
- **Contacts**: everyone you send to is saved and suggested as you type; favourites, notes, company
- **In-app notifications** when recipients open, sign, approve or decline
- **Analytics** on the dashboard: weekly volume, completion rate, median time to sign
- **Public verification**: every signed PDF has a QR code + SHA-256 fingerprint; anyone can drop the PDF at `/verify` to prove it hasn't been altered
- **Guided signing**: "Next field" navigator, live progress bar, adopt-once-apply-everywhere, haptic feedback on phones
- **Per-recipient access codes** for a second identity factor
- **Correct after sending** (fix a wrong email → a fresh link is issued; completed signatures are kept)
- Live envelope tracking (auto-refresh), progress ring, animated activity timeline
- Saved signature/initials + company/title auto-fill for logged-in users
- **Installable PWA**: offline app shell, install prompt (incl. iOS hint), home-screen shortcuts, self-hosted fonts
- Keyboard power tools in the editor: arrows nudge, Shift+arrows, Ctrl/⌘+D duplicate, Del remove

## Project layout
```
src/app/            pages (landing, auth, /app dashboard, editor, /sign/[token], /verify)
src/app/api/        REST routes (auth, envelopes, templates, sign, verify, cron)
src/components/     UI kit, app shell, PDF viewer (pdf.js), signature pad
src/lib/            db (Mongo + GridFS), auth (JWT cookies), pdf (pdf-lib stamping + certificate), mail, envelope workflow
public/sw.js        service worker · public/icons  PWA icons
```

## Notes
- Sessions are signed JWTs in an httpOnly cookie (`AUTH_SECRET`). Passwords are hashed with bcrypt.
- PDFs up to 20 MB are stored in MongoDB GridFS — no extra file storage service needed.
- Text burned into PDFs uses Helvetica, so characters outside Western European (WinAnsi) show as `?`. Signatures are images and are unaffected. To support other scripts, embed a Unicode TTF with `@pdf-lib/fontkit` in `src/lib/pdf.ts`.
- E-signature legal requirements differ by country — review them for your jurisdiction before production use.
