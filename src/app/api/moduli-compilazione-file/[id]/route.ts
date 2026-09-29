import { getCompilazioneAllegatoFile, listUffici } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";
import { getCurrentUser, canManageUfficio } from "@/lib/auth";

export const dynamic = "force-dynamic";

// A differenza delle altre route file (regolamento/guida-materiale/file, tutte
// pubbliche perché servono documenti pubblicati), questa serve allegati caricati
// da cittadini/dipendenti in una compilazione: può contenere dati sensibili, quindi
// richiede login + permesso sull'ufficio del modulo a cui appartiene.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const meta = await getCompilazioneAllegatoFile(id);
  if (!meta) return new Response("Not found", { status: 404 });
  const uffici = await listUffici();
  if (!canManageUfficio(user, meta.ufficioId, uffici)) {
    return new Response("Non autorizzato", { status: 403 });
  }

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
