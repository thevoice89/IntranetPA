import type { Metadata } from "next";
import "./globals.css";
// Skin "Aurora" (grafica predefinita dal 2026-07-27): agisce solo quando <html>
// ha data-skin="aurora", impostato qui sotto nel markup (unica grafica, nessun
// selettore per tornare alla precedente). Importata dopo globals.css così vince
// a parità di specificità.
import "./skin-aurora.css";

// Ambiente di test (vedi docker-compose di staging): STAGING=true è impostato
// SOLO nel container di staging, mai in produzione. Da qui derivano il prefisso
// nel titolo della scheda e il banner in cima a ogni pagina (vedi sotto), così
// non ci si confonde su quale ambiente si sta usando — nessun'altra differenza
// di comportamento è legata a questo flag.
const isStaging = process.env.STAGING === "true";

// generateMetadata (non un export const statico) perché il titolo deve
// riflettere l'env del container in esecuzione, non essere fissato al build:
// la stessa immagine gira sia in produzione sia in staging.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: isStaging
      ? "🧪 TEST — Intranet · Comune di Esempio"
      : "Intranet · Comune di Esempio",
    description: "Portale intranet del Comune di Esempio",
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
