import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegolamento } from "@/lib/data";
import { getCurrentUser, canEditRegolamenti } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";

export const dynamic = "force-dynamic";

export default async function RegolamentoDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const regolamento = await getRegolamento(id);
  if (!regolamento) notFound();
  const user = await getCurrentUser();

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <Link href="/regolamenti" className="help">← Regolamenti</Link>
            <h1>{regolamento.titolo}</h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {user && canEditRegolamenti(user) && <EditButton href="/admin/regolamenti" />}
            <a href={regolamento.fileUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
              Apri in una nuova scheda
            </a>
          </div>
        </div>
      </header>

      {/* Visualizzatore PDF sfogliabile online */}
      <div className="pdf-viewer card">
        <iframe src={regolamento.fileUrl} title={regolamento.titolo} />
      </div>
    </section>
  );
}
