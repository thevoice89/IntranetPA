import Link from "next/link";
import {
  requireUser,
  canEdit,
  canEditAny,
  canManageAnyUfficio,
  canManageSondaggi,
  canManageSegnalazioni,
  canVedereFormazioneTutti,
} from "@/lib/auth";
import {
  listUffici,
  getContatto,
  getContatti,
  getStatoPresenzeInPeriodo,
  listTuttiCommenti,
  countCompilazioniNonLette,
  countCompilazioniSondaggiNonLette,
  countSegnalazioniNonLette,
  getPrenotazioniSalaDaNotificare,
  getAssenzeContattoAnno,
  getFormazioneAttivitaContatto,
  getModuliPubblicati,
} from "@/lib/data";
import { espandiConDiscendenti } from "@/lib/uffici-tree";
import { sottopostiDi } from "@/lib/gerarchia";
import { formatData } from "@/lib/format";
import { giorniDelMese, oggiIso } from "@/lib/presenze-calendario";
import { PresenzeTabellaMensile, type RigaPresenzaMensile } from "@/components/admin/PresenzeTabellaMensile";
import type { StatoPresenza } from "@/types";

export const dynamic = "force-dynamic";

// Dashboard personale: solo statistiche individuali e notifiche su cui c'è
// un'azione da fare (commenti/compilazioni moduli/risposte sondaggi/segnalazioni
// da leggere, prenotazioni sale da seguire). La gestione dei contenuti che non
// genera notifiche (comunicazioni, regolamenti, carta intestata, guide,
// rubrica, procedure, moduli, gestione sondaggi, ecc.) resta nel menu di
// sinistra: qui creerebbe solo doppioni senza portare informazioni nuove.
export default async function AdminHome() {
  const user = await requireUser();
  const isAdmin = user.ruolo === "admin";

  const gestisceModuli = canManageAnyUfficio(user);
  // Cascata: gli uffici "propri" di un editor sono quelli assegnati più tutti i discendenti.
  const ufficiPropri =
    gestisceModuli && !isAdmin ? espandiConDiscendenti(user.uffici, await listUffici()) : null;
  const gestisceSondaggi = canManageSondaggi(user);
  const gestisceSegnalazioni = canManageSegnalazioni(user);
  // Stessa condizione di admin/(panel)/layout.tsx e (site)/formazione: admin,
  // chi vede la formazione di tutti, o chi risulta responsabile (anche
  // indiretto) di almeno un collega. Calcolato sempre (non solo quando serve
  // per la Formazione) perché lo stesso elenco di sottoposti serve anche al
  // widget "Presenze del team" sotto, la cui visibilità non dipende da
  // canVedereFormazioneTutti (permesso specifico della Formazione).
  const vedeFormazioneTutti = isAdmin || canVedereFormazioneTutti(user);
  const sottoposti = !isAdmin && user.contattoId ? await sottopostiDi(user.contattoId) : [];
  const eResponsabile = sottoposti.length > 0;
  const gestisceFormazione = vedeFormazioneTutti || eResponsabile;

  // Il saluto usa il nome del contatto rubrica collegato all'account (se presente),
  // così un editor profilato solo con username/password si vede comunque salutare
  // per nome. Nessun collegamento -> resta lo username, come prima.
  const contattoCollegato = user.contattoId ? await getContatto(user.contattoId) : null;
  const nomeVisualizzato = contattoCollegato?.nome ?? user.username;

  // Notifica "in app" delle prenotazioni sale per cui l'utente è configurato come
  // destinatario email (sale.email_notifica): equivalente della notifica via email,
  // utile anche finché l'SMTP resta senza credenziali. Vuoto per chi non è
  // destinatario di nessuna sala (la maggioranza degli utenti).
  const prenotazioniDaNotificare = contattoCollegato?.email
    ? await getPrenotazioniSalaDaNotificare(contattoCollegato.email)
    : [];

  // Statistiche personali (presenze + formazione), quest'anno: visibili solo a
  // chi ha un contatto rubrica collegato, stessa identità già usata per
  // Formazione e per la notifica prenotazioni sale qui sopra.
  const annoCorrente = Number(oggiIso().slice(0, 4));
  const statPresenze = contattoCollegato
    ? await getAssenzeContattoAnno(contattoCollegato.id, annoCorrente)
    : null;
  const formazioneAnno = contattoCollegato
    ? (await getFormazioneAttivitaContatto(contattoCollegato.id)).filter((a) =>
        a.dataCorso.startsWith(String(annoCorrente))
      )
    : [];
  const oreFormazioneAnno = formazioneAnno.reduce((tot, a) => tot + a.oreSvolte, 0);

  // Widget "Presenze del team": stessa visibilità di /admin/presenze (admin
  // vede tutti, un responsabile solo i propri sottoposti), mese corrente con
  // la colonna di oggi evidenziata. Capato a poche righe: il calendario
  // completo con navigazione tra i mesi resta sulla pagina dedicata,
  // raggiungibile dal link in fondo al widget.
  const oggiIsoValore = oggiIso();
  const [annoWidget, meseWidget] = oggiIsoValore.split("-").map(Number);
  const giorniWidget = giorniDelMese(annoWidget, meseWidget);
  const MAX_RIGHE_WIDGET_PRESENZE = 8;
  const collaboratoriPresenze = isAdmin ? await getContatti() : sottoposti;
  let righePresenzeWidget: RigaPresenzaMensile[] = [];
  let assentiOggiCount = 0;
  let smartOggiCount = 0;
  if (collaboratoriPresenze.length > 0) {
    const statiWidget = await getStatoPresenzeInPeriodo(
      giorniWidget[0],
      giorniWidget[giorniWidget.length - 1]
    );
    const idVisibiliPresenze = new Set(collaboratoriPresenze.map((c) => c.id));
    const perContattoWidget = new Map<string, Map<string, StatoPresenza>>();
    for (const r of statiWidget) {
      if (!idVisibiliPresenze.has(r.id)) continue;
      if (!perContattoWidget.has(r.id)) perContattoWidget.set(r.id, new Map());
      perContattoWidget.get(r.id)!.set(r.data, r.tipo);
    }
    for (const mappa of perContattoWidget.values()) {
      const oggiStato = mappa.get(oggiIsoValore);
      if (oggiStato === "assente") assentiOggiCount++;
      else if (oggiStato === "smartworking") smartOggiCount++;
    }
    const ordinati = [...collaboratoriPresenze].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    righePresenzeWidget = ordinati.slice(0, MAX_RIGHE_WIDGET_PRESENZE).map((c) => {
      const giorniContatto = perContattoWidget.get(c.id) ?? new Map<string, StatoPresenza>();
      let assenze = 0;
      let smart = 0;
      for (const tipo of giorniContatto.values()) {
        if (tipo === "assente") assenze++;
        else smart++;
      }
      return { contatto: c, giorniContatto, assenze, smart };
    });
  }

  // Ogni sezione carica i propri dati solo se l'utente può effettivamente
  // aprirla: sia per non sprecare query, sia perché la card stessa (sotto)
  // compare solo con il relativo permesso.
  const compilazioniNonLette = gestisceModuli
    ? await countCompilazioniNonLette(isAdmin ? null : ufficiPropri)
    : 0;
  const compilazioniSondaggiNonLette = gestisceSondaggi
    ? await countCompilazioniSondaggiNonLette()
    : 0;
  const segnalazioniNonLette = gestisceSegnalazioni ? await countSegnalazioniNonLette() : 0;
  // Stesso filtro di admin/commenti: un editor non-admin vede/conta solo i
  // commenti sulle comunicazioni dei tipi che può gestire.
  const commentiNonLetti = canEditAny(user)
    ? (await listTuttiCommenti()).filter((cm) => canEdit(user, cm.comunicazioneTipo) && !cm.letta)
        .length
    : 0;

  // Moduli disponibili da compilare: per chiunque sia loggato, non solo per
  // chi li gestisce — un editor di Moduli è anche un dipendente che a volte
  // deve compilarne uno. Prima, per farlo, doveva tornare alla home pubblica:
  // vedi progetto "matita + login" per il contesto.
  const MAX_MODULI_WIDGET = 5;
  const moduliDisponibili = await getModuliPubblicati();

  const hasAnyCard =
    canEditAny(user) ||
    gestisceModuli ||
    gestisceSondaggi ||
    gestisceSegnalazioni ||
    gestisceFormazione ||
    prenotazioniDaNotificare.length > 0 ||
    righePresenzeWidget.length > 0 ||
    moduliDisponibili.length > 0;

  return (
    <section>
      <header className="page-header">
        <h1>Ciao, {nomeVisualizzato}</h1>
        <p>Pannello di amministrazione dell&apos;intranet.</p>
      </header>

      {contattoCollegato && (
        <div className="stat-grid">
          <Link href="/presenze" className="card stat stat--link">
            <div className="stat__value">{statPresenze!.assenze} Assenze</div>
            <div className="stat__label">nel {annoCorrente} · calendario presenze →</div>
          </Link>
          <Link href="/presenze" className="card stat stat--link">
            <div className="stat__value">{statPresenze!.smartworking} Smart</div>
            <div className="stat__label">nel {annoCorrente} · calendario presenze →</div>
          </Link>
          <Link href="/formazione" className="card stat stat--link">
            <div className="stat__value">{oreFormazioneAnno}</div>
            <div className="stat__label">
              Ore di formazione nel {annoCorrente}
              {formazioneAnno.length > 0 &&
                ` (${formazioneAnno.length} corso${formazioneAnno.length === 1 ? "" : "i"})`}
              {" "}→
            </div>
          </Link>
        </div>
      )}

      {prenotazioniDaNotificare.length > 0 && (
        <div className="card widget" style={{ marginBottom: "1.5rem" }}>
          <div className="widget__title">
            🔔 Prenotazioni sale da seguire
            <span className="badge">{prenotazioniDaNotificare.length}</span>
          </div>
          <ul className="widget-assenti__list">
            {prenotazioniDaNotificare.map((p) => (
              <li key={p.id} className="widget-assenti__item">
                <span className="widget-assenti__nome">{p.salaNome}</span>
                <span className="help">
                  {formatData(p.data)} · dalle {p.oraInizio} alle {p.oraFine} · {p.richiedente}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {righePresenzeWidget.length > 0 && (
        <div className="card widget" style={{ marginBottom: "1.5rem" }}>
          <div className="widget__title">
            📅 Presenze del team
            {(assentiOggiCount > 0 || smartOggiCount > 0) && (
              <span className="badge">
                {assentiOggiCount > 0 && `${assentiOggiCount} assent${assentiOggiCount === 1 ? "e" : "i"} oggi`}
                {assentiOggiCount > 0 && smartOggiCount > 0 && " · "}
                {smartOggiCount > 0 && `${smartOggiCount} smart oggi`}
              </span>
            )}
          </div>
          <PresenzeTabellaMensile giorni={giorniWidget} righe={righePresenzeWidget} oggiIso={oggiIsoValore} />
          {collaboratoriPresenze.length > MAX_RIGHE_WIDGET_PRESENZE && (
            <p className="help" style={{ marginTop: "0.75rem" }}>
              +{collaboratoriPresenze.length - MAX_RIGHE_WIDGET_PRESENZE} altri collaboratori.
            </p>
          )}
          <Link href="/admin/presenze" className="widget-link" style={{ marginTop: "0.9rem" }}>
            Vedi tutti i {collaboratoriPresenze.length} collaboratori
            <span className="widget-link__arrow">→</span>
          </Link>
        </div>
      )}

      {moduliDisponibili.length > 0 && (
        <div className="card widget" style={{ marginBottom: "1.5rem" }}>
          <div className="widget__title">📝 Moduli disponibili</div>
          <ul className="widget-assenti__list">
            {moduliDisponibili.slice(0, MAX_MODULI_WIDGET).map((m) => (
              <li key={m.id} className="widget-assenti__item">
                <Link href={`/moduli/${m.id}`} className="widget-assenti__nome">{m.titolo}</Link>
                <span className="help">{m.ufficioNome}</span>
              </li>
            ))}
          </ul>
          {moduliDisponibili.length > MAX_MODULI_WIDGET && (
            <p className="help" style={{ marginTop: "0.75rem" }}>
              +{moduliDisponibili.length - MAX_MODULI_WIDGET} altri moduli.
            </p>
          )}
          <Link href="/moduli" className="widget-link" style={{ marginTop: "0.9rem" }}>
            Vedi tutti i {moduliDisponibili.length} moduli
            <span className="widget-link__arrow">→</span>
          </Link>
        </div>
      )}

      {!hasAnyCard && (
        <div className="card empty">
          Nessuna notifica al momento. Per gestire i contenuti dell&apos;intranet usa il menu a
          sinistra.
        </div>
      )}

      <div className="quick-grid">
        {canEditAny(user) && (
          <Link href="/admin/commenti" className="card quick-card">
            <h2>💬 Commenti</h2>
            <p>Commenti ricevuti sulle comunicazioni.</p>
            <span className="quick-card__arrow">
              {commentiNonLetti > 0 ? `${commentiNonLetti} da leggere →` : "Apri →"}
            </span>
          </Link>
        )}
        {gestisceModuli && (
          <Link href="/admin/moduli-ricevuti" className="card quick-card">
            <h2>📥 Moduli ricevuti</h2>
            <p>Le compilazioni inviate dagli utenti.</p>
            <span className="quick-card__arrow">
              {compilazioniNonLette > 0 ? `${compilazioniNonLette} da leggere →` : "Apri →"}
            </span>
          </Link>
        )}
        {gestisceSondaggi && (
          <Link href="/admin/sondaggi-ricevuti" className="card quick-card">
            <h2>📊 Sondaggi ricevuti</h2>
            <p>Le risposte inviate ai sondaggi.</p>
            <span className="quick-card__arrow">
              {compilazioniSondaggiNonLette > 0
                ? `${compilazioniSondaggiNonLette} da leggere →`
                : "Apri →"}
            </span>
          </Link>
        )}
        {gestisceSegnalazioni && (
          <Link href="/admin/segnalazioni" className="card quick-card">
            <h2>💡 Segnalazioni</h2>
            <p>Suggerimenti e segnalazioni inviati dai dipendenti.</p>
            <span className="quick-card__arrow">
              {segnalazioniNonLette > 0 ? `${segnalazioniNonLette} da leggere →` : "Apri →"}
            </span>
          </Link>
        )}
        {gestisceFormazione && (
          <Link href="/admin/formazione" className="card quick-card">
            <h2>🎓 Report attività formative</h2>
            <p>
              {vedeFormazioneTutti
                ? "Attività formative di tutti i dipendenti."
                : "Attività formative dei tuoi collaboratori."}
            </p>
            <span className="quick-card__arrow">Apri →</span>
          </Link>
        )}
      </div>
    </section>
  );
}
