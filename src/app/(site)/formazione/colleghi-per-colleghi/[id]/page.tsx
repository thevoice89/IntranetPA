import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getGuida } from "@/lib/data";
import { getCurrentUser, canEditGuide } from "@/lib/auth";
import { VideoEmbed } from "@/components/ui/VideoEmbed";
import { EditButton } from "@/components/ui/EditButton";
import type { GuidaMateriale } from "@/types";

export const dynamic = "force-dynamic";

function MaterialeCard({ m }: { m: GuidaMateriale }) {
  if (m.tipo === "video") {
    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "0.6rem" }}>🎬 {m.titolo}</p>
        <VideoEmbed url={m.url} />
      </div>
    );
  }

  if (m.tipo === "documento") {
    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          className="card"
          style={{ padding: "0.9rem 1.1rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
        >
          <span style={{ fontWeight: 600 }}>📄 {m.titolo}</span>
          <a
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn--ghost btn--sm"
          >
            Apri documento
          </a>
        </div>
        <div className="pdf-viewer card">
          <iframe src={m.url} title={m.titolo} />
        </div>
      </div>
    );
  }

  // link
  return (
    <div style={{ marginBottom: "1rem" }}>
      <a
        href={m.url}
        target="_blank"
        rel="noreferrer"
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.9rem 1.1rem",
          gap: "1rem",
        }}
      >
        <span style={{ fontWeight: 600 }}>🔗 {m.titolo}</span>
        <span className="btn btn--primary btn--sm">Apri ↗</span>
      </a>
    </div>
  );
}

export default async function FormazioneColleghiDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guida = await getGuida(id);
  if (!guida) notFound();
  const user = await getCurrentUser();

  return (
    <section>
      <header className="page-header">
        <Link href={ROUTES.formazioneColleghi.path} className="help">← {ROUTES.formazioneColleghi.label}</Link>
        <div className="page-header__row">
          <h1>{guida.titolo}</h1>
          {user && canEditGuide(user) && <EditButton href={`/admin/guide?edit=${guida.id}`} />}
        </div>
        <p style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className="badge">{guida.categoria}</span>
          {guida.autoreNome && <span className="badge">👤 Condivisa da {guida.autoreNome}</span>}
        </p>
      </header>

      {guida.descrizione && (
        <div className="card" style={{ padding: "1.2rem", marginBottom: "1.25rem" }}>
          {guida.descrizione}
        </div>
      )}

      {guida.materiali.length === 0 ? (
        <div className="card empty">Nessun materiale disponibile.</div>
      ) : (
        guida.materiali.map((m) => <MaterialeCard key={m.id} m={m} />)
      )}
    </section>
  );
}
