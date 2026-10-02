"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookUser, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, EmptyState, Modal, Skeleton, api } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

interface Contact { _id: string; name: string; email: string; company?: string; phone?: string; notes?: string; uses: number; lastUsedAt: string; favorite?: boolean }
const empty = { name: "", email: "", company: "", phone: "", notes: "" };

export default function Contacts() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Contact[] | null>(null);
  const [edit, setEdit] = useState<(typeof empty & { _id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (query = q) => api<{ contacts: Contact[] }>(`/api/contacts?q=${encodeURIComponent(query)}`).then((d) => setItems(d.contacts)).catch(() => setItems([]));
  useEffect(() => { const t = setTimeout(() => load(q), q ? 200 : 0); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit._id) await api(`/api/contacts/${edit._id}`, { method: "PATCH", json: edit });
      else await api("/api/contacts", { method: "POST", json: edit });
      toast.success("Contact saved"); setEdit(null); load();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  async function fav(c: Contact) {
    setItems((l) => l?.map((x) => (x._id === c._id ? { ...x, favorite: !x.favorite } : x)) ?? null);
    await api(`/api/contacts/${c._id}`, { method: "PATCH", json: { favorite: !c.favorite } }).catch(() => {});
  }
  async function remove(c: Contact) {
    if (!confirm(`Remove ${c.name} from contacts?`)) return;
    await api(`/api/contacts/${c._id}`, { method: "DELETE" }).then(() => { toast.success("Contact removed"); load(); }).catch((e) => toast.error(e.message));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">Contacts</h1>
          <p className="mt-1 text-sm text-muted">People you send to are saved automatically and suggested as you type.</p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Button onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add contact</span></Button>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        {!items && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {items && !items.length && <EmptyState icon={<BookUser className="h-6 w-6" />} title={q ? "No matches" : "No contacts yet"} body={q ? "Try a different name or email." : "Add people manually, or they'll appear here after you send your first envelope."} />}
        {items && items.length > 0 && (
          <div className="hidden grid-cols-[1fr_1fr_140px_96px] gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-medium text-muted md:grid">
            <span>Name</span><span>Company</span><span>Last sent</span><span />
          </div>
        )}
        {items?.map((c, i) => (
          <motion.div key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[1fr_1fr_140px_96px] md:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={c.name} size={34} />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{c.name}</p><p className="truncate text-xs text-muted">{c.email}</p></div>
            </div>
            <span className="hidden truncate text-sm text-muted md:block">{c.company || "—"}</span>
            <span className="hidden text-sm text-muted md:block">{c.uses ? `${timeAgo(c.lastUsedAt)} · ${c.uses}×` : "Never"}</span>
            <div className="flex justify-end gap-0.5">
              <button onClick={() => fav(c)} className={cn("rounded-md p-2 hover:bg-surface-2", c.favorite ? "text-amber-500" : "text-muted")} aria-label="Favourite"><Star className={cn("h-4 w-4", c.favorite && "fill-current")} /></button>
              <button onClick={() => setEdit({ _id: c._id, name: c.name, email: c.email, company: c.company ?? "", phone: c.phone ?? "", notes: c.notes ?? "" })} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(c)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-rose-500" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? "Edit contact" : "Add contact"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="label">Full name</span><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="label">Email</span><input className="input" type="email" disabled={Boolean(edit._id)} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
            <label className="block"><span className="label">Company</span><input className="input" value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></label>
            <label className="block"><span className="label">Phone</span><input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="label">Notes</span><textarea className="input min-h-[80px]" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
          </div>
        )}
      </Modal>
    </div>
  );
}
