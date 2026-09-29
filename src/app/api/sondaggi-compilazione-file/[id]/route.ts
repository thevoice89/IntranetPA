import { getCompilazioneSondaggioAllegatoFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";
import { getCurrentUser, canManageSondaggi } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Stesso trattamento di /api/moduli-compilazione-file: allegato caricato da chi
// risponde a un sondaggio, può contenere dati sensibili, quindi richiede login +
// permesso canManageSondaggi (qui senza per-ufficio: è un flag unico).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageSondaggi(user)) return new Response("Non autorizzato", { status: 401 });

  const meta = await getCompilazioneSondaggioAllegatoFile(id);
  if (!meta) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readUpload(meta.fileName);
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime,
      nome: meta.fileNameOriginale,
      cacheControl: "private, no-store",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
