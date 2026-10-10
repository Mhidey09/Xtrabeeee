// Full render: node tools/render.mjs [workers] [fps]
// Each worker renders a contiguous frame range in headless Chromium and pipes JPEG frames to its own
// ffmpeg encode; the segments are then concatenated and muxed with audio/mix.wav.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORKERS = parseInt(process.argv[2] || '3', 10);
const FPS = parseInt(process.argv[3] || '30', 10);
const DURATION = 80;
const TOTAL = DURATION * FPS;
// Optional partial render: FRAMES=start:end renders only that range to build/patch.mp4
const RANGE = process.env.FRAMES ? process.env.FRAMES.split(':').map(Number) : null;
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });
const srv = await serve(root);
const url = `http://127.0.0.1:${srv.address().port}/index.html`;

async function worker(w) {
  const [a0, a1] = RANGE || [0, TOTAL];
  const f0 = a0 + Math.floor((a1 - a0) * w / WORKERS), f1 = a0 + Math.floor((a1 - a0) * (w + 1) / WORKERS);
  const seg = path.join(outDir, `seg${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.log(`[w${w} err]`, e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.filmReady === true, null, { timeout: 180000 });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`w${w} frame ${f}/${f1} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  return seg;
}

const segs = await Promise.all([...Array(WORKERS).keys()].map(worker));
srv.close();
if (RANGE) { console.log('done (partial)', segs); process.exit(0); }
fs.writeFileSync(path.join(outDir, 'segs.txt'), segs.map(s => `file '${s}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(outDir, 'segs.txt'), '-c', 'copy', path.join(outDir, 'video_only.mp4')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(outDir, 'video_only.mp4'), '-i', path.join(root, 'audio', 'mix.wav'),
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', path.join(outDir, 'the-internet-court.mp4')]);
console.log('done', path.join(outDir, 'the-internet-court.mp4'));
