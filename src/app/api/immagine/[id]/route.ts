import { getImmagineTesto } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Serve un'immagine inserita nel testo di una comunicazione (editor ricco).
// Gemella di /api/file/[id] per gli allegati, con due differenze: qui il
// Content-Disposition inline non serve (è un <img>, non un download) e la
// risposta è cacheabile a lungo, perché l'id è un UUID che non viene mai
// riusato — il contenuto a quell'URL non cambia mai.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = await getImmagineTesto(id);
  if (!meta) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readUpload(meta.fileName);
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime,
      cacheControl: "private, max-age=31536000, immutable",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
