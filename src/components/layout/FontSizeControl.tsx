"use client";

import { useEffect, useState } from "react";

// Controllo dimensione testo. Agisce sul font-size di <html>: siccome tutta
// l'interfaccia è dimensionata in rem, l'intero layout (testi, spaziature,
// icone) si adatta insieme, non solo il testo. Preferenza salvata in
// localStorage; il valore iniziale è già applicato dallo script nel layout
// (niente flash).
const MIN = 0.8;
const MAX = 1.5;
const STEP = 0.1;
const DEFAULT_SCALE = 1;

function clamp(n: number) {
  return Math.min(MAX, Math.max(MIN, n));
}

export function FontSizeControl() {
  const [scale, setScale] = useState(DEFAULT_SCALE);

  useEffect(() => {
    const current = parseFloat(document.documentElement.style.fontSize);
    if (current) setScale(clamp(current / 100));
  }, []);

  function update(next: number) {
    const clamped = clamp(Math.round(next * 100) / 100);
    document.documentElement.style.fontSize = `${clamped * 100}%`;
    try {
      localStorage.setItem("fontScale", String(clamped));
    } catch {
      /* ignore */
    }
    setScale(clamped);
  }

  return (
    <div className="font-size-control" role="group" aria-label="Dimensione testo">
      <button
        type="button"
        className="font-size-control__btn"
        onClick={() => update(scale - STEP)}
        disabled={scale <= MIN}
        aria-label="Riduci dimensione testo"
        title="Riduci testo"
      >
        A⁻
      </button>
      <button
        type="button"
        className="font-size-control__btn font-size-control__btn--reset"
        onClick={() => update(DEFAULT_SCALE)}
        aria-label="Ripristina dimensione testo predefinita"
        title="Ripristina 100%"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        className="font-size-control__btn"
        onClick={() => update(scale + STEP)}
        disabled={scale >= MAX}
        aria-label="Aumenta dimensione testo"
        title="Aumenta testo"
      >
        A⁺
      </button>
    </div>
  );
}
