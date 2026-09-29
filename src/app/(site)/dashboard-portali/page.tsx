import { ROUTES } from "@/lib/routes";
import { getPortali } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { PortaleCard } from "@/components/ui/PortaleCard";

export const dynamic = "force-dynamic";

export default async function DashboardPortaliPage() {
  const [portali, user] = await Promise.all([getPortali(), getCurrentUser()]);
  const isAdmin = user?.ruolo === "admin";

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.dashboardPortali.label}</h1>
        <p>{ROUTES.dashboardPortali.description}</p>
      </header>

      {portali.length === 0 ? (
        <div className="card empty">Nessun portale configurato.</div>
      ) : (
        <div className="grid">
          {portali.map((p) => (
            <PortaleCard
              key={p.id}
              portale={p}
              editHref={isAdmin ? `/admin/portali?edit=${p.id}` : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
