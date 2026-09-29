import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getGuide } from "@/lib/data";
import { getCurrentUser, canEditGuide } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import type { Guida } from "@/types";

export const dynamic = "force-dynamic";

const TIPO_ICONA: Record<string, string> = {
  documento: "📄",
  link: "🔗",
  video: "🎬",
};

function MaterialiBadges({ materiali }: { materiali: Guida["materiali"] }) {
  const counts: Record<string, number> = {};
  for (const m of materiali) counts[m.tipo] = (counts[m.tipo] ?? 0) + 1;
  return (
    <span style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
      {Object.entries(counts).map(([tipo, n]) => (
        <span key={tipo} className="badge badge--tipo">
          {TIPO_ICONA[tipo]} {n}
        </span>
      ))}
    </span>
  );
}

export default async function FormazioneColleghiPage() {
  const [guide, user] = await Promise.all([getGuide(), getCurrentUser()]);

  const perCategoria = new Map<string, Guida[]>();
  for (const g of guide) {
    const list = perCategoria.get(g.categoria) ?? [];
    list.push(g);
    perCategoria.set(g.categoria, list);
  }

  return (
    <section>
      <header className="page-header">
        <Link href={ROUTES.formazione.path} className="help">← Formazione</Link>
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.formazioneColleghi.label}</h1>
            <p>Se vuoi pubblicare un video, contatta l'amministratore per la pubblicazione su Youtube e ottenere il link da inserire</p>
          </div>
          {user && canEditGuide(user) && (
            <Link href="/admin/guide" className="btn btn--primary btn--sm">
              + Aggiungi
            </Link>
          )}
        </div>
      </header>

      {guide.length === 0 ? (
        <div className="card empty">Nessun contributo ancora condiviso.</div>
      ) : (
        [...perCategoria.entries()].map(([categoria, items]) => (
          <div key={categoria}>
            <div className="section-title">{categoria}</div>
            <div className="grid">
              {items.map((g) => (
                <div key={g.id} className={`card-slot${user && canEditGuide(user) ? " has-fab" : ""}`}>
                  {user && canEditGuide(user) && (
                    <EditButton href={`/admin/guide?edit=${g.id}`} variant="fab" />
                  )}
                  <Link
                    href={`${ROUTES.formazioneColleghi.path}/${g.id}`}
                    className="card service-card"
                  >
                    <span className="service-card__name">{g.titolo}</span>
                    {g.descrizione && (
                      <span className="service-card__desc">{g.descrizione}</span>
                    )}
                    <span className="service-card__foot">
                      <MaterialiBadges materiali={g.materiali} />
                      {g.autoreNome && (
                        <span className="help" style={{ marginLeft: "auto" }}>
                          👤 {g.autoreNome}
                        </span>
                      )}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
