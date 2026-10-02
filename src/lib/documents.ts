import "server-only";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { HttpError, requireUser } from "./auth";
import { getDb, oid } from "./db";
import type { DocContent } from "./doc-model";

export interface DocRecord {
  _id: ObjectId; ownerId: ObjectId; title: string; starter?: string; content: DocContent;
  createdAt: Date; updatedAt: Date; uses: number;
}

export async function docs() { return (await getDb()).collection<DocRecord>("documents"); }

export async function loadDoc(id: string) {
  const me = await requireUser();
  const _id = oid(id);
  if (!_id) throw new HttpError(404, "Document not found");
  const col = await docs();
  const d = await col.findOne({ _id, ownerId: me.oid });
  if (!d) throw new HttpError(404, "Document not found");
  return { me, d, col };
}

const block = z.object({
  id: z.string().max(40),
  type: z.enum(["heading", "subheading", "paragraph", "bullets", "numbered", "table", "divider", "spacer", "pagebreak", "signature", "note"]),
  text: z.string().max(8000).optional(),
  items: z.array(z.string().max(2000)).max(100).optional(),
  rows: z.array(z.array(z.string().max(1000)).max(8)).max(100).optional(),
  roleId: z.string().max(40).optional(),
  align: z.enum(["left", "center"]).optional(),
  header: z.boolean().optional(),
});
export const contentSchema = z.object({
  blocks: z.array(block).max(600),
  roles: z.array(z.object({
    id: z.string().max(40), name: z.string().trim().max(80), role: z.enum(["signer", "approver", "cc"]),
    order: z.number().int().min(1).max(50), color: z.string().max(20),
  })).max(20),
  branding: z.object({
    companyName: z.string().max(120), logo: z.string().startsWith("data:image/").max(400_000).nullable(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), headerText: z.string().max(160), footerText: z.string().max(160),
    pageNumbers: z.boolean(), fontSize: z.enum(["small", "normal", "large"]),
  }),
  variableLabels: z.record(z.string(), z.string().max(80)).optional(),
});

export const serializeDoc = (d: DocRecord) => ({ ...d, _id: d._id.toString(), ownerId: undefined });
