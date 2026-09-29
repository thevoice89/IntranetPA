"use client";

import { useEffect, useState } from "react";

// Interruttore tema chiaro/scuro. La preferenza è salvata in localStorage;
// il tema iniziale è già applicato dallo script nel layout (niente flash).
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="nav-link"
      style={{ width: "100%", border: "none", background: "none", cursor: "pointer", font: "inherit", textAlign: "left" }}
    >
      <span className="nav-link__icon">{theme === "dark" ? "☀️" : "🌙"}</span>
      {theme === "dark" ? "Tema chiaro" : "Tema scuro"}
    </button>
  );
}
