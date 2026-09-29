import { getCartaIntestataFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Scarica un file di Carta Intestata (sempre come allegato: sono modelli da
// riusare in Word/editor immagini, non documenti da consultare online).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getCartaIntestataFile(id);
  if (!meta) return new Response("Not found", { status: 404 });
  try {
    const buffer = await readUpload(meta.fileName);
    // L'estensione del file originale viene aggiunta al titolo da rispostaUpload.
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime,
      nome: meta.titolo,
      sempreDownload: true,
      cacheControl: "private, max-age=0",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
