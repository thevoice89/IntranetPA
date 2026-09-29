import { NextResponse } from "next/server";
import * as data from "@/lib/data";
import { autorizzaSync } from "@/lib/auth";
import { oggiIso } from "@/lib/format";

// POST /api/presenze/sync[?data=YYYY-MM-DD][&ambito=pl] — pensato per un cron
// esterno. Richiede header
// Authorization: Bearer <SYNC_TOKEN> (vedi autorizzaSync). Senza `data`,
// sincronizza oggi. `ambito=pl` sincronizza solo la Polizia Locale
// (controllata a orari diversi dal resto del personale, vedi
// syncPresenzePoliziaLocale in lib/data.ts).
export async function POST(req: Request) {
  if (!autorizzaSync(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dataIso = searchParams.get("data") ?? oggiIso();
  const poliziaLocale = searchParams.get("ambito") === "pl";

  try {
    const risultato = poliziaLocale
      ? await data.syncPresenzePoliziaLocale(dataIso)
      : await data.syncPresenzeDaTimbrature(dataIso);
    return NextResponse.json({ ok: true, ...risultato });
  } catch (err) {
    console.error("[presenze/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore sync presenze" },
      { status: 500 }
    );
  }
}
