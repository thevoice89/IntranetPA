import Link from "next/link";

// Pulsante "matita" per modificare un contenuto (mostrato agli utenti loggati).
export function EditButton({
  href,
  variant = "inline",
}: {
  href: string;
  variant?: "inline" | "fab";
}) {
  return (
    <Link
      href={href}
      className={variant === "fab" ? "edit-fab" : "edit-btn"}
      title="Modifica"
      aria-label="Modifica"
    >
      ✏️{variant === "inline" && <span>Modifica</span>}
    </Link>
  );
}
