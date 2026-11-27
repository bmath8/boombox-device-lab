// Real Chrome for Android in the Android emulator, driven over the DevTools protocol (adb forward).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const probe = createRequire(import.meta.url)('./probe.cjs');
const BASE = process.env.BASE ?? 'https://boom-box-v-5.vercel.app';
const DEV = (process.env.DEVICE ?? 'android').replace(/\W+/g, '-');
const OUT = `out/${DEV}`; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adbShot = (name) => { try { execSync(`adb exec-out screencap -p > ${OUT}/${name}.png`); } catch {} };
const PUBLIC = ['/', '/login', '/welcome', '/check', '/join/TESTCODE'];
const SIGNED = (process.env.PAGES || '/,/stations,/shows,/library,/library/open,/playlists,/family,/family/invite,/discover,/listen,/profile,/profile/account,/profile/music,/play,/play/daily,/play/hits,/play/mix,/play/room,/play/timeline,/studio,/jam,/hum,/voice,/videos,/usage,/tv,/check').split(',');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] ?? await ctx.newPage();
const results = []; const log = (o) => { results.push(o); console.log(JSON.stringify(o)); };
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
async function visit(path, tag) {
  errs.length = 0; const t0 = Date.now();
  try {
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 }); await sleep(3000);
    // The demo account is shared: if another test signed it out everywhere, sign in again and retry once.
    if (tag === 'in' && new URL(page.url()).pathname === '/login') {
      const st = await page.evaluate(() => fetch('/api/auth/demo', { method: 'POST' }).then((r) => r.status));
      log({ device: DEV, step: 'signed out mid-run, signed in again', path, status: st });
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 }); await sleep(3000);
    }
    const r = await page.evaluate(`(${probe.toString()})()`);
    const name = `${tag}${path.replace(/\//g, '_') || '_root'}`;
    adbShot(name);
    log({ device: DEV, tag, path, ms: Date.now() - t0, ...r, errs: [...new Set(errs)].slice(0, 6) });
  } catch (e) { log({ device: DEV, tag, path, error: String(e.message).split('\n')[0] }); }
}
try {
  for (const p of PUBLIC) await visit(p, 'out');
  await page.goto(BASE + '/login'); await sleep(1500);
  log({ device: DEV, step: 'demo sign-in', status: await page.evaluate(() => fetch('/api/auth/demo', { method: 'POST' }).then((r) => r.status)) });
  for (const p of SIGNED) await visit(p, 'in');
  await page.goto(BASE + '/check'); await sleep(2000);
  await page.getByRole('button', { name: 'Check this phone' }).click().catch(() => {});
  await sleep(8000); adbShot('check-results');
  log({ device: DEV, step: 'phone check', text: await page.locator('main').innerText().catch(() => '') });
  await page.goto(BASE + '/'); await sleep(4000);
  const tuned = await page.getByRole('button', { name: /^Tune in$/ }).first().click({ timeout: 10000 }).then(() => true).catch(() => false);
  await sleep(12000); adbShot('radio-tuned');
  const radio = await page.evaluate(async () => ({
    media: [...document.querySelectorAll('audio,video')].map((m) => ({ src: (m.currentSrc || '').slice(0, 80), paused: m.paused, t: m.currentTime, ready: m.readyState, err: m.error?.code })),
    ms: navigator.mediaSession ? { state: navigator.mediaSession.playbackState, title: navigator.mediaSession.metadata?.title } : null,
    sw: (await navigator.serviceWorker?.getRegistration())?.active?.scriptURL ?? 'none',
    status: document.querySelector('main')?.innerText.slice(0, 400) }));
  await sleep(5000);
  log({ device: DEV, step: 'radio', tuned, ...radio, later: await page.evaluate(() => [...document.querySelectorAll('audio,video')].map((m) => ({ paused: m.paused, t: m.currentTime }))) });
  // Install prompt: Chrome fires beforeinstallprompt when the site qualifies as an app.
  log({ device: DEV, step: 'installable', manifest: await page.evaluate(() => document.querySelector('link[rel=manifest]')?.href) });
} finally { fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1)); await browser.close().catch(() => {}); }
