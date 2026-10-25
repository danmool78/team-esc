// 홍보 영상용 앱 화면 촬영: ?demo를 폰 크기(390×780, 2배)로 띄워 장면마다 연속 사진을 찍는다.
// 쓰는 법: (저장소 맨 위에서) python3 -m http.server 8765 & → node promo/capture.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'cap'), URL = 'http://localhost:8765/?demo';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = async (q = '') => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto(URL + q, { waitUntil: 'load' }); await p.waitForTimeout(6000);
    return p;
  };
  const seq = async (p, name, n, gap = 60, each) => {
    for (let i = 0; i < n; i++) { if (each) await each(i); await p.screenshot({ path: `${OUT}/${name}-${String(i).padStart(3, '0')}.jpg`, quality: 88 }); await p.waitForTimeout(gap); }
    console.log(name, n);
  };
  const go = async (p, who) => { await p.fill('#find', who); await p.waitForTimeout(300); await p.keyboard.press('Enter'); };

  // ONLY=bus 처럼 주면 버스부터만 다시 찍는다
  let p;
  if (process.env.ONLY !== 'bus') {
  // 1) 3D 지도: 내가 걸어가고 팀원들이 돌아다닌다
  p = await page();
  await p.tap('#grip');
  await p.mouse.click(250, 260); await p.waitForTimeout(1500);
  await seq(p, 'map', 40, 40, async i => { if (i % 12 === 0) await p.mouse.click(180 + (i % 24) * 3, 250); });
  // 2) 미션: 경기전 홍살문으로 가서 완료 → 알림·점수판
  await p.tap('#grip');
  await p.evaluate(() => document.querySelector('.item[data-m="m0"]').click()); await p.waitForTimeout(800);
  await seq(p, 'msheet', 1);
  await p.evaluate(() => document.querySelector('#simGo')?.click());
  await seq(p, 'mdone', 30, 80);
  await p.context().close();
  }

  // 3) 단체 버스 (45명) — 사람이 많아 한 장에 몇 초씩 걸리니, 가짜 참가자를 세워 두고 1초씩만 움직여 찍는다
  p = await page('&crowd');
  await p.tap('#grip'); await go(p, '은혜'); await p.waitForTimeout(34000);
  await p.mouse.move(200, 300); await p.mouse.wheel(0, 250); await p.waitForTimeout(2000);
  const step = async () => { await p.evaluate(async () => (await import('/demo.js')).pause(false)); await p.waitForTimeout(1000); await p.evaluate(async () => (await import('/demo.js')).pause(true)); await p.waitForTimeout(700); };
  await p.evaluate(async () => (await import('/demo.js')).pause(true));
  await seq(p, 'bus', 32, 0, step);
  // 4) 자동차
  await go(p, '바람'); await step(); await step();
  await seq(p, 'car', 24, 0, step);
  await p.evaluate(async () => (await import('/demo.js')).pause(false));
  // 5) 끝나는 시간 5분 전 → 6) 결과
  await p.evaluate(async () => (await import('/demo.js')).saveMeta('DEMO', { endAt: Date.now() + 299000 })); await p.waitForTimeout(2500);
  await seq(p, 'timer', 1);
  await p.tap('#grip'); await p.tap('.tabs button[data-tab=host]');
  await p.evaluate(() => { document.querySelector('#hEnd').click(); document.querySelector('#hEnd')?.click(); });
  await p.waitForTimeout(1300);
  await seq(p, 'result', 24, 60);
  await b.close();
})();
