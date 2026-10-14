// Usage: node tools/stills.mjs outDir t1 t2 ...  — renders still frames (PNG) at the given times.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { serve } from './server.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [out, ...times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const srv = await serve(root);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await page.waitForFunction(() => window.filmReady === true, null, { timeout: 120000 });
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate(x => window.renderAt(x), parseFloat(t));
  await page.screenshot({ path: path.join(out, `t${String(Math.round(parseFloat(t) * 100)).padStart(5, '0')}.png`) });
  console.log(t, Date.now() - t0, 'ms');
}
await browser.close(); srv.close();
