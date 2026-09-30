import type { Metadata } from "next";
import "./globals.css";
// Skin "Aurora" (grafica predefinita dal 2026-07-27): agisce solo quando <html>
// ha data-skin="aurora", impostato qui sotto nel markup (unica grafica, nessun
// selettore per tornare alla precedente). Importata dopo globals.css così vince
// a parità di specificità.
import "./skin-aurora.css";
import { getBranding } from "@/lib/branding-data";
import { DEFAULT_BRANDING } from "@/lib/branding";

// Ambiente di test (vedi docker-compose di staging): STAGING=true è impostato
// SOLO nel container di staging, mai in produzione. Da qui derivano il prefisso
// nel titolo della scheda e il banner in cima a ogni pagina (vedi sotto), così
// non ci si confonde su quale ambiente si sta usando — nessun'altra differenza
// di comportamento è legata a questo flag.
const isStaging = process.env.STAGING === "true";

// generateMetadata (non un export const statico) perché il titolo deve
// riflettere l'env del container in esecuzione e il nome dell'ente configurato in
// /admin/impostazioni, non essere fissati al build: la stessa immagine gira sia in
// produzione sia in staging, e il nome si cambia senza rifare il deploy.
export async function generateMetadata(): Promise<Metadata> {
  // Se il DB non risponde la pagina deve comunque partire (con il nome di default).
  const nome = await getBranding()
    .then((b) => b.nome)
    .catch(() => DEFAULT_BRANDING.nome);
  return {
    title: isStaging ? `🧪 TEST — Intranet · ${nome}` : `Intranet · ${nome}`,
    description: `Portale intranet: ${nome}`,
  };
}

// Script che imposta il tema (chiaro/scuro) prima del paint, evitando il flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

// Script che applica la dimensione del testo salvata prima del paint (niente flash).
// La scala agisce sul font-size della radice: siccome tutta l'interfaccia è in rem,
// si ridimensiona insieme al testo (spaziature, icone, componenti).
const fontScaleScript = `(function(){try{var s=parseFloat(localStorage.getItem('fontScale'));if(!s||isNaN(s)||s<0.8||s>1.5)s=1;document.documentElement.style.fontSize=(s*100)+'%';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      data-skin="aurora"
      data-staging={isStaging ? "true" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: fontScaleScript }} />
      </head>
      <body>
        {isStaging && (
          <div className="staging-banner" role="status">
            🧪 AMBIENTE DI TEST — non è il sito reale dei dipendenti
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
