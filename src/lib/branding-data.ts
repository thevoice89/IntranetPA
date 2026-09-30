import { cache } from "react";
import { getImpostazioni } from "@/lib/data";
import { brandingDa } from "@/lib/branding";

// Identità dell'ente letta dal DB. cache(): nella stessa richiesta (layout radice,
// layout del sito e pagina) la query alle impostazioni parte una volta sola.
// Separato da lib/branding.ts, che resta senza dipendenze dal DB per poter essere
// importato anche da componenti client.
export const getBranding = cache(async () => brandingDa(await getImpostazioni()));
