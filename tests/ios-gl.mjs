// Which piece of the live 3D stage leaves Mobile Safari's canvas blank: one page, one variant at a time.
import { Builder } from 'selenium-webdriver';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const DEV = (process.env.DEVICE ?? 'iPhone').replace(/\W+/g, '-');
const OUT = `out/${DEV}`; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const caps = { browserName: 'safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceType': process.env.KIND ?? 'iPhone' };
if (process.env.UDID) caps['safari:deviceUDID'] = process.env.UDID;
let driver;
for (let i = 1; i <= 5 && !driver; i++) {
  try { execFileSync('xcrun', ['simctl', 'launch', process.env.UDID ?? 'booted', 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch {}
  await sleep(8000 + i * 4000);
  try { driver = await new Builder().usingServer('http://localhost:4444').withCapabilities(caps).build(); } catch (e) { console.log('session', i, String(e.message).split('\n')[0]); }
}
const results = [];
try {
  for (const v of ['classic', 'basic', 'hdr', 'mrt', 'gtao', 'full', 'webgpu']) {
    try {
      await driver.get(`http://localhost:8000/?v=${v}`);
      await sleep(9000);
      const lines = await driver.executeScript('return window.__log || []');
      results.push({ v, lines }); console.log(v, JSON.stringify(lines));
      execFileSync('xcrun', ['simctl', 'io', process.env.UDID ?? 'booted', 'screenshot', `${OUT}/gl-${v}.png`], { stdio: 'ignore' });
    } catch (e) { results.push({ v, error: String(e.message).split('\n')[0] }); }
  }
} finally {
  fs.writeFileSync(`${OUT}/gl.json`, JSON.stringify(results, null, 1));
  try { await driver?.quit(); } catch {}
}
