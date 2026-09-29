import { getAllegatoAvvisoFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Serve un file allegato a un avviso della bacheca "Avvisi e opportunità
// formative" dal volume di storage, dato l'id dell'allegato. Pubblico come
// /api/file/[id] e /api/moduli-allegato/[id]: la bacheca è visibile a
// chiunque sul sito.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getAllegatoAvvisoFile(id);
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
