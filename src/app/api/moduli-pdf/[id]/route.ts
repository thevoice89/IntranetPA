import { getModulo } from "@/lib/data";
import { generateModuloPdfCompilato } from "@/lib/modulo-pdf";

export const dynamic = "force-dynamic";

// Location relativo (mai un new URL(..., req.url)): dietro Traefik req.url
// riflette l'indirizzo interno del container (es. http://0.0.0.0:3000/...),
// non l'host pubblico — un redirect assoluto costruito su quello porterebbe
// il browser su un indirizzo irraggiungibile. Un Location relativo viene
// risolto dal browser rispetto all'origine della richiesta, come fa già
// redirect() di Next altrove in questo modulo.
function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

// Compilazione pubblica di un modulo di tipo "pdf" (vedi TipoModulo in
// types/index.ts): a differenza di compilaModulo (moduli/actions.ts) qui non
// viene scritto nulla sul DB né inviata alcuna notifica — la risposta HTTP
// stessa è il PDF compilato, generato al volo e restituito come download.
// Stessa validazione "obbligatorio" di compilaModulo, senza la parte di
// salvataggio allegati su disco (un campo "file" qui non viene persistito:
// nel PDF compare solo il nome del file scelto).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modulo = await getModulo(id);
  if (!modulo || !modulo.pubblicato || modulo.tipo !== "pdf") {
    return redirectTo("/moduli?error=non_disponibile");
  }

  const formData = await req.formData();

  for (const campo of modulo.campi) {
    if (campo.tipo === "testo_statico") continue;
    const fieldName = `campo_${campo.id}`;
    if (campo.tipo === "file") {
      const file = formData.get(fieldName);
      if (campo.obbligatorio && !(file instanceof File && file.size > 0)) {
        return redirectTo(`/moduli/${id}?error=campi_obbligatori`);
      }
    } else if (campo.tipo === "checkbox") {
      if (campo.obbligatorio && formData.get(fieldName) !== "on") {
        return redirectTo(`/moduli/${id}?error=campi_obbligatori`);
      }
    } else if (campo.obbligatorio && !String(formData.get(fieldName) ?? "").trim()) {
      return redirectTo(`/moduli/${id}?error=campi_obbligatori`);
    }
  }

  const valori = new Map<string, string>();
  for (const campo of modulo.campi) {
    if (campo.tipo === "testo_statico") continue;
    const fieldName = `campo_${campo.id}`;

    let valore: string;
    if (campo.tipo === "file") {
      const file = formData.get(fieldName);
      valore = file instanceof File && file.size > 0 ? file.name : "";
    } else if (campo.tipo === "checkbox") {
      valore = formData.get(fieldName) === "on" ? "Sì" : "No";
    } else {
      valore = String(formData.get(fieldName) ?? "").trim();
    }

    valori.set(campo.id, valore);
  }

  // Stessa estrazione IP di lib/log-attivita.ts, usata dalle altre azioni
  // pubbliche del sito: qui serve per la traccia digitale stampata sul PDF.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const pdf = await generateModuloPdfCompilato(modulo, valori, ip);

  const nomeFile = `${modulo.titolo}.pdf`.replace(/[^\w.\-]+/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nomeFile)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
