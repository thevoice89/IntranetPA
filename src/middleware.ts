import { NextResponse, type NextRequest } from "next/server";
import { HEADER_PERCORSO_RICHIESTO } from "@/lib/ritorno-login";

// Passa ai server component il percorso richiesto, che altrimenti non
// conoscono: serve a requireUser() per riportare l'utente alla stessa pagina
// dopo il login (vedi lib/ritorno-login.ts). Nessun controllo di accesso qui:
// quelli restano in requireUser()/requireAdmin() e nelle azioni.
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  // Parametro interno delle navigazioni lato client, non fa parte dell'indirizzo.
  url.searchParams.delete("_rsc");
  const headers = new Headers(request.headers);
  headers.set(HEADER_PERCORSO_RICHIESTO, url.pathname + url.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Asset statici esclusi: non passano mai da requireUser().
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
