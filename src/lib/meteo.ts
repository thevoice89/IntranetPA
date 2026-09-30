// Meteo per il widget in home: Open-Meteo (api.open-meteo.com), servizio gratuito
// senza chiave/API key. Le coordinate del comune si impostano da
// /admin/impostazioni (vedi lib/branding.ts, di default Roma). Nessuna dipendenza
// da variabili d'ambiente: se il servizio non risponde (rete assente sull'host,
// timeout) il widget lo mostra semplicemente come non disponibile, senza bloccare
// il caricamento della home (vedi (site)/page.tsx).

const CODICI_METEO: Record<number, { label: string; icona: string }> = {
  0: { label: "Sereno", icona: "☀️" },
  1: { label: "Prevalentemente sereno", icona: "🌤️" },
  2: { label: "Parzialmente nuvoloso", icona: "⛅" },
  3: { label: "Nuvoloso", icona: "☁️" },
  45: { label: "Nebbia", icona: "🌫️" },
  48: { label: "Nebbia con brina", icona: "🌫️" },
  51: { label: "Pioviggine leggera", icona: "🌦️" },
  53: { label: "Pioviggine", icona: "🌦️" },
  55: { label: "Pioviggine intensa", icona: "🌧️" },
  56: { label: "Pioviggine gelata", icona: "🌧️" },
  57: { label: "Pioviggine gelata intensa", icona: "🌧️" },
  61: { label: "Pioggia leggera", icona: "🌧️" },
  63: { label: "Pioggia", icona: "🌧️" },
  65: { label: "Pioggia intensa", icona: "🌧️" },
  66: { label: "Pioggia gelata", icona: "🌧️" },
  67: { label: "Pioggia gelata intensa", icona: "🌧️" },
  71: { label: "Neve leggera", icona: "❄️" },
  73: { label: "Neve", icona: "❄️" },
  75: { label: "Neve intensa", icona: "❄️" },
  77: { label: "Granelli di neve", icona: "❄️" },
  80: { label: "Rovesci leggeri", icona: "🌦️" },
  81: { label: "Rovesci", icona: "🌧️" },
  82: { label: "Rovesci intensi", icona: "🌧️" },
  85: { label: "Rovesci di neve", icona: "🌨️" },
  86: { label: "Rovesci di neve intensi", icona: "🌨️" },
  95: { label: "Temporale", icona: "⛈️" },
  96: { label: "Temporale con grandine", icona: "⛈️" },
  99: { label: "Temporale con grandine intensa", icona: "⛈️" },
};

export interface MeteoOggi {
  temperatura: number;
  descrizione: string;
  icona: string;
}

export async function getMeteoOggi(posizione: {
  latitudine: number;
  longitudine: number;
}): Promise<MeteoOggi | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${posizione.latitudine}&longitude=${posizione.longitudine}` +
      `&current=temperature_2m,weather_code&timezone=Europe%2FRome`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json();
    const temperatura = json?.current?.temperature_2m;
    const codice = json?.current?.weather_code;
    if (typeof temperatura !== "number") return null;
    const meta = CODICI_METEO[codice] ?? { label: "Condizioni variabili", icona: "🌡️" };
    return { temperatura: Math.round(temperatura), descrizione: meta.label, icona: meta.icona };
  } catch {
    return null;
  }
}
