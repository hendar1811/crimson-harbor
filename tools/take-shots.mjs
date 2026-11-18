// Take the four entry screenshots: serves the game on port 8080, renders each
// deterministic shot scene with the cached headless Chromium, converts PNG to
// JPG with the cached ffmpeg (the Playwright ffmpeg lacks a PNG decoder).
import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shotsDir = join(root, 'screenshots');
const home = process.env.HOME;

function findChromium() {
  const base = join(home, '.cache', 'ms-playwright');
  const candidates = [
    'chrome-headless-shell-linux64/chrome-headless-shell',
    'chrome-linux/headless_shell',
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
  ];
  for (const d of readdirSync(base)) {
    for (const c of candidates) {
      const p = join(base, d, c);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('no cached chromium found under ' + base);
}

function findFfmpeg() {
  // Prefer the system ffmpeg: the cached Playwright ffmpeg has no PNG
  // decoder or JPEG encoder, so it cannot do this conversion.
  const sys = '/usr/bin/ffmpeg';
  if (existsSync(sys)) return sys;
  const base = join(home, '.cache', 'ms-playwright');
  for (const d of readdirSync(base)) {
    if (!d.startsWith('ffmpeg-')) continue;
    const bin = join(base, d, 'ffmpeg-linux');
    if (existsSync(bin)) return bin;
    const nested = join(base, d, 'ffmpeg-linux', 'ffmpeg');
    if (existsSync(nested)) return nested;
  }
  throw new Error('no ffmpeg found');
}

const SCENES = [
  { scene: 'title', file: '1-title.jpg' },
  { scene: 'city', file: '2-city.jpg' },
  { scene: 'chase', file: '3-chase.jpg' },
  { scene: 'mission', file: '4-mission.jpg' },
];

async function main() {
  const chrome = findChromium();
  const ffmpeg = findFfmpeg();
  console.log('chromium:', chrome);
  console.log('ffmpeg:', ffmpeg);
  mkdirSync(shotsDir, { recursive: true });

  const server = spawn('node', ['serve.ts'], { cwd: root, stdio: 'inherit' });
  await new Promise((r) => setTimeout(r, 2500));
  try {
    for (const { scene, file } of SCENES) {
      const png = join('/tmp', `ch-${scene}.png`);
      const jpg = join(shotsDir, file);
      const url = `http://localhost:8080/?shot=${scene}&seed=7`;
      await run(chrome, [
        '--headless', '--disable-gpu', '--no-sandbox',
        '--window-size=1280,800', '--hide-scrollbars',
        '--virtual-time-budget=20000',
        `--screenshot=${png}`, url,
      ]);
      // Convert, targeting under 200 KiB.
      await run(ffmpeg, ['-y', '-i', png, '-q:v', '4', jpg]);
      let size = statSync(jpg).size;
      let q = 4;
      while (size > 200 * 1024 && q < 10) {
        q += 1;
        await run(ffmpeg, ['-y', '-i', png, '-q:v', String(q), jpg]);
        size = statSync(jpg).size;
      }
      const { stdout } = await run(ffmpeg, ['-i', jpg], { encoding: 'utf8' }).catch((e) => ({ stdout: e.stdout || '', stderr: e.stderr || '' }));
      console.log(`${file}: ${size} bytes`);
      if (size > 256 * 1024) throw new Error(`${file} exceeds 256 KiB (${size})`);
      void stdout;
    }
  } finally {
    server.kill();
  }
  // Verify dimensions of all four.
  for (const { file } of SCENES) {
    const p = join(shotsDir, file);
    const { stdout } = await run('/usr/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p]).catch(() => ({ stdout: '' }));
    console.log(file, statSync(p).size, 'bytes', stdout.trim());
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
