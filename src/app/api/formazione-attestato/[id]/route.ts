import { getFormazioneAttestatoFile } from "@/lib/data";
import { readUpload, rispostaUpload } from "@/lib/uploads";
import { getCurrentUser, canVedereFormazioneTutti } from "@/lib/auth";
import { sovrintende } from "@/lib/gerarchia";

export const dynamic = "force-dynamic";

// Attestato di un'attività formativa: dato personale, non pubblico. Può
// scaricarlo solo chi l'ha caricato, chi lo sovrintende (vedi lib/gerarchia.ts)
// o chi ha il permesso piatto di vedere la formazione di tutti — stesso trust
// model di moduli-compilazione-file (login + permesso, mai solo l'id nell'URL).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const meta = await getFormazioneAttestatoFile(id);
  if (!meta) return new Response("Not found", { status: 404 });

  const isProprio = user.contattoId === meta.contattoId;
  const isAutorizzato =
    user.ruolo === "admin" ||
    isProprio ||
    canVedereFormazioneTutti(user) ||
    (user.contattoId ? await sovrintende(user.contattoId, meta.contattoId) : false);
  if (!isAutorizzato) return new Response("Non autorizzato", { status: 403 });

  try {
    const buffer = await readUpload(meta.fileName);
    return rispostaUpload(buffer, {
      fileName: meta.fileName,
      mime: meta.mime,
      nome: meta.nomeOriginale,
      cacheControl: "private, no-store",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
