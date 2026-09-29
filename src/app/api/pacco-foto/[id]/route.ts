import { getFotoPacco } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Serve la foto di un pacco ("Di chi è?") dal volume di storage, dato l'id del
// pacco stesso (una foto per pacco, niente tabella allegati separata). Pubblico
// come /api/moduli-allegato/[id]: la scheda pubblica del pacco è raggiungibile
// senza login dal widget in home.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getFotoPacco(id);
  if (!meta) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readUpload(meta.fileName);
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime,
      cacheControl: "private, max-age=0",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
