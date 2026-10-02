import { HttpError, route } from "@/lib/auth";
import { readFile } from "@/lib/db";
import { loadOwned, type Ctx } from "@/lib/owned";

export const runtime = "nodejs";

export const GET = route(async (req: Request, { params }: Ctx) => {
  const { env } = await loadOwned((await params).id);
  const kind = new URL(req.url).searchParams.get("kind");
  const dl = new URL(req.url).searchParams.get("download") === "1";
  const id = kind === "final" ? env.completedFileId : kind === "certificate" ? env.certificateFileId : env.fileId;
  if (!id) throw new HttpError(404, kind === "certificate" ? "The certificate isn't ready yet" : "The signed copy isn't ready yet");
  const buf = await readFile(id);
  const suffix = kind === "final" ? " (signed)" : kind === "certificate" ? " - Certificate of Completion" : "";
  const name = `${env.title}${suffix}.pdf`.replace(/[^\w .()-]/g, "_");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
});
