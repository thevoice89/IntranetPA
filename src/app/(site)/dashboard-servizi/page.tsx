import { ROUTES } from "@/lib/routes";
import { getServizi } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { ServizioCard } from "@/components/ui/ServizioCard";

export const dynamic = "force-dynamic";

export default async function DashboardServiziPage() {
  const [servizi, user] = await Promise.all([getServizi(), getCurrentUser()]);
  const isAdmin = user?.ruolo === "admin";

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.dashboardServizi.label}</h1>
        <p>{ROUTES.dashboardServizi.description}</p>
      </header>

      {servizi.length === 0 ? (
        <div className="card empty">Nessun servizio configurato.</div>
      ) : (
        <div className="grid">
          {servizi.map((s) => (
            <ServizioCard
              key={s.id}
              servizio={s}
              editHref={isAdmin ? `/admin/servizi?edit=${s.id}` : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
