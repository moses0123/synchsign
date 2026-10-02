"use client";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Modal, Skeleton, api } from "@/components/ui";
import { Field, PageHeader, Toggle } from "@/components/admin/kit";
import { cn, fmtDate, timeAgo } from "@/lib/utils";

interface U { _id: string; name: string; email: string; company: string; role: "admin" | "user"; envAdmin: boolean; disabled: boolean; createdAt: string; lastLoginAt: string | null; envelopes: number; completed: number }

export default function UsersAdmin() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<U[] | null>(null);
  const [me, setMe] = useState<string>("");
  const [add, setAdd] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string; emailed?: boolean } | null>(null);
  const load = (query = q) => api<{ users: U[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`).then((d) => setItems(d.users)).catch((e) => toast.error(e.message));
  useEffect(() => { const t = setTimeout(() => load(q), q ? 250 : 0); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api<{ user: { _id: string } }>("/api/admin/auth/me").then((d) => setMe(d.user._id)).catch(() => {}); }, []);

  async function patch(u: U, p: Partial<Pick<U, "role" | "disabled">>, msg: string) {
    try { await api(`/api/admin/users/${u._id}`, { method: "PATCH", json: p }); toast.success(msg); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function reset(u: U) {
    if (!confirm(`Reset the password for ${u.name}? Their current password stops working immediately.`)) return;
    try { const r = await api<{ tempPassword: string }>(`/api/admin/users/${u._id}/password`, { method: "POST" }); setSecret({ email: u.email, password: r.tempPassword }); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Users" body="Everyone who can send documents. Signers don't need accounts and aren't listed here."
        action={<div className="flex gap-2">
          <label className="relative flex-1 sm:w-60"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <Button onClick={() => setAdd(true)}><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Add user</span></Button>
        </div>} />

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_110px_120px_110px_150px] gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-medium text-muted md:grid">
          <span>User</span><span>Role</span><span>Envelopes</span><span>Last sign-in</span><span className="text-right">Actions</span>
        </div>
        {!items && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {items?.length === 0 && <p className="p-8 text-center text-sm text-muted">No users match.</p>}
        {items?.map((u) => {
          const self = u._id === me;
          return (
            <div key={u._id} className={cn("grid grid-cols-1 gap-3 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[1.6fr_110px_120px_110px_150px] md:items-center md:gap-4", u.disabled && "opacity-60")}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name} size={34} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">{u.name}{self && <span className="rounded bg-surface-2 px-1.5 text-[10px] font-medium text-muted">You</span>}{u.disabled && <span className="rounded bg-rose-500/10 px-1.5 text-[10px] font-semibold text-rose-600">Suspended</span>}</p>
                  <p className="truncate text-xs text-muted">{u.email} · joined {fmtDate(u.createdAt)}</p>
                </div>
              </div>
              <div>
                <select className="input !w-auto !py-1.5 !text-xs" value={u.role} disabled={self || u.envAdmin} title={u.envAdmin ? "Set by ADMIN_EMAILS" : undefined}
                  onChange={(e) => patch(u, { role: e.target.value as U["role"] }, e.target.value === "admin" ? `${u.name} is now an admin` : `${u.name} is now a regular user`)}>
                  <option value="user">User</option><option value="admin">Admin</option>
                </select>
              </div>
              <span className="text-sm text-muted"><span className="md:hidden">Envelopes: </span>{u.envelopes} <span className="text-xs">({u.completed} done)</span></span>
              <span className="text-sm text-muted"><span className="md:hidden">Last sign-in: </span>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "—"}</span>
              <div className="flex gap-1 md:justify-end">
                <Button size="sm" variant="ghost" onClick={() => reset(u)} title="Reset password"><KeyRound className="h-4 w-4" /><span className="md:hidden">Reset password</span></Button>
                {!self && <Button size="sm" variant="ghost" className={u.disabled ? "" : "!text-rose-600"} onClick={() => patch(u, { disabled: !u.disabled }, u.disabled ? `${u.name} reactivated` : `${u.name} suspended`)}>{u.disabled ? "Reactivate" : "Suspend"}</Button>}
              </div>
            </div>
          );
        })}
      </div>

      <AddUser open={add} onClose={() => setAdd(false)} onCreated={(email, password, emailed) => { setAdd(false); setSecret({ email, password, emailed }); load(); }} />
      <Modal open={Boolean(secret)} onClose={() => setSecret(null)} title="Temporary password" footer={<Button onClick={() => setSecret(null)}>Done</Button>}>
        {secret && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{secret.emailed ? "We emailed these details to the user. " : "Share this with the user securely. "}It&apos;s shown only once. They can change it in Settings → Password.</p>
            <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm"><p className="text-xs text-muted">Email</p><p className="font-medium">{secret.email}</p><p className="mt-2 text-xs text-muted">Password</p>
              <div className="flex items-center justify-between gap-2"><code className="font-mono text-base font-semibold">{secret.password}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(secret.password); toast.success("Copied"); }}><Copy className="h-4 w-4" />Copy</Button></div></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AddUser({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (email: string, pw: string, emailed: boolean) => void }) {
  const [f, setF] = useState({ name: "", email: "", role: "user" as "user" | "admin", sendInvite: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ name: "", email: "", role: "user", sendInvite: true }); }, [open]);
  async function submit() {
    setBusy(true);
    try { const r = await api<{ tempPassword: string; emailed: boolean }>("/api/admin/users", { method: "POST", json: f }); onCreated(f.email, r.tempPassword, r.emailed); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Add a user" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Create account</Button></>}>
      <div className="space-y-4">
        <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "user" | "admin" })}><option value="user">User — can send and sign</option><option value="admin">Admin — also manages this portal</option></select></Field>
        <Toggle checked={f.sendInvite} onChange={(v) => setF({ ...f, sendInvite: v })} label="Email them their sign-in details" description="Requires email to be set up. You'll see the temporary password either way." />
      </div>
    </Modal>
  );
}
