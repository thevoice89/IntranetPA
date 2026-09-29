import { ROUTES } from "@/lib/routes";
import { getContatti, getStatoPresenzeInData, listUffici } from "@/lib/data";
import { oggiIso as oggiIsoRoma } from "@/lib/format";
import PresenzeApp from "./PresenzeApp";

export const dynamic = "force-dynamic";

export default async function PresenzePage() {
  // Oggi in Europe/Rome: il container gira in UTC.
  const oggiIso = oggiIsoRoma();
  const [anno, mese] = oggiIso.split("-").map(Number);

  const [contatti, assentiOggi, uffici] = await Promise.all([
    getContatti(),
    getStatoPresenzeInData(oggiIso),
    listUffici(),
  ]);

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.presenze.label}</h1>
        <p>{ROUTES.presenze.description}</p>
      </header>

      <PresenzeApp
        contatti={contatti}
        uffici={uffici}
        anno={anno}
        mese={mese}
        assentiOggiIniziali={assentiOggi}
        oggiIso={oggiIso}
      />
    </section>
  );
}
