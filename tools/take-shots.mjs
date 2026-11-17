// Produce the four entry screenshots: start the repo's own server, render
// each ?shot= scene with the cached headless Chromium, convert the PNGs to
// JPG with the cached ffmpeg, and save them into screenshots/.
// Run from the repo root:  node tools/take-shots.mjs
import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'screenshots');
const tmpDir = join(tmpdir(), 'crimson-harbor-shots');
mkdirSync(tmpDir, { recursive: true });

const home = process.env.HOME || '/home/hatch';
const cache = join(home, '.cache', 'ms-playwright');

function findChrome() {
  for (const d of readdirSync(cache)) {
    if (!d.startsWith('chromium_headless_shell-')) continue;
    const p = join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  for (const d of readdirSync(cache)) {
    if (!d.startsWith('chromium-')) continue;
    const p = join(cache, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('no cached chromium found under ' + cache);
}

function findFfmpeg() {
  // Prefer a full system ffmpeg: the cached Playwright build is minimal
  // (--disable-everything, mjpeg/vp9 only) and cannot decode PNG or encode JPEG.
  for (const candidate of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    if (existsSync(candidate)) return candidate;
  }
  for (const d of readdirSync(cache)) {
    if (!d.startsWith('ffmpeg-')) continue;
    const p = join(cache, d, 'ffmpeg-linux');
    if (existsSync(p)) return p;
  }
  throw new Error('no ffmpeg found');
}

const chrome = findChrome();
const ffmpeg = findFfmpeg();
console.log('chrome:', chrome);
console.log('ffmpeg:', ffmpeg);

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, opts || {}, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`));
      else resolve({ stdout, stderr });
    });
    if (child.stdout) child.stdout.on('data', (d) => process.stdout.write(d));
    if (child.stderr) child.stderr.on('data', (d) => process.stderr.write(d));
  });
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not come up: ' + url);
}

async function waitForStableFile(path, tries = 20) {
  let last = -1;
  for (let i = 0; i < tries; i += 1) {
    try {
      const size = statSync(path).size;
      if (size > 0 && size === last) return;
      last = size;
    } catch { /* not there yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('file never stabilized: ' + path);
}

const scenes = [
  ['title', '1-title.jpg'],
  ['city', '2-city.jpg'],
  ['chase', '3-chase.jpg'],
  ['mission', '4-mission.jpg'],
];

const server = spawn('node', ['serve.ts'], { cwd: root, stdio: 'ignore' });
try {
  await waitForServer('http://localhost:8080/index.html');
  for (const [scene, file] of scenes) {
    const png = join(tmpDir, `${scene}.png`);
    const jpg = join(outDir, file);
    await run(chrome, [
      '--headless', '--disable-gpu', '--no-sandbox',
      '--window-size=1280,800', '--virtual-time-budget=20000',
      `--screenshot=${png}`,
      `http://localhost:8080/?shot=${scene}&seed=7`,
    ]);
    if (!existsSync(png)) throw new Error('no PNG for ' + scene);
    await waitForStableFile(png);
    // Convert to JPG at quality 85; step down if it is still over 200 KiB.
    let quality = 85;
    for (;;) {
      await run(ffmpeg, ['-y', '-v', 'error', '-i', png, '-q:v', String(quality), jpg]);
      const size = statSync(jpg).size;
      console.log(`${file}: ${size} bytes (q=${quality})`);
      if (size <= 200 * 1024 || quality <= 40) break;
      quality -= 10;
    }
    const final = statSync(jpg).size;
    if (final > 262144) throw new Error(`${file} is ${final} bytes, over the 256 KiB cap`);
  }
} finally {
  server.kill();
}

console.log('screenshots done:', readdirSync(outDir).filter((f) => f.endsWith('.jpg')).sort().join(', '));
