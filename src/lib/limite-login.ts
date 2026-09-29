// Limite ai tentativi di login falliti, contro chi prova password a raffica.
//
// In memoria: l'app gira in un solo container, quindi basta una Map nel
// processo (un riavvio azzera i contatori, accettabile). Due chiavi:
//  - IP + username: blocca chi insiste su un account, senza impedire al
//    titolare di entrare da un altro PC;
//  - solo IP, con soglia più alta: blocca chi prova tanti username diversi.

const FINESTRA_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 50;

const fallimenti = new Map<string, { n: number; scade: number }>();

function chiavi(ip: string, username: string) {
  return { account: `a:${ip}:${username.toLowerCase()}`, ip: `i:${ip}` };
}

function conteggio(chiave: string, ora: number): number {
  const voce = fallimenti.get(chiave);
  if (!voce || voce.scade <= ora) return 0;
  return voce.n;
}

export function loginBloccato(ip: string, username: string): boolean {
  const ora = Date.now();
  const k = chiavi(ip, username);
  return conteggio(k.account, ora) >= MAX_PER_ACCOUNT || conteggio(k.ip, ora) >= MAX_PER_IP;
}

export function registraLoginFallito(ip: string, username: string): void {
  const ora = Date.now();
  // Pulizia delle voci scadute, così la Map non cresce senza limite.
  if (fallimenti.size > 1000) {
    for (const [chiave, voce] of fallimenti) if (voce.scade <= ora) fallimenti.delete(chiave);
  }
  const k = chiavi(ip, username);
  for (const chiave of [k.account, k.ip]) {
    const n = conteggio(chiave, ora);
    // La finestra parte dal primo fallimento e non si allunga con i successivi.
    const scade = n === 0 ? ora + FINESTRA_MS : fallimenti.get(chiave)!.scade;
    fallimenti.set(chiave, { n: n + 1, scade });
  }
}

export function registraLoginRiuscito(ip: string, username: string): void {
  fallimenti.delete(chiavi(ip, username).account);
}
