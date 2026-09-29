import { getAllegatoFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Serve un file allegato dal volume di storage, dato l'id dell'allegato.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getAllegatoFile(id);
  if (!meta) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readUpload(meta.fileName);
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime,
      nome: meta.etichetta,
      cacheControl: "private, max-age=0",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
