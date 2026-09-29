import type { Contatto, StatoPresenza } from "@/types";
import { formatGiornoColonna, dotClass, labelStato } from "@/lib/presenze-calendario";

export interface RigaPresenzaMensile {
  contatto: Contatto;
  giorniContatto: Map<string, StatoPresenza>;
  assenze: number;
  smart: number;
}

// Tabella mensile a bollini condivisa tra /admin/presenze (pagina completa) e
// il widget "Presenze del team" in dashboard: la colonna del giorno odierno
// (oggiIso) resta evidenziata in entrambe, per un colpo d'occhio su chi manca
// oggi senza dover cercare la data in mezzo al mese.
export function PresenzeTabellaMensile({
  giorni,
  righe,
  oggiIso,
}: {
  giorni: string[];
  righe: RigaPresenzaMensile[];
  oggiIso: string;
}) {
  return (
    <div className="presenza-tabella-wrap">
      <table className="presenza-tabella">
        <thead>
          <tr>
            <th className="presenza-tabella__nome" />
            {giorni.map((iso) => {
              const { giorno, settimana } = formatGiornoColonna(iso);
              return (
                <th key={iso} className={iso === oggiIso ? "presenza-tabella__oggi" : undefined}>
                  <div className="presenza-tabella__settimana">{settimana}</div>
                  {giorno}
                </th>
              );
            })}
            <th>Assenze</th>
            <th>Smart</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(({ contatto, giorniContatto, assenze, smart }) => (
            <tr key={contatto.id}>
              <td className="presenza-tabella__nome">{contatto.nome}</td>
              {giorni.map((iso) => {
                const stato = giorniContatto.get(iso) ?? null;
                return (
                  <td
                    key={iso}
                    className={iso === oggiIso ? "presenza-tabella__oggi" : undefined}
                    title={`${iso} · ${labelStato(stato)}`}
                  >
                    <span className={`presenza-dot ${dotClass(stato)}`} />
                  </td>
                );
              })}
              <td>{assenze}</td>
              <td>{smart}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
