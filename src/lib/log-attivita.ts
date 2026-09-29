import { headers } from "next/headers";
import { registraAttivita } from "@/lib/data";
import type { RegistraAttivitaInput } from "@/lib/data";

// Wrapper attorno a data.registraAttivita che aggiunge l'IP del richiedente:
// serve il contesto della request (headers()), non disponibile dentro lib/data.ts.
// Usato da tutte le azioni pubbliche senza login (prenotazione-sale, suggerimenti,
// sondaggi, comunicazioni-non-ufficiali, comunicazioni, moduli, presenze) per
// scrivere nel log visibile solo in /admin/log-attivita. Non deve mai far fallire
// l'azione chiamante: un problema nel logging non deve bloccare l'utente pubblico
// (stesso principio degli invii email in lib/mail.ts, sempre in try/catch dal
// chiamante).
export async function logAttivita(
  input: Omit<RegistraAttivitaInput, "ip">
): Promise<void> {
  await registraAttivita({ ...input, ip: await ipRichiesta() });
}

// IP del client come lo passa Traefik; usato anche dal limite ai tentativi di
// login (vedi lib/limite-login.ts).
export async function ipRichiesta(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
}
