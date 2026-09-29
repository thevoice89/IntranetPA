import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getContatti, getStatoPresenzeInPeriodo, listUffici } from "@/lib/data";
import { sottopostiDi } from "@/lib/gerarchia";
import { antenatiDi, espandiConDiscendenti, elencoIndentato } from "@/lib/uffici-tree";
import { NOMI_MESE, giorniDelMese, oggiIso } from "@/lib/presenze-calendario";
import { PresenzeTabellaMensile } from "@/components/admin/PresenzeTabellaMensile";
import { FiltroUfficio } from "@/components/admin/FiltroUfficio";
import SyncTimbratureButton from "./SyncTimbratureButton";
import type { Contatto, StatoPresenza } from "@/types";

export const dynamic = "force-dynamic";

// Vista dei responsabili (e dell'admin, che vede sempre tutti) sulle presenze
// dei propri collaboratori: stessa logica di accesso di /admin/formazione
// (vedi lib/gerarchia.ts), calendario mensile a bollini riusato da /presenze.
export default async function AdminPresenzeTeam({
  searchParams,
}: {
  searchParams: Promise<{ anno?: string; mese?: string; ufficio?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.ruolo === "admin";

  let collaboratori: Contatto[] = [];
  if (isAdmin) {
    collaboratori = await getContatti();
  } else if (user.contattoId) {
    collaboratori = await sottopostiDi(user.contattoId);
  }
  if (collaboratori.length === 0) redirect("/admin");

  const [annoOggi, meseOggi] = oggiIso().split("-").map(Number);
  const { anno: annoParam, mese: meseParam, ufficio: ufficioParam } = await searchParams;
  let anno = Number(annoParam);
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) anno = annoOggi;
  let mese = Number(meseParam);
  if (!Number.isInteger(mese) || mese < 1 || mese > 12) mese = meseOggi;

  // Filtro per ufficio: opzioni limitate al ramo dell'organigramma davvero
  // popolato dai collaboratori visibili (i loro uffici + antenati), non
  // all'intera azienda — evitando di proporre voci dove il filtro darebbe
  // sempre zero risultati. Di default nessun filtro: si vede tutto.
  const uffici = await listUffici();
  const nodiRilevanti = new Set<string>();
  for (const c of collaboratori) {
    for (const u of c.uffici) {
      for (const id of antenatiDi(u.id, uffici)) nodiRilevanti.add(id);
    }
  }
  const opzioniUfficio = elencoIndentato(uffici).filter((u) => nodiRilevanti.has(u.id));

  const giorni = giorniDelMese(anno, mese);
  let persone = [...collaboratori].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  if (ufficioParam) {
    const idsRamo = new Set(espandiConDiscendenti([ufficioParam], uffici));
    persone = persone.filter((c) => c.uffici.some((u) => idsRamo.has(u.id)));
  }
  const idVisibili = new Set(persone.map((c) => c.id));

  const stati = await getStatoPresenzeInPeriodo(giorni[0], giorni[giorni.length - 1]);
  const perContatto = new Map<string, Map<string, StatoPresenza>>();
  for (const r of stati) {
    if (!idVisibili.has(r.id)) continue;
    if (!perContatto.has(r.id)) perContatto.set(r.id, new Map());
    perContatto.get(r.id)!.set(r.data, r.tipo);
  }

  let totAssenze = 0;
  let totSmart = 0;
  const righe = persone.map((c) => {
    const giorniContatto = perContatto.get(c.id) ?? new Map<string, StatoPresenza>();
    let assenze = 0;
    let smart = 0;
    for (const tipo of giorniContatto.values()) {
      if (tipo === "assente") assenze++;
      else smart++;
    }
    totAssenze += assenze;
    totSmart += smart;
    return { contatto: c, giorniContatto, assenze, smart };
  });

  let mesePrec = mese - 1;
  let annoPrec = anno;
  if (mesePrec < 1) { mesePrec = 12; annoPrec -= 1; }
  let meseSucc = mese + 1;
  let annoSucc = anno;
  if (meseSucc > 12) { meseSucc = 1; annoSucc += 1; }
  const qsUfficio = ufficioParam ? `&ufficio=${ufficioParam}` : "";
  const oggiIsoValore = oggiIso();

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Presenze del team</h1>
            <p>
              {isAdmin
                ? "Calendario e statistiche di assenze e smart working di tutti i dipendenti."
                : "Calendario e statistiche di assenze e smart working dei tuoi collaboratori."}
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <SyncTimbratureButton />
              <SyncTimbratureButton poliziaLocale />
            </div>
          )}
        </div>
      </header>

      {opzioniUfficio.length > 1 && <FiltroUfficio opzioni={opzioniUfficio} />}

      <div className="stat-grid">
        <div className="card stat">
          <div className="stat__value">{totAssenze}</div>
          <div className="stat__label">Assenze in {NOMI_MESE[mese - 1]}</div>
        </div>
        <div className="card stat">
          <div className="stat__value">{totSmart}</div>
          <div className="stat__label">Giorni di smart working in {NOMI_MESE[mese - 1]}</div>
        </div>
        <div className="card stat">
          <div className="stat__value">{persone.length}</div>
          <div className="stat__label">
            {isAdmin ? "Dipendenti monitorati" : "Collaboratori monitorati"}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <div className="calendar__head">
          <Link
            href={`/admin/presenze?anno=${annoPrec}&mese=${mesePrec}${qsUfficio}`}
            className="btn btn--ghost btn--sm"
            aria-label="Mese precedente"
          >
            ‹
          </Link>
          <div className="calendar__title">{NOMI_MESE[mese - 1]} {anno}</div>
          <Link
            href={`/admin/presenze?anno=${annoSucc}&mese=${meseSucc}${qsUfficio}`}
            className="btn btn--ghost btn--sm"
            aria-label="Mese successivo"
          >
            ›
          </Link>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.1rem" }}>
          <span className="status status--offline">Assente</span>
          <span className="status status--smartworking">Smart working</span>
        </div>

        <PresenzeTabellaMensile giorni={giorni} righe={righe} oggiIso={oggiIsoValore} />
      </div>
    </section>
  );
}
