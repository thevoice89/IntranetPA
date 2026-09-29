import { getRegolamentoFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Serve il PDF di un regolamento, inline (sfogliabile nel browser).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getRegolamentoFile(id);
  if (!meta) return new Response("Not found", { status: 404 });
  try {
    const buffer = await readUpload(meta.fileName);
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime || "application/pdf",
      nome: `${meta.titolo}.pdf`,
      cacheControl: "private, max-age=0",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
