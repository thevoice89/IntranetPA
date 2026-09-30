import { getImpostazioni } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";
import { IMMAGINI_ENTE, eTipoImmagineEnte } from "@/lib/branding";

export const dynamic = "force-dynamic";

// Serve lo stemma o il logo caricato dall'ente da /admin/impostazioni. Pubblica
// come /stemma.png (compare anche nelle pagine senza login). Se l'ente non ha
// caricato nulla risponde 404: in quel caso brandingDa() non genera mai questo
// URL e la pagina usa direttamente il file predefinito in /public.
// L'URL porta ?v=<nome del file>, cambia a ogni nuova immagine: la risposta può
// quindi essere cacheata a lungo senza rischiare di mostrare quella vecchia.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const { tipo } = await params;
  if (!eTipoImmagineEnte(tipo)) return new Response("Not found", { status: 404 });

  const file = (await getImpostazioni())[IMMAGINI_ENTE[tipo].chiaveFile];
  if (!file) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readUpload(file);
    return rispostaUpload(buffer, {
      fileName: file,
      // Il PNG è verificato al caricamento (verificaPng): il tipo non lo decide
      // il browser di chi ha caricato il file.
      mime: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
