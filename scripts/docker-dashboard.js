#!/usr/bin/env node
// Tool locale, NON esposto sul web: si lancia a mano (npm run docker:dashboard) e parla via SSH
// col server di produzione. Non collegarlo a nessuna route HTTP dell'app Next.js.

const { spawnSync } = require('child_process');
const readline = require('readline');

const SSH_HOST = process.env.INTRANET_SSH_HOST || 'utente@IP_DEL_SERVER';
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const COLOR = process.stdout.isTTY;
const c = {
  reset: COLOR ? '\x1b[0m' : '',
  green: COLOR ? '\x1b[32m' : '',
  red: COLOR ? '\x1b[31m' : '',
  yellow: COLOR ? '\x1b[33m' : '',
  dim: COLOR ? '\x1b[2m' : '',
  bold: COLOR ? '\x1b[1m' : '',
  cyan: COLOR ? '\x1b[36m' : '',
};

function colorize(str, color) {
  return COLOR ? color + str + c.reset : str;
}

function runRemote(cmd) {
  return spawnSync('ssh', [SSH_HOST, cmd], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function runRemoteScript(script) {
  return spawnSync('ssh', [SSH_HOST, 'bash'], { input: script, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function validateName(name) {
  if (!NAME_RE.test(name)) throw new Error(`Nome non valido: "${name}"`);
  return name;
}

function dockerCmd(cmd) {
  const res = runRemote(cmd);
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() };
}

const stopContainer = (name) => dockerCmd(`docker stop -- '${validateName(name)}'`);
const startContainer = (name) => dockerCmd(`docker start -- '${validateName(name)}'`);
const restartContainer = (name) => dockerCmd(`docker restart -- '${validateName(name)}'`);
const removeContainer = (name) => dockerCmd(`docker rm -- '${validateName(name)}'`);
const removeVolume = (name) => dockerCmd(`docker volume rm -- '${validateName(name)}'`);
const pruneBuilderSafe = () => dockerCmd('docker builder prune -f');
const pruneBuilderAll = () => dockerCmd('docker builder prune -a -f');
const pruneImagesSafe = () => dockerCmd('docker image prune -f');
const pruneImagesAll = () => dockerCmd('docker image prune -a -f');
const pruneStoppedContainers = () => dockerCmd('docker container prune -f');
const pruneVolumesAll = () => dockerCmd('docker volume prune -f');

const GATHER_SCRIPT = `
set -euo pipefail
echo "===SUMMARY==="
docker system df
echo "===CONTAINERS==="
docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Size}}|{{.Label "com.docker.compose.project"}}'
echo "===IMAGES==="
docker images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedSince}}'
echo "===VOLUMES==="
docker system df -v 2>/dev/null | awk '/Local Volumes space usage/{f=1; next} f && /^Build cache/{f=0} f && NF>0 && $1!="VOLUME"{print}'
echo "===DANGLING_VOLUMES==="
docker volume ls -f dangling=true --format '{{.Name}}'
echo "===END==="
`;

function parseSections(raw) {
  const markers = ['===SUMMARY===', '===CONTAINERS===', '===IMAGES===', '===VOLUMES===', '===DANGLING_VOLUMES===', '===END==='];
  const idx = {};
  for (const m of markers) idx[m] = raw.indexOf(m);
  const slice = (start, end) => {
    if (idx[start] === -1 || idx[end] === -1) return '';
    return raw.slice(idx[start] + start.length, idx[end]).trim();
  };
  return {
    summary: slice('===SUMMARY===', '===CONTAINERS==='),
    containersRaw: slice('===CONTAINERS===', '===IMAGES==='),
    imagesRaw: slice('===IMAGES===', '===VOLUMES==='),
    volumesRaw: slice('===VOLUMES===', '===DANGLING_VOLUMES==='),
    danglingRaw: slice('===DANGLING_VOLUMES===', '===END==='),
    complete: raw.includes('===END==='),
  };
}

function gather() {
  const res = runRemoteScript(GATHER_SCRIPT);
  if (res.status !== 0) {
    throw new Error(`Errore SSH/Docker (exit ${res.status}):\n${res.stderr || res.stdout}`);
  }
  const sections = parseSections(res.stdout);
  if (!sections.complete) {
    console.warn(colorize('Attenzione: output incompleto dal server, alcuni dati potrebbero mancare.', c.yellow));
  }

  const containers = sections.containersRaw.split('\n').filter(Boolean).map((line) => {
    const [id, name, image, state, status, size, project] = line.split('|');
    return { id, name, image, state, status, size, project: project || '(standalone)' };
  });

  const images = sections.imagesRaw.split('\n').filter(Boolean).map((line) => {
    const [id, repo, tag, size, created] = line.split('|');
    return { id, repo, tag, size, created };
  });

  const dangling = new Set(sections.danglingRaw.split('\n').map((s) => s.trim()).filter(Boolean));

  const volumes = sections.volumesRaw.split('\n').filter(Boolean).map((line) => {
    const parts = line.trim().split(/\s+/);
    const size = parts.pop();
    const links = parts.pop();
    const name = parts.join(' ');
    return { name, links, size, inUse: !dangling.has(name) };
  });

  return { summary: sections.summary, containers, images, volumes };
}

function padPlain(str, len) {
  str = String(str ?? '');
  if (str.length < len) return str.padEnd(len);
  return (str.slice(0, Math.max(len - 2, 1)) + '… ').padEnd(len);
}

function render(data) {
  console.log('\n' + '='.repeat(78));
  console.log(colorize(`Docker dashboard — ${SSH_HOST}`, c.bold) + '  ' + colorize(new Date().toLocaleString('it-IT'), c.dim));

  const byProject = new Map();
  for (const ct of data.containers) {
    if (!byProject.has(ct.project)) byProject.set(ct.project, []);
    byProject.get(ct.project).push(ct);
  }

  console.log('\n' + colorize('CONTAINER', c.bold));
  console.log(padPlain('NOME', 32) + padPlain('STATO', 8) + padPlain('PESO', 24) + 'IMMAGINE');
  for (const [project, list] of [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(colorize(`-- ${project} --`, c.cyan));
    for (const ct of list) {
      const running = ct.state === 'running';
      const stateLabel = colorize(padPlain(running ? 'attivo' : 'fermo', 8), running ? c.green : c.red);
      console.log(padPlain(ct.name, 32) + stateLabel + padPlain(ct.size, 24) + ct.image);
    }
  }

  console.log('\n' + colorize('IMMAGINI', c.bold));
  console.log(padPlain('REPOSITORY', 55) + padPlain('TAG', 22) + padPlain('PESO', 10) + 'CREATA');
  for (const img of data.images) {
    console.log(padPlain(img.repo, 55) + padPlain(img.tag, 22) + padPlain(img.size, 10) + img.created);
  }

  console.log('\n' + colorize('VOLUMI', c.bold));
  console.log(padPlain('NOME', 55) + padPlain('PESO', 10) + 'IN USO');
  for (const v of data.volumes) {
    const useLabel = v.inUse ? colorize('si', c.green) : colorize('no (rimuovibile)', c.yellow);
    console.log(padPlain(v.name, 55) + padPlain(v.size, 10) + useLabel);
  }

  console.log('\n' + colorize('RIEPILOGO SPAZIO (docker system df)', c.bold));
  console.log(data.summary);
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function confirmType(rl, expected, label) {
  const answer = await ask(rl, `${label}\n  -> digita esattamente "${expected}" per confermare (invio vuoto per annullare): `);
  return answer.trim() === expected;
}

async function pickFrom(rl, list, describe, promptText) {
  if (!list.length) return null;
  list.forEach((item, i) => console.log(`${i + 1}) ${describe(item)}`));
  const answer = await ask(rl, promptText);
  const idx = parseInt(answer, 10) - 1;
  return list[idx] || null;
}

function printResult(r, okMsg) {
  if (r.ok) {
    console.log(colorize(okMsg, c.green) + (r.out ? '\n' + r.out : ''));
  } else {
    console.log(colorize(r.err || 'Errore sconosciuto.', c.red));
  }
}

const MENU = `
${'-'.repeat(78)}
 1) Aggiorna vista
 2) Ferma un container
 3) Avvia un container
 4) Riavvia un container
 5) Rimuovi un container (deve essere fermo)
 6) Pulisci cache build inutilizzata (sicura)
 7) Pulisci cache build TOTALE (aggressiva, anche cache in uso)
 8) Pulisci immagini dangling (sicura)
 9) Pulisci immagini inutilizzate TOTALE (aggressiva, -a)
10) Rimuovi tutti i container fermi (docker container prune)
11) Rimuovi un volume specifico (solo se non in uso)
12) Rimuovi TUTTI i volumi non utilizzati (distruttivo, perdita dati)
 0) Esci
`;

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('SIGINT', () => { rl.close(); process.exit(0); });

  let data;
  try {
    data = gather();
  } catch (e) {
    console.error(colorize(e.message, c.red));
    rl.close();
    process.exit(1);
  }
  render(data);

  while (true) {
    console.log(MENU);
    const choice = (await ask(rl, 'Scegli: ')).trim();

    try {
      switch (choice) {
        case '0':
          rl.close();
          return;
        case '1':
          data = gather();
          break;
        case '2': {
          const ct = await pickFrom(rl, data.containers.filter((x) => x.state === 'running'), (x) => `${x.name} (${x.project})`, 'Container da fermare: ');
          if (!ct) { console.log('Annullato.'); break; }
          if (!(await confirmType(rl, ct.name, `Fermare "${ct.name}"`))) { console.log('Annullato.'); break; }
          printResult(stopContainer(ct.name), 'Fermato.');
          data = gather();
          break;
        }
        case '3': {
          const ct = await pickFrom(rl, data.containers.filter((x) => x.state !== 'running'), (x) => `${x.name} (${x.project})`, 'Container da avviare: ');
          if (!ct) { console.log('Annullato.'); break; }
          printResult(startContainer(ct.name), 'Avviato.');
          data = gather();
          break;
        }
        case '4': {
          const ct = await pickFrom(rl, data.containers, (x) => `${x.name} [${x.state}] (${x.project})`, 'Container da riavviare: ');
          if (!ct) { console.log('Annullato.'); break; }
          if (!(await confirmType(rl, ct.name, `Riavviare "${ct.name}" (downtime di qualche secondo)`))) { console.log('Annullato.'); break; }
          printResult(restartContainer(ct.name), 'Riavviato.');
          data = gather();
          break;
        }
        case '5': {
          const stopped = data.containers.filter((x) => x.state !== 'running');
          if (!stopped.length) { console.log('Nessun container fermo.'); break; }
          const ct = await pickFrom(rl, stopped, (x) => `${x.name} (${x.project})`, 'Container da rimuovere: ');
          if (!ct) { console.log('Annullato.'); break; }
          if (!(await confirmType(rl, ct.name, `Rimuovere definitivamente il container "${ct.name}"`))) { console.log('Annullato.'); break; }
          printResult(removeContainer(ct.name), 'Rimosso.');
          data = gather();
          break;
        }
        case '6':
          printResult(pruneBuilderSafe(), 'Cache build inutilizzata rimossa.');
          data = gather();
          break;
        case '7': {
          if (!(await confirmType(rl, 'CONFERMA', 'Rimuovere TUTTA la cache di build, anche quella in uso (le prossime build ripartiranno da zero)'))) { console.log('Annullato.'); break; }
          printResult(pruneBuilderAll(), 'Cache build svuotata.');
          data = gather();
          break;
        }
        case '8':
          printResult(pruneImagesSafe(), 'Immagini dangling rimosse.');
          data = gather();
          break;
        case '9': {
          if (!(await confirmType(rl, 'CONFERMA', 'Rimuovere TUTTE le immagini non usate da nessun container (andranno riscaricate/ribuildate al bisogno)'))) { console.log('Annullato.'); break; }
          printResult(pruneImagesAll(), 'Immagini inutilizzate rimosse.');
          data = gather();
          break;
        }
        case '10': {
          const stopped = data.containers.filter((x) => x.state !== 'running');
          if (!stopped.length) { console.log('Nessun container fermo da rimuovere.'); break; }
          console.log('Verranno rimossi: ' + stopped.map((x) => x.name).join(', '));
          if (!(await confirmType(rl, 'CONFERMA', 'Rimuovere tutti i container fermi elencati sopra'))) { console.log('Annullato.'); break; }
          printResult(pruneStoppedContainers(), 'Fatto.');
          data = gather();
          break;
        }
        case '11': {
          const removable = data.volumes.filter((v) => !v.inUse);
          if (!removable.length) { console.log('Nessun volume rimovibile (tutti in uso).'); break; }
          const v = await pickFrom(rl, removable, (x) => `${x.name} (${x.size})`, 'Volume da rimuovere: ');
          if (!v) { console.log('Annullato.'); break; }
          if (!(await confirmType(rl, v.name, `RIMOZIONE DATI PERMANENTE del volume "${v.name}" (${v.size})`))) { console.log('Annullato.'); break; }
          printResult(removeVolume(v.name), 'Volume rimosso.');
          data = gather();
          break;
        }
        case '12': {
          const removable = data.volumes.filter((v) => !v.inUse);
          if (!removable.length) { console.log('Nessun volume non utilizzato.'); break; }
          console.log('Verranno cancellati permanentemente: ' + removable.map((v) => `${v.name} (${v.size})`).join(', '));
          if (!(await confirmType(rl, 'CONFERMA', 'RIMOZIONE DATI PERMANENTE di tutti i volumi non utilizzati elencati sopra'))) { console.log('Annullato.'); break; }
          printResult(pruneVolumesAll(), 'Fatto.');
          data = gather();
          break;
        }
        default:
          console.log('Scelta non valida.');
      }
    } catch (e) {
      console.log(colorize(e.message, c.red));
    }

    render(data);
  }
}

main();
