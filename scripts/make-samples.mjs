// Writes demo payout screenshots (PNG) with TODAY's date into ./demo-screenshots.
// Run on demo day:  npm run samples
// Rendered with headless Chrome/Edge, which shapes Hindi and Kannada text correctly.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SAMPLES, sampleSVG } from '../src/lib/samples.ts';

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('Chrome or Edge not found. Set CHROME_PATH to your browser executable.');
  process.exit(1);
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const outDir = resolve('demo-screenshots');
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'kilometre-samples-'));
const profile = join(work, 'profile');

try {
  SAMPLES.forEach((s, i) => {
    const html = join(work, `${s.id}.html`);
    writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#F5F5F5}svg{display:block}</style></head><body>${sampleSVG(s.id, today)}</body></html>`);
    const png = join(outDir, `${i + 1}-${s.id}.png`);
    execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${profile}`,
      '--window-size=720,1280', '--force-device-scale-factor=1.5', `--screenshot=${png}`, pathToFileURL(html).href,
    ], { stdio: 'ignore', timeout: 60000 });
    console.log(`✓ demo-screenshots/${i + 1}-${s.id}.png`);
  });
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`\nDated ${today}. Drag these into Kilometre → Import. They are clearly marked SAMPLE.`);
