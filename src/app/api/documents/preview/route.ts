import { HttpError, requireUser, route } from "@/lib/auth";
import { contentSchema } from "@/lib/documents";
import { renderDocument } from "@/lib/doc-render";

export const runtime = "nodejs";

/** Render unsaved content (with optional values) to a PDF for previewing or downloading. */
export const POST = route(async (req: Request) => {
  await requireUser();
  const body = (await req.json()) as { title?: string; content: unknown; values?: Record<string, string>; download?: boolean };
  const p = contentSchema.safeParse(body.content);
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid document");
  const title = (body.title || "Document").slice(0, 140);
  const { buffer } = await renderDocument(p.data, body.values ?? {}, { title });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${body.download ? "attachment" : "inline"}; filename="${title.replace(/[^\w .()-]/g, "_")}.pdf"`,
    },
  });
});
