import { HttpError, route } from "@/lib/auth";
import { readFile } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loadSigner, type TokenCtx } from "@/lib/signer";

export const runtime = "nodejs";

export const GET = route(async (req: Request, { params }: TokenCtx) => {
  const { token } = await params;
  const { env, r } = await loadSigner(req, token);
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const final = kind === "final", cert = kind === "certificate";
  if (final && !env.completedFileId) throw new HttpError(404, "The signed copy isn't ready yet");
  if (cert && !env.certificateFileId) throw new HttpError(404, "The certificate isn't ready yet");
  if (env.status === "voided") throw new HttpError(410, "This envelope was voided by the sender");
  const buf = await readFile(final ? env.completedFileId! : cert ? env.certificateFileId! : env.fileId);
  if (final || cert) await logAudit(env._id, "downloaded", { actor: r.name, email: r.email, details: cert ? "Certificate of completion" : "Signed document" });
  const name = `${env.title}${final ? " (signed)" : cert ? " - Certificate of Completion" : ""}.pdf`.replace(/[^\w .()-]/g, "_");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
