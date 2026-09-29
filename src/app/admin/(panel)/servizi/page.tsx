import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getServizi, getServizio } from "@/lib/data";
import { saveServizio } from "@/app/admin/actions";
import { STATI_SERVIZIO } from "@/types";
import { EMOJI_SERVIZI } from "@/lib/emoji";
import SortableList from "./SortableList";

export const dynamic = "force-dynamic";

export default async function AdminServizi({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const servizi = await getServizi();
  const inModifica = edit ? await getServizio(edit) : null;

  // Icona corrente preselezionata; se non è in libreria, la aggiunge in cima.
  const iconaCorrente = inModifica?.icona ?? "🔗";
  const opzioniEmoji = EMOJI_SERVIZI.some((o) => o.e === iconaCorrente)
    ? EMOJI_SERVIZI
    : [{ e: iconaCorrente, label: "Attuale" }, ...EMOJI_SERVIZI];

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Strumenti</h1>
            <p>Gestisci gli strumenti mostrati nella Dashboard Strumenti.</p>
          </div>
          {edit && (
            <Link href="/admin/servizi" className="btn btn--ghost btn--sm">
              + Nuovo strumento
            </Link>
          )}
        </div>
      </header>

      {/* --- Form crea/modifica --- */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.nome}` : "Nuovo strumento"}
        </h2>
        <form action={saveServizio} className="form">
          <input type="hidden" name="id" value={inModifica?.id ?? ""} />
          <div className="field--row">
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input id="nome" name="nome" className="input" required defaultValue={inModifica?.nome ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="categoria">Categoria</label>
              <input id="categoria" name="categoria" className="input" defaultValue={inModifica?.categoria ?? ""} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="descrizione">Descrizione</label>
            <input id="descrizione" name="descrizione" className="input" defaultValue={inModifica?.descrizione ?? ""} />
          </div>
          <div className="field--row">
            <div className="field">
              <label htmlFor="url">URL</label>
              <input id="url" name="url" className="input" placeholder="https://..." defaultValue={inModifica?.url ?? ""} />
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="icona">Icona emoji</label>
                <select id="icona" name="icona" className="select" defaultValue={iconaCorrente}>
                  {opzioniEmoji.map((o) => (
                    <option key={o.e} value={o.e}>
                      {o.e}  {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="stato">Stato</label>
                <select id="stato" name="stato" className="select" defaultValue={inModifica?.stato ?? "attivo"}>
                  {STATI_SERVIZIO.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn--primary">
              {inModifica ? "Salva modifiche" : "Crea strumento"}
            </button>
          </div>
        </form>
      </div>

      {/* --- Elenco (trascina per riordinare) --- */}
      <SortableList servizi={servizi} />
    </section>
  );
}
