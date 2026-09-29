"use client";

import { useEffect, useRef, useState } from "react";

// Editor di testo formattato (grassetto/corsivo/sottolineato/barrato, titoli,
// elenchi, allineamento, link e immagini) basato su contentEditable +
// document.execCommand: niente dipendenza esterna (Tiptap/Quill ecc.),
// coerente con lo stile "poche dipendenze, HTML nativo" già usato altrove nel
// progetto (drag&drop nativo in ModuloEditor). L'HTML prodotto viene
// sanificato lato server prima di essere salvato (vedi sanitizeRicco in
// lib/rich-text.ts).
//
// Componente non controllato: il contenuto iniziale (value) viene scritto
// nel DOM solo al mount, poi l'elemento gestisce se stesso e notifica le
// modifiche via onChange. Per "resettare" il contenuto dall'esterno (es.
// passare a un'altra domanda) il genitore deve rimontare con una key diversa
// — pattern già in uso in ModuloEditor (CampoCard è keyed per id campo).
//
// Le immagini compaiono nella toolbar solo se il genitore passa onUploadImage:
// caricarle ha senso dove esiste uno storage a cui appoggiarle (comunicazioni),
// non ovunque si usi l'editor.
const STILI: { comando: string; label: string; icona: React.ReactNode }[] = [
  { comando: "bold", label: "Grassetto", icona: <b>B</b> },
  { comando: "italic", label: "Corsivo", icona: <i>I</i> },
  { comando: "underline", label: "Sottolineato", icona: <u>U</u> },
  { comando: "strikeThrough", label: "Barrato", icona: <s>S</s> },
];

const ELENCHI: { comando: string; label: string; icona: string }[] = [
  { comando: "insertUnorderedList", label: "Elenco puntato", icona: "•" },
  { comando: "insertOrderedList", label: "Elenco numerato", icona: "1." },
];

// Allineamento: icone disegnate invece di glifi unicode, che a 28px risultano
// illeggibili o incoerenti tra i sistemi. ancoraggio: 0 = sinistra,
// 0.5 = centro, 1 = destra.
const ALLINEAMENTI: { comando: string; label: string; ancoraggio: number }[] = [
  { comando: "justifyLeft", label: "Allinea a sinistra", ancoraggio: 0 },
  { comando: "justifyCenter", label: "Centra", ancoraggio: 0.5 },
  { comando: "justifyRight", label: "Allinea a destra", ancoraggio: 1 },
];

function IconaAllineamento({ ancoraggio }: { ancoraggio: number }) {
  // Quattro righe alternate lunga/corta, come nelle barre dei word processor:
  // le corte si spostano secondo l'ancoraggio, le lunghe restano piene.
  const righe = [14, 9, 14, 9];
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
      {righe.map((larghezza, i) => (
        <rect
          key={i}
          x={(14 - larghezza) * ancoraggio}
          y={i * 3.5}
          width={larghezza}
          height="1.6"
          rx="0.8"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

// onMouseDown bloccato su ogni pulsante: senza, il click porterebbe via il
// focus dall'area di scrittura, e il comando non avrebbe più una selezione su
// cui agire.
function Pulsante({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="rte__btn"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
  onUploadImage,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  // Carica il file e restituisce l'URL da inserire nel testo (null se il
  // caricamento non è andato a buon fine: l'errore lo segnala il genitore).
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Selezione da ripristinare dopo un giro fuori dall'editor (la finestra
  // "scegli file" sposta il focus): senza, l'immagine finirebbe in testa al
  // testo invece che dove stava il cursore.
  const selezione = useRef<Range | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = value;
    if (autoFocus) ref.current.focus();
    // Mount-once di proposito: vedi commento sopra sul pattern "non controllato".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function salvaSelezione() {
    const sel = window.getSelection();
    if (sel?.rangeCount && ref.current?.contains(sel.anchorNode)) {
      selezione.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function ripristinaSelezione() {
    ref.current?.focus();
    const sel = window.getSelection();
    if (selezione.current && sel) {
      sel.removeAllRanges();
      sel.addRange(selezione.current);
    }
  }

  function eseguiComando(comando: string, valore?: string) {
    ref.current?.focus();
    document.execCommand(comando, false, valore);
    emit();
  }

  // Titolo: formatBlock su h3, che ricliccato torna paragrafo (si comporta da
  // interruttore, come nei word processor).
  function toggleTitolo() {
    const attuale = document.queryCommandValue("formatBlock").toLowerCase();
    eseguiComando("formatBlock", attuale === "h3" ? "<p>" : "<h3>");
  }

  function inserisciLink() {
    salvaSelezione();
    const esistente = linkSottoIlCursore();
    const url = window.prompt(
      esistente
        ? "Indirizzo del link (vuoto per rimuoverlo)"
        : "Indirizzo del link (es. https://www.comune.it)",
      esistente ?? ""
    );
    if (url === null) return;
    // Il prompt è una finestra di sistema: al ritorno il punto in cui si stava
    // scrivendo va riportato dov'era, o il link finirebbe altrove.
    ripristinaSelezione();
    // Campo svuotato su un link esistente: è il modo per toglierlo.
    if (!url.trim()) {
      if (esistente) eseguiComando("unlink");
      return;
    }
    const href = normalizzaUrl(url.trim());
    const sel = window.getSelection();
    // Senza testo selezionato createLink non ha nulla da trasformare: si
    // inserisce il link con l'indirizzo stesso come testo visibile.
    if (sel?.isCollapsed) {
      eseguiComando("insertHTML", `<a href="${escapeAttr(href)}">${escapeTesto(href)}</a>`);
    } else {
      eseguiComando("createLink", href);
    }
  }

  function linkSottoIlCursore(): string | null {
    const nodo = window.getSelection()?.anchorNode ?? null;
    const elemento = nodo instanceof Element ? nodo : nodo?.parentElement ?? null;
    const link = elemento?.closest("a");
    return link && ref.current?.contains(link) ? link.getAttribute("href") : null;
  }

  async function inserisciImmagine(file: File) {
    if (!onUploadImage || caricamento) return;
    setCaricamento(true);
    try {
      const url = await onUploadImage(file);
      if (!url) return;
      ripristinaSelezione();
      // insertHTML e non insertImage: serve anche l'alt, che execCommand
      // "insertImage" non sa impostare. Il nome del file è una descrizione
      // imperfetta ma migliore del niente per chi usa uno screen reader.
      const alt = file.name.replace(/\.[^.]+$/, "");
      document.execCommand("insertHTML", false, `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}">`);
      emit();
    } finally {
      setCaricamento(false);
    }
  }

  // Incolla sempre come testo semplice: evita di trascinarsi dentro lo stile
  // di Word/Outlook (comunissimo copia-incolla d'ufficio) — chi vuole
  // formattare usa la toolbar. Un'immagine negli appunti (schermata, foto
  // copiata da un altro programma) fa eccezione: si carica come se fosse stata
  // scelta dal pulsante.
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const immagine = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (immagine && onUploadImage) {
      e.preventDefault();
      salvaSelezione();
      void inserisciImmagine(immagine);
      return;
    }
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    emit();
  }

  // Immagine trascinata dentro l'editor: stesso percorso dell'incolla, con il
  // cursore portato nel punto in cui è stata lasciata.
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    const immagine = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!immagine || !onUploadImage) return;
    e.preventDefault();
    const punto = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (punto) selezione.current = punto;
    else salvaSelezione();
    void inserisciImmagine(immagine);
  }

  return (
    <div className="rte">
      <div className="rte__toolbar" role="toolbar" aria-label="Formattazione testo">
        <Pulsante label="Titolo" onClick={toggleTitolo}>
          H
        </Pulsante>
        <span className="rte__sep" aria-hidden="true" />
        {STILI.map((a) => (
          <Pulsante key={a.comando} label={a.label} onClick={() => eseguiComando(a.comando)}>
            {a.icona}
          </Pulsante>
        ))}
        <span className="rte__sep" aria-hidden="true" />
        {ELENCHI.map((a) => (
          <Pulsante key={a.comando} label={a.label} onClick={() => eseguiComando(a.comando)}>
            {a.icona}
          </Pulsante>
        ))}
        <span className="rte__sep" aria-hidden="true" />
        {ALLINEAMENTI.map((a) => (
          <Pulsante key={a.comando} label={a.label} onClick={() => eseguiComando(a.comando)}>
            <IconaAllineamento ancoraggio={a.ancoraggio} />
          </Pulsante>
        ))}
        <span className="rte__sep" aria-hidden="true" />
        <Pulsante label="Inserisci link" onClick={inserisciLink}>
          🔗
        </Pulsante>
        {onUploadImage && (
          <Pulsante
            label="Inserisci immagine"
            disabled={caricamento}
            onClick={() => {
              salvaSelezione();
              fileRef.current?.click();
            }}
          >
            {caricamento ? "…" : "🖼"}
          </Pulsante>
        )}
        <Pulsante label="Rimuovi formattazione" onClick={() => eseguiComando("removeFormat")}>
          ✕
        </Pulsante>
      </div>
      {onUploadImage && (
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Azzera il valore: senza, riscegliere lo stesso file non
            // riattiverebbe onChange.
            e.target.value = "";
            if (file) void inserisciImmagine(file);
          }}
        />
      )}
      <div
        ref={ref}
        className="rte__area"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onPaste={handlePaste}
        onDrop={handleDrop}
        // Senza preventDefault sul dragover il browser non considera l'area
        // una destinazione valida per i file e apre l'immagine al posto della
        // pagina invece di lasciarla cadere qui.
        onDragOver={(e) => {
          if (onUploadImage && e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onKeyUp={salvaSelezione}
        onMouseUp={salvaSelezione}
        onBlur={salvaSelezione}
        onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
        data-placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

// "www.comune.it" digitato di getto è l'ipotesi più probabile di link esterno:
// senza schema il browser lo tratterebbe come percorso relativo dell'intranet.
function normalizzaUrl(url: string): string {
  if (/^(https?:|mailto:|\/)/i.test(url)) return url;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url) ? `mailto:${url}` : `https://${url}`;
}

function escapeTesto(testo: string): string {
  return testo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(testo: string): string {
  return escapeTesto(testo).replace(/"/g, "&quot;");
}
