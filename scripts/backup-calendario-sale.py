# -*- coding: utf-8 -*-
# Tool locale, NON esposto sul web: pensato per girare a mano (python scripts/backup-calendario-sale.py)
# o pianificato su Task Scheduler del PC. Interroga in sola lettura il DB di produzione via SSH
# (stesso pattern usato altrove: ssh + docker exec -i intranet-app node < script) e rigenera il
# backup Excel delle prenotazioni sale su \\SERVER\condivisa (F:). Non collegarlo a nessuna route
# HTTP dell'app Next.js: è un'operazione manuale/pianificata sul PC, non parte del server.

import calendar
import datetime
import json
import subprocess
import sys
import tempfile
import os
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

SSH_HOST = os.environ.get("INTRANET_SSH_HOST", "utente@IP_DEL_SERVER")
SSH_REMOTE_CMD = "docker exec -i intranet-app node"
SSH_TIMEOUT_SEC = 30

# Attenzione: qui serve la lettera F: e NON il percorso UNC \\SERVER\condivisa\... — la
# condivisione è mappata con credenziali diverse da quelle della sessione Windows
# corrente, quindi il percorso UNC nudo dà "accesso negato"/"percorso non trovato"
# anche quando F: funziona perfettamente (verificato 2026-08-03).
CARTELLA_DEST = Path(r"F:\Condivisa\Calendario sale")
FILE_DEST = CARTELLA_DEST / "NUOVO CALENDARIO TOTALE BKP.xlsx"
FILE_LOG = CARTELLA_DEST / "_log_backup_calendario.txt"
MAX_RIGHE_LOG = 500

QUERY_JS = r"""
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const { rows: sale } = await pool.query(
    'SELECT nome FROM sale ORDER BY ordine ASC, nome ASC'
  );
  const { rows: prenotazioni } = await pool.query(`
    SELECT s.nome AS sala_nome, p.data::text AS data, p.ora_inizio, p.ora_fine,
           p.richiedente, p.note
    FROM sale_prenotazioni p
    JOIN sale s ON s.id = p.sala_id
    ORDER BY s.ordine ASC, p.data ASC, p.ora_inizio ASC
  `);
  console.log(JSON.stringify({ sale, prenotazioni }));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
"""

MESI_IT = [
    "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
    "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE",
]
GIORNI_IT = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"]

FONT_TITOLO = Font(name="Arial", size=16, bold=True, color="FFFFFF")
FONT_SOTTOTITOLO = Font(name="Arial", size=9, italic=True, color="666666")
FONT_MESE = Font(name="Arial", size=12, bold=True, color="FFFFFF")
FONT_GIORNO_SETT = Font(name="Arial", size=10, bold=True, color="333333")
FONT_NUM_GIORNO = Font(name="Arial", size=10, bold=True, color="1F1F1F")

FILL_TITOLO = PatternFill("solid", fgColor="1F4E78")
FILL_MESE = PatternFill("solid", fgColor="2E75B6")
FILL_HEADER_SETT = PatternFill("solid", fgColor="D9E2F3")
FILL_WEEKEND = PatternFill("solid", fgColor="F2F2F2")
FILL_FUORI_MESE = PatternFill("solid", fgColor="FAFAFA")
FILL_EVENTO = PatternFill("solid", fgColor="FFF2CC")
FILL_VUOTA = PatternFill(fill_type=None)

THIN = Side(style="thin", color="BFBFBF")
BORDER_CELLA = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

N_COLS = 7
COL_WIDTH = 19
ROW_HEIGHT_SETTIMANA = 58


def log(msg):
    riga = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(riga)
    try:
        precedenti = []
        if FILE_LOG.exists():
            precedenti = FILE_LOG.read_text(encoding="utf-8").splitlines()
        precedenti.append(riga)
        precedenti = precedenti[-MAX_RIGHE_LOG:]
        FILE_LOG.write_text("\n".join(precedenti) + "\n", encoding="utf-8")
    except OSError:
        # Se anche il log non è raggiungibile (condivisione irraggiungibile) non c'è
        # molto altro da fare: l'output su stdout resta comunque disponibile.
        pass


def interroga_db():
    proc = subprocess.run(
        ["ssh", SSH_HOST, SSH_REMOTE_CMD],
        input=QUERY_JS,
        capture_output=True,
        text=True,
        timeout=SSH_TIMEOUT_SEC,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ssh/query fallita (exit {proc.returncode}): {proc.stderr.strip()[:500]}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"risposta non JSON dal server: {e}; output: {proc.stdout[:300]!r}")


def crea_foglio_sala(wb, sala_nome, prenot_per_giorno, anni):
    ws = wb.create_sheet(title=sala_nome[:31])

    for c in range(1, N_COLS + 1):
        ws.column_dimensions[get_column_letter(c)].width = COL_WIDTH

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=N_COLS)
    cell = ws.cell(row=1, column=1, value=f"CALENDARIO PRENOTAZIONI — {sala_nome.upper()}")
    cell.font = FONT_TITOLO
    cell.fill = FILL_TITOLO
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=N_COLS)
    sub = ws.cell(
        row=2, column=1,
        value=(
            "Backup offline delle prenotazioni sale — estratto dal gestionale Intranet il "
            f"{datetime.date.today().strftime('%d/%m/%Y alle %H:%M')}. Rigenerato automaticamente "
            "ogni giorno: se manca una prenotazione recente, il backup potrebbe non essersi "
            "ancora aggiornato (vedi _log_backup_calendario.txt nella stessa cartella)."
        ),
    )
    sub.font = FONT_SOTTOTITOLO
    sub.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    ws.row_dimensions[2].height = 16

    row = 4
    cal = calendar.Calendar(firstweekday=0)  # Lunedì

    for anno in anni:
        for mese in range(1, 13):
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=N_COLS)
            mcell = ws.cell(row=row, column=1, value=f"{MESI_IT[mese - 1]} {anno}")
            mcell.font = FONT_MESE
            mcell.fill = FILL_MESE
            mcell.alignment = Alignment(horizontal="center", vertical="center")
            ws.row_dimensions[row].height = 20
            row += 1

            for i, gg in enumerate(GIORNI_IT):
                c = ws.cell(row=row, column=i + 1, value=gg)
                c.font = FONT_GIORNO_SETT
                c.fill = FILL_HEADER_SETT if i < 5 else FILL_WEEKEND
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = BORDER_CELLA
            ws.row_dimensions[row].height = 16
            row += 1

            settimane = cal.monthdayscalendar(anno, mese)
            for settimana in settimane:
                ws.row_dimensions[row].height = ROW_HEIGHT_SETTIMANA
                for i, giorno in enumerate(settimana):
                    c = ws.cell(row=row, column=i + 1)
                    c.border = BORDER_CELLA
                    c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                    if giorno == 0:
                        c.fill = FILL_FUORI_MESE
                        continue
                    data_iso = f"{anno}-{mese:02d}-{giorno:02d}"
                    eventi = prenot_per_giorno.get((sala_nome, data_iso), [])
                    if eventi:
                        c.fill = FILL_EVENTO
                        righe = [str(giorno)]
                        for ev in eventi:
                            oi = ev["ora_inizio"][:5]
                            of = ev["ora_fine"][:5]
                            righe.append(f"{oi}-{of} {ev['richiedente']}")
                            if ev.get("note"):
                                righe.append(ev["note"])
                        c.value = "\n".join(righe)
                    else:
                        c.fill = FILL_WEEKEND if i >= 5 else FILL_VUOTA
                        c.value = str(giorno)
                    c.font = FONT_NUM_GIORNO
                row += 1
            row += 1

    ws.freeze_panes = "A4"
    ws.sheet_view.showGridLines = False


def crea_foglio_istruzioni(wb, sale_nomi, anni):
    ws = wb.create_sheet(title="ISTRUZIONI", index=0)
    ws.column_dimensions["A"].width = 100
    ws.sheet_view.showGridLines = False

    ws.merge_cells("A1:A1")
    t = ws.cell(row=1, column=1, value="Backup offline — Prenotazione sale comunali")
    t.font = Font(name="Arial", size=16, bold=True, color="FFFFFF")
    t.fill = FILL_TITOLO
    t.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 30

    righe = [
        "",
        "A cosa serve questo file",
        (
            "Copia offline delle prenotazioni delle sale comunali gestite dall'Intranet "
            "(prenotazione-sale). Se la VM che ospita l'Intranet non fosse raggiungibile, "
            "questo file resta disponibile su F:\\Condivisa\\Calendario sale per "
            "consultare le prenotazioni in corso."
        ),
        "",
        "Come è organizzato",
        (
            f"Un foglio per ciascuna delle {len(sale_nomi)} sale attive nell'Intranet "
            f"({', '.join(sale_nomi)}), ognuno con un calendario mensile per gli anni "
            f"{anni[0]}-{anni[-1]}. Le celle evidenziate in giallo contengono una prenotazione: "
            "orario, richiedente e nota."
        ),
        "",
        "Aggiornamento automatico",
        (
            "Un task pianificato sul PC dell'amministratore rigenera questo file una volta al giorno "
            "(interroga in sola lettura il database di produzione via SSH e riscrive il file). "
            f"Ultimo aggiornamento riuscito: {datetime.date.today().strftime('%d/%m/%Y alle %H:%M')}. "
            "Se il PC resta spento/sloggato all'orario previsto, l'aggiornamento parte comunque "
            "al primo login successivo. Controllare _log_backup_calendario.txt nella stessa "
            "cartella in caso di dubbi su quanto è aggiornato il file."
        ),
    ]
    TITOLETTI = {"A cosa serve questo file", "Come è organizzato", "Aggiornamento automatico"}
    r = 2
    for testo in righe:
        c = ws.cell(row=r, column=1, value=testo)
        if testo in TITOLETTI:
            c.font = Font(name="Arial", size=12, bold=True, color="1F4E78")
        else:
            c.font = Font(name="Arial", size=10, color="1F1F1F")
        c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        ws.row_dimensions[r].height = 46 if len(testo) > 60 else 18
        r += 1


def costruisci_workbook(dati):
    sale_nomi = [s["nome"] for s in dati["sale"]]
    prenotazioni = dati["prenotazioni"]

    anno_corrente = datetime.date.today().year
    anni_prenotazioni = {int(p["data"][:4]) for p in prenotazioni}
    anni_prenotazioni.add(anno_corrente)
    anni = list(range(min(anni_prenotazioni), max(anni_prenotazioni) + 1))

    prenot_per_giorno = {}
    for p in prenotazioni:
        chiave = (p["sala_nome"], p["data"])
        prenot_per_giorno.setdefault(chiave, []).append(p)

    wb = Workbook()
    wb.remove(wb.active)

    crea_foglio_istruzioni(wb, sale_nomi, anni)
    for sala in sale_nomi:
        crea_foglio_sala(wb, sala, prenot_per_giorno, anni)

    return wb


def salva_atomico(wb, destinazione: Path):
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        suffix=".xlsx", prefix="~tmp_calendario_", dir=str(destinazione.parent)
    )
    os.close(fd)
    try:
        wb.save(tmp_path)
        os.replace(tmp_path, destinazione)  # atomico sullo stesso volume
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def main():
    try:
        dati = interroga_db()
        n_sale = len(dati["sale"])
        n_prenot = len(dati["prenotazioni"])
        wb = costruisci_workbook(dati)
        salva_atomico(wb, FILE_DEST)
        log(f"OK - {n_prenot} prenotazioni su {n_sale} sale scritte in {FILE_DEST.name}")
    except Exception as e:
        log(f"ERRORE - backup NON aggiornato, resta valido il file precedente: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
