import { getAllegatoModuloFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Serve un file allegato al modulo (documento di riferimento, non una
// risposta caricata da chi compila) dal volume di storage, dato l'id
// dell'allegato. Pubblico come /api/file/[id]: i moduli pubblicati sono
// visibili a chiunque sul sito.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getAllegatoModuloFile(id);
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
