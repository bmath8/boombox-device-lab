// Real Mobile Safari in Apple's iOS / iPadOS Simulator, driven by Apple's safaridriver.
// Env: BASE (site), DEVICE (simulator name, for labels), KIND (iPhone|iPad), UDID.
import { Builder } from 'selenium-webdriver';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const probe = createRequire(import.meta.url)('./probe.cjs');
const BASE = process.env.BASE ?? 'https://boom-box-v-5.vercel.app';
const KIND = process.env.KIND ?? 'iPhone';
const DEV = (process.env.DEVICE ?? KIND).replace(/\W+/g, '-');
const OUT = `out/${DEV}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const simShot = (name) => { try { execFileSync('xcrun', ['simctl', 'io', process.env.UDID ?? 'booted', 'screenshot', `${OUT}/${name}.png`], { stdio: 'ignore' }); } catch {} };
const PUBLIC = ['/', '/login', '/welcome', '/check', '/join/TESTCODE', '/link'];
const SIGNED = (process.env.PAGES ?? '/,/stations,/shows,/library,/library/open,/playlists,/family,/family/invite,/discover,/listen,/profile,/profile/account,/profile/music,/play,/play/daily,/play/hits,/play/mix,/play/room,/play/timeline,/studio,/jam,/hum,/voice,/videos,/usage,/tv,/tablet,/check').split(',');

const caps = { browserName: 'safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceType': KIND };
if (process.env.UDID) caps['safari:deviceUDID'] = process.env.UDID;
const driver = await new Builder().usingServer('http://localhost:4444').withCapabilities(caps).build();
await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000 });
const results = [];
const log = (o) => { results.push(o); console.log(JSON.stringify(o)); };

async function visit(path, tag) {
  const t0 = Date.now();
  try {
    await driver.get(BASE + path);
    await sleep(3500);
    const r = await driver.executeScript(`return (${probe.toString()})()`);
    const errs = await driver.executeScript('return (window.__errs||[]).slice(0,5)');
    const name = `${tag}${path.replace(/\//g, '_') || '_root'}`;
    fs.writeFileSync(`${OUT}/${name}.web.png`, await driver.takeScreenshot(), 'base64');
    simShot(name); // the whole simulator screen: Safari's own bars, the notch and the home indicator
    log({ device: DEV, tag, path, ms: Date.now() - t0, ...r, errs });
  } catch (e) { log({ device: DEV, tag, path, error: String(e.message).split('\n')[0] }); }
}

try {
  for (const p of PUBLIC) await visit(p, 'out');
  // Sign in with the demo account (same as the login page's demo button).
  await driver.get(BASE + '/login'); await sleep(2000);
  const signed = await driver.executeAsyncScript(`const done = arguments[arguments.length-1]; fetch('/api/auth/demo',{method:'POST'}).then(r=>done(r.status)).catch(e=>done(String(e)))`);
  log({ device: DEV, step: 'demo sign-in', status: signed });
  for (const p of SIGNED) await visit(p, 'in');

  // The phone check page: what this real Safari reports it can do.
  await driver.get(BASE + '/check'); await sleep(2500);
  await driver.executeScript(`[...document.querySelectorAll('button')].find(b=>/Check this phone/.test(b.textContent))?.click()`);
  await sleep(8000);
  log({ device: DEV, step: 'phone check', heading: await driver.executeScript(`return document.querySelector('h1')?.textContent`),
    rows: await driver.executeScript(`return [...document.querySelectorAll('[data-check]')].map(e=>({check:e.dataset.check,status:e.dataset.status,text:e.innerText.slice(0,160)}))`),
    text: await driver.executeScript(`return document.querySelector('main')?.innerText.slice(0,3000)`) });
  simShot('check-results');

  // Tune in on the radio: real audio, Media Session and the service worker.
  await driver.get(BASE + '/'); await sleep(4000);
  const tuned = await driver.executeScript(`const b=[...document.querySelectorAll('button')].find(b=>/^\\s*Tune in\\s*$/.test(b.textContent)); if(b){b.click(); return true} return false`);
  await sleep(12000);
  simShot('radio-tuned');
  const radio = await driver.executeAsyncScript(`const done = arguments[arguments.length-1];
    (async () => {
      const media = [...document.querySelectorAll('audio,video')].map(m => ({ tag: m.tagName, src: (m.currentSrc||'').slice(0,80), paused: m.paused, t: m.currentTime, ready: m.readyState, err: m.error && m.error.code, muted: m.muted }));
      const iframes = [...document.querySelectorAll('iframe')].map(f => f.src.slice(0,80));
      const ms = navigator.mediaSession ? { state: navigator.mediaSession.playbackState, title: navigator.mediaSession.metadata?.title, artist: navigator.mediaSession.metadata?.artist, art: (navigator.mediaSession.metadata?.artwork||[]).length } : null;
      const sw = navigator.serviceWorker ? (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? 'none' : 'unsupported';
      const status = document.querySelector('main')?.innerText.slice(0,400);
      done({ media, iframes, ms, sw, status });
    })().catch(e => done({ err: String(e) }));`);
  await sleep(5000);
  const later = await driver.executeScript(`return [...document.querySelectorAll('audio,video')].map(m=>({paused:m.paused,t:m.currentTime}))`);
  log({ device: DEV, step: 'radio', tuned, ...radio, fiveSecondsLater: later });

  // Lock the phone (Simulator's Device > Lock) while the radio plays: does the lock screen show Now Playing,
  // and does the song keep going while locked?
  const before = await driver.executeScript(`return [...document.querySelectorAll('audio,video')].map(m=>m.currentTime)`);
  try { execFileSync('osascript', ['-e', 'tell application "Simulator" to activate', '-e', 'delay 1', '-e', 'tell application "System Events" to keystroke "l" using command down']); } catch (e) { log({ step: 'lock', error: String(e).slice(0, 200) }); }
  await sleep(6000); simShot('locked-1');
  try { execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "l" using command down']); } catch {}
  await sleep(3000);
  try { execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "l" using command down']); } catch {}
  await sleep(15000); simShot('locked-2');
  let afterLock = null;
  try { afterLock = await driver.executeScript(`return [...document.querySelectorAll('audio,video')].map(m=>({paused:m.paused,t:m.currentTime}))`); } catch (e) { afterLock = String(e.message).split('\n')[0]; }
  log({ device: DEV, step: 'locked', before, afterLock });
} finally {
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  await driver.quit();
}
