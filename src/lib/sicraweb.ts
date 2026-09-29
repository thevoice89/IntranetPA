// Client per le API REST di Sicraweb EVO (Maggioli) — estrazione timbrature,
// usato dalla sync di presenze_assenze (vedi syncPresenzeDaTimbrature in
// lib/data.ts). Credenziali di test fornite da Maggioli il 2026-09-16, valide
// solo sull'ambiente di test: mai propagare SICRAWEB_* al .env di produzione
// finché non decise diversamente.

interface LoginResponse {
  bearerToken: string;
  ente: string;
  utente: string;
}

export interface RiepilogoTimbraturaRecord {
  codBadge: string;
  cognome: string;
  nome: string;
  codiceFiscale: string;
  codEnte: string;
  giorno: string; // GG/MM/AAAA
  ultimaEntrata: string | null; // GG/MM/AAAA HH:MM:SS
  ultimaUscita: string | null;
  orologioUltimaE: string | null;
  orologioUltimaU: string | null;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} non configurato`);
  return v;
}

// Cache in memoria per processo Node: evita un login ad ogni chiamata nello stesso
// processo. tokenExpiration:0 nella richiesta di login = scadenza di default
// lato Sicraweb (non dichiarata nel documento), quindi qui si ricicla il
// token solo per un tempo prudenziale breve invece di fidarsi di una durata.
let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 10 * 60 * 1000;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const host = env("SICRAWEB_HOST");
  const res = await fetch(`${host}/client/services/rest/infrastruttura/aut/v2/basic/logon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      alias: env("SICRAWEB_ALIAS"),
      username: env("SICRAWEB_USERNAME"),
      password: env("SICRAWEB_PASSWORD"),
      tokenExpiration: 0,
    }),
  });
  if (!res.ok) {
    throw new Error(`Sicraweb login error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as LoginResponse;
  cachedToken = { value: json.bearerToken, expiresAt: Date.now() + TOKEN_TTL_MS };
  return json.bearerToken;
}

// Riepilogo Timbrature per una singola giornata (dtaDal=dtaAl), tutti i
// dipendenti dell'Ente configurato. Pagina automaticamente finché l'ultima
// pagina restituisce meno di `take` record.
export async function getRiepilogoTimbratureGiorno(dataIso: string): Promise<RiepilogoTimbraturaRecord[]> {
  const host = env("SICRAWEB_HOST");
  const codEnte = env("SICRAWEB_COD_ENTE");
  const [anno, mese, giorno] = dataIso.split("-");
  const dataGgMmAaaa = `${giorno}/${mese}/${anno}`;

  const take = 100;
  let skip = 0;
  const tutti: RiepilogoTimbraturaRecord[] = [];

  for (;;) {
    const token = await getToken();
    const res = await fetch(
      `${host}/client/services/rest/personale/per/v1/export-presenze/timbrature/riepilogo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          codEnte: [codEnte],
          dtaDal: dataGgMmAaaa,
          dtaAl: dataGgMmAaaa,
          codiciFiscali: [],
          codBadge: [],
          codOrologio: [],
          skip,
          take,
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Sicraweb riepilogo error ${res.status}: ${await res.text()}`);
    }
    const pagina = (await res.json()) as RiepilogoTimbraturaRecord[];
    tutti.push(...pagina);
    if (pagina.length < take) break;
    skip += take;
  }

  return tutti;
}
