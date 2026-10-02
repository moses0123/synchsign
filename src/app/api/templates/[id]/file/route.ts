import { route } from "@/lib/auth";
import { readFile } from "@/lib/db";
import { loadTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { t } = await loadTemplate((await params).id);
  const buf = await readFile(t.fileId);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=300" } });
});
