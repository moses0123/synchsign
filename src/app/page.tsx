import Link from "next/link";
import {
  ArrowRight, Bell, Check, FileSignature, Fingerprint, Layers, ListOrdered, Lock, QrCode, Repeat,
  Smartphone, Sparkles, Users, FilePlus2, Award, BookUser, WifiOff, Zap, X as XIcon, Send, MousePointerClick, Download,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { HeroVisual } from "@/components/landing/hero-visual";
import { Reveal } from "@/components/landing/reveal";
import { getSession } from "@/lib/auth";

const features = [
  { icon: MousePointerClick, t: "Drag-and-drop fields", d: "Signature, initials, dates, text, checkboxes, company & title — placed in seconds, snapped to any page." },
  { icon: ListOrdered, t: "Smart signing order", d: "Sequential, parallel, or grouped routing. The next person is notified the moment it's their turn." },
  { icon: Users, t: "Signers, approvers & CC", d: "Give everyone the right role. Approvers review without signing; CCs get the final copy automatically." },
  { icon: Lock, t: "Access codes", d: "Add a private code per recipient for a second layer of identity verification." },
  { icon: QrCode, t: "Public verification", d: "Every signed PDF carries a QR code and SHA-256 fingerprint anyone can verify — no account needed." },
  { icon: Fingerprint, t: "Court-ready audit trail", d: "IP, device, timestamps and every event, embedded as a certificate of completion inside the PDF." },
  { icon: Layers, t: "Reusable templates", d: "Save roles and fields once. Reuse forever, or bulk-send to hundreds of people in one go." },
  { icon: Bell, t: "Auto reminders & expiry", d: "Set it and forget it — SyncSign nudges people and closes stale envelopes for you." },
  { icon: Smartphone, t: "Built for phones", d: "A native-feeling, installable app with a guided signing flow and haptic feedback on mobile." },
  { icon: WifiOff, t: "Works offline", d: "The app shell is cached, so SyncSign opens instantly even on a flaky connection." },
  { icon: Repeat, t: "Correct without resending", d: "Fix a typo in a recipient's email or extend a deadline without starting over." },
  { icon: Sparkles, t: "Natural signatures", d: "Type in four handwriting styles, draw with pressure-sensitive ink, or upload — then save it to your profile." },
  { icon: FilePlus2, t: "Built-in document builder", d: "Write contracts, offers and forms in SyncSign from a starter library, with your logo, fill-in fields and auto-placed signature blocks." },
  { icon: Award, t: "Separate certificate of completion", d: "Get a clean signed document plus a standalone certificate with the full audit trail — both verifiable." },
  { icon: BookUser, t: "Contacts & live notifications", d: "Recipients are remembered for one-tap sending, and you're notified the moment someone opens or signs." },
];

const compare = [
  ["Free public verification page + QR on every document", true, false],
  ["Write documents from templates inside the app", true, "Paid add-on"],
  ["Guided mobile signing with next-field navigator", true, "Partial"],
  ["Installable app that works offline", true, false],
  ["Correct recipients after sending", true, true],
  ["Bulk send from templates", true, "Paid tiers"],
  ["Light, dark & follow-device themes", true, false],
  ["Unlimited templates", true, "Paid tiers"],
] as const;

export default async function Landing() {
  const session = await getSession();
  return (
    <div className="relative overflow-x-clip">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-sky-200/40 blur-[140px] dark:bg-sky-500/10" />

      <header className="sticky top-0 z-50 border-b border-transparent">
        <div className="glass mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-xl border border-line/70 px-4 py-2.5 shadow-soft sm:px-5" style={{ width: "calc(100% - 24px)" }}>
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#compare" className="hover:text-ink">Why SyncSign</a>
            <Link href="/verify" className="hover:text-ink">Verify a document</Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Link href="/app" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600">Open app <ArrowRight className="h-4 w-4" /></Link>
            ) : (
              <>
                <Link href="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-muted hover:text-ink sm:inline-flex">Sign in</Link>
                <Link href="/register" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-600">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:pt-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
              <Zap className="h-3.5 w-3.5" /> Electronic signatures for modern teams
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Sign anything.<br /><span className="text-gradient">Stay in sync</span> with everyone.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              SyncSign turns contracts, offers and forms into a two-minute experience — on desktop or phone.
              Route to anyone, track every step live, and deliver tamper-evident PDFs anyone can verify.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-3">
            <Link href={session ? "/app/new" : "/register"} className="inline-flex h-12 items-center gap-2 rounded-xl bg-sky-600 px-6 font-semibold text-white shadow-sm transition hover:brightness-110">
              <FileSignature className="h-5 w-5" /> Send your first document
            </Link>
            <Link href="/verify" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-6 font-semibold hover:border-sky-300">
              <QrCode className="h-5 w-5 text-sky-500" /> Verify a signed PDF
            </Link>
          </Reveal>
          <Reveal delay={0.2} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {["No signer account needed", "Installable on any phone", "SHA-256 sealed"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky-500" />{t}</span>
            ))}
          </Reveal>
        </div>
        <HeroVisual />
      </section>

      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <Reveal><h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">Three steps. Zero friction.</h2></Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { i: Send, t: "Upload & add people", d: "Drop in a PDF, add signers, approvers and CCs, choose the order." },
            { i: MousePointerClick, t: "Place fields", d: "Drag fields onto the page for each person. Or start from a template." },
            { i: Download, t: "Track & receive", d: "Watch progress live. Everyone gets the sealed PDF with its certificate." },
          ].map((s, n) => (
            <Reveal key={s.t} delay={n * 0.08}>
              <div className="card group relative h-full overflow-hidden p-6 transition hover:border-sky-300 hover:shadow-md">
                <span className="absolute right-5 top-4 font-display text-6xl font-bold text-sky-500/10">{n + 1}</span>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-500/10 text-sky-500"><s.i className="h-6 w-6" /></span>
                <h3 className="mt-5 font-display text-lg font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <p className="text-center text-sm font-bold uppercase tracking-widest text-sky-500">Everything you expect — and more</p>
          <h2 className="mt-2 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">The complete signing toolkit</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-xl border border-line bg-surface/60 p-5 transition hover:border-sky-300 hover:bg-surface">
                <f.icon className="h-6 w-6 text-sky-500" />
                <h3 className="mt-3.5 font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="compare" className="mx-auto max-w-4xl px-5 py-16">
        <Reveal><h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">Why teams switch to SyncSign</h2></Reveal>
        <Reveal delay={0.1}>
          <div className="card mt-10 overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_90px] gap-2 border-b border-line bg-surface-2 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted sm:grid-cols-[1fr_140px_140px] sm:px-6">
              <span>Capability</span><span className="text-center text-sky-600 dark:text-sky-300">SyncSign</span><span className="text-center">Typical e-sign</span>
            </div>
            {compare.map(([t, a, b]) => (
              <div key={t} className="grid grid-cols-[1fr_90px_90px] items-center gap-2 border-b border-line px-4 py-3.5 text-sm last:border-0 sm:grid-cols-[1fr_140px_140px] sm:px-6">
                <span>{t}</span>
                <span className="flex justify-center">{a === true ? <Check className="h-5 w-5 text-sky-500" /> : a}</span>
                <span className="flex justify-center text-xs text-muted">{b === true ? <Check className="h-5 w-5 text-muted" /> : b === false ? <XIcon className="h-5 w-5 text-rose-400" /> : b}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-sky-700 px-6 py-14 text-center text-white shadow-sm sm:px-12">
            <h2 className="relative font-display text-3xl font-bold tracking-tight sm:text-4xl">Your next signature is two minutes away.</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sky-50">Create a free account, upload a PDF and send it. Your signers don&apos;t need an account at all.</p>
            <Link href={session ? "/app/new" : "/register"} className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-sky-700 transition hover:scale-[1.03]">
              Start signing free <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} SyncSign. Sign with confidence.</p>
        </div>
      </footer>
    </div>
  );
}
