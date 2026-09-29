import type { Servizio } from "@/types";
import { EditButton } from "@/components/ui/EditButton";

const STATO_LABEL: Record<Servizio["stato"], string> = {
  attivo: "Attivo",
  manutenzione: "Manutenzione",
  offline: "Offline",
};

// Card di un singolo servizio nella dashboard.
export function ServizioCard({
  servizio,
  editHref,
}: {
  servizio: Servizio;
  editHref?: string;
}) {
  const { nome, descrizione, url, icona, categoria, stato } = servizio;
  const disabilitato = stato === "offline";

  return (
    <div className={`card-slot${editHref ? " has-fab" : ""}`}>
      {editHref && <EditButton href={editHref} variant="fab" />}
      <a
        className="card service-card"
        href={disabilitato ? undefined : url}
        target={disabilitato ? undefined : "_blank"}
        rel="noreferrer"
        aria-disabled={disabilitato}
        style={disabilitato ? { opacity: 0.6, pointerEvents: "none" } : undefined}
      >
        <span className="service-card__icon" aria-hidden>
          {icona}
        </span>
        <span className="service-card__name">{nome}</span>
        <span className="service-card__desc">{descrizione}</span>
        <span className="service-card__foot">
          <span className="service-card__cat">{categoria}</span>
          <span className={`status status--${stato}`}>{STATO_LABEL[stato]}</span>
        </span>
      </a>
    </div>
  );
}
