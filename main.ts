// Crimson Harbor — a top-down open-world crime game (gta6-01 entry).
// The program hands the game in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Build summary for the entry log: count the shipped game files and screenshots.
const countFiles = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
  const p = join(dir, e.name);
  return n + (e.isDirectory() ? countFiles(p) : 1);
}, 0);
const gameFiles = countFiles(join(here, 'game'));
const shotFiles = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => statSync(join(here, 'screenshots', f)).isFile()).length
  : 0;
console.log(`Crimson Harbor (gta6-01): ${gameFiles} game files, ${shotFiles} screenshots -> ${out}`);

// Build summary for the entry log: count the shipped game files and screenshots.

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Verify the handoff landed: report the dossier size so a bad build is visible.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Crimson Harbor dossier written: ${dossierBytes} bytes`);
