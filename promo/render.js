// 쇼츠 만들기: shorts.html을 1080×1920으로 띄워 30fps로 한 장씩 그려 ffmpeg로 엮고 소리(audio/final.wav)를 입힌다
// 쓰는 법: (저장소 맨 위에서) python3 -m http.server 8765 & → node promo/capture.js → python3 promo/audio.py → node promo/render.js [미리보기 초...]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const D = __dirname, FPS = 30;
const counts = {};
fs.readdirSync(path.join(D, 'cap')).forEach(f => { const m = f.match(/^([a-z]+)-\d+\.jpg$/); if (m) counts[m[1]] = (counts[m[1]] || 0) + 1; });
const avatars = fs.readdirSync(path.join(D, 'cap')).filter(f => f.startsWith('av-')).sort().map(f => 'cap/' + f);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.addInitScript(([c, a]) => { window.CAP = c; window.AVATARS = a; }, [counts, avatars]);
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8765/promo/shorts.html'); await p.waitForFunction(() => window.render && window.ready); await p.evaluate(() => window.ready);
  const stills = process.argv.slice(2).map(Number);
  if (stills.length) {
    for (const t of stills) { await p.evaluate(t => window.render(t), t); await p.waitForTimeout(150); await p.screenshot({ path: path.join(D, `still-${t}.jpg`), type: 'jpeg', quality: 80 }); }
    return b.close();
  }
  const total = await p.evaluate(() => window.TOTAL), n = Math.round(total * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', path.join(D, 'audio/final.wav'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(D, 'vision-quest-shorts.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => window.render(t), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 90 === 0) console.log('frame', i, '/', n);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('done'); await b.close();
})();
