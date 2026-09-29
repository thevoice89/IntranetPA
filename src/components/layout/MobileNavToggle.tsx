"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TOGGLE_ID = "mobile-nav-toggle";

// Checkbox nascosto + label per aprire/chiudere la sidebar come menu a
// scomparsa da sinistra sotto i 760px (vedi regole .nav-toggle-* e
// .nav-backdrop in globals.css). Niente JS per l'apertura/chiusura in sé
// (pure CSS via :checked ~), solo per richiudere il menu al cambio pagina.
export function MobileNavToggle() {
  const pathname = usePathname();

  useEffect(() => {
    const checkbox = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
    if (checkbox) checkbox.checked = false;
  }, [pathname]);

  return (
    <>
      <input type="checkbox" id={TOGGLE_ID} className="nav-toggle-checkbox" />
      <label htmlFor={TOGGLE_ID} className="nav-toggle-btn" aria-label="Apri menu">
        ☰
      </label>
      <label htmlFor={TOGGLE_ID} className="nav-backdrop" aria-hidden="true" />
    </>
  );
}
