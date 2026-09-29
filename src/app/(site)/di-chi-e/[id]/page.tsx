import Link from "next/link";
import { notFound } from "next/navigation";
import { getPacco, getContatti } from "@/lib/data";
import { formatData } from "@/lib/format";
import ClaimPaccoForm from "@/components/ui/ClaimPaccoForm";
import { rivendicaPaccoAction } from "@/app/(site)/di-chi-e/[id]/actions";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  contatto: "Seleziona il tuo nominativo dalla rubrica prima di confermare.",
  giaAssegnato: "Nel frattempo qualcun altro ha già dichiarato che questo pacco è suo.",
};

function formatDataOra(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

export default async function DiChiEPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const pacco = await getPacco(id);
  if (!pacco) notFound();

  const contatti = pacco.rivendicatoIl ? [] : await getContatti();

  return (
    <section>
      <header className="page-header">
        <h1>Di chi è questo pacco?</h1>
        <p>È arrivato un pacco in reception: aiutaci a trovare il destinatario.</p>
      </header>

      <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {ok && (
          <div className="notice notice--ok">
            Grazie! Abbiamo avvisato la reception: passa a ritirarlo quando vuoi.
          </div>
        )}
        {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati e riprova."}</div>}

        <div className="card" style={{ padding: "1.5rem" }}>
          {pacco.hasFoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/pacco-foto/${pacco.id}`}
              alt="Foto del pacco"
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 8, marginBottom: "1rem" }}
            />
          )}
          <dl style={{ margin: 0 }}>
            <dt className="help">Arrivato il</dt>
            <dd style={{ margin: "0 0 0.8rem" }}>{formatData(pacco.dataArrivo)}</dd>
            <dt className="help">Mittente</dt>
            <dd style={{ margin: "0 0 0.8rem" }}>{pacco.mittente || "non indicato"}</dd>
            <dt className="help">Descrizione</dt>
            <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{pacco.descrizione || "nessuna descrizione"}</dd>
          </dl>
        </div>

        {pacco.rivendicatoIl ? (
          <div className="card empty">
            Questo pacco è già stato assegnato a {pacco.rivendicatoNome} il{" "}
            {formatDataOra(pacco.rivendicatoIl)}.
          </div>
        ) : (
          <ClaimPaccoForm contatti={contatti} action={rivendicaPaccoAction.bind(null, pacco.id)} />
        )}

        <Link href="/" className="help">
          ← Torna alla home
        </Link>
      </div>
    </section>
  );
}
