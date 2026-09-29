import { getCompilazione, listUffici } from "@/lib/data";
import { generateCompilazionePdf } from "@/lib/compilazione-pdf";
import { getCurrentUser, canManageUfficio } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Genera al volo il PDF in carta intestata di una compilazione ricevuta, per
// il backoffice dell'ufficio destinatario. Stesso trust model della route
// allegati (moduli-compilazione-file): dati potenzialmente sensibili, quindi
// richiede login + permesso sull'ufficio del modulo a cui appartiene.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const compilazione = await getCompilazione(id);
  if (!compilazione) return new Response("Not found", { status: 404 });
  const uffici = await listUffici();
  if (!canManageUfficio(user, compilazione.ufficioId, uffici)) {
    return new Response("Non autorizzato", { status: 403 });
  }

  const pdf = await generateCompilazionePdf(compilazione);
  const nomeFile = `${compilazione.moduloTitolo}-${compilazione.id.slice(0, 8)}.pdf`
    .replace(/[^\w.\-]+/g, "_");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nomeFile)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
