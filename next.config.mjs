/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessario per l'immagine Docker minimale (vedi Dockerfile).
  output: "standalone",
  reactStrictMode: true,
  // pdf-parse (via pdfjs-dist) fa require dinamici non compatibili col bundling webpack.
  // pdfkit: se impacchettato da webpack dentro il bundle della route, il suo
  // caricamento interno del font standard "Helvetica" (path relativo a
  // __dirname) punta alla cartella sbagliata e crasha con ENOENT in
  // produzione — tenerlo esterno (require reale a runtime) lo evita.
  serverExternalPackages: ["pdf-parse", "pdfkit"],
  // Il tracing automatico dell'output standalone non rileva i file caricati
  // dinamicamente da pdfjs-dist (worker .mjs ecc.) né gli asset letti a runtime
  // con un path hardcoded (font/logo per la generazione PDF via pdfkit, che
  // non passano da un import/require statico): li includiamo a mano,
  // altrimenti nell'immagine Docker mancano.
  outputFileTracingIncludes: {
    "/**": [
      "node_modules/pdf-parse/**",
      "node_modules/pdfjs-dist/**",
      "node_modules/pdfkit/**",
      "node_modules/fontkit/**",
      "node_modules/linebreak/**",
      "node_modules/png-js/**",
      "src/lib/pdf-assets/**",
    ],
  },
  experimental: {
    serverActions: {
      // Limite di dimensione per gli upload (allegati) via server action.
      bodySizeLimit: "20mb",
    },
  },
  // Le Guide sono confluite nella sezione Formazione (2026-09): redirect per
  // non rompere link/bookmark già in giro. /admin/guide resta dov'era, solo
  // il lato pubblico si è spostato.
  // Intestazioni di sicurezza su tutte le risposte. In rete locale non
  // c'è altro davanti (il Traefik locale fa solo da inoltro); su una VPS
  // le stesse le aggiunge anche Traefik, senza conflitto:
  // - nosniff: il browser non "indovina" un tipo diverso da quello dichiarato
  //   (vedi rispostaUpload in lib/uploads.ts per i file caricati);
  // - X-Frame-Options: le pagine dell'Intranet non si possono incorniciare in
  //   un sito esterno (clickjacking); gli <iframe> interni, es. il PDF dei
  //   regolamenti, restano stesso sito e funzionano.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/guide", destination: "/formazione/colleghi-per-colleghi", permanent: false },
      { source: "/guide/:id", destination: "/formazione/colleghi-per-colleghi/:id", permanent: false },
    ];
  },
};

export default nextConfig;
