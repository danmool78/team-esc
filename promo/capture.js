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

  let p;
  // ONLY=drive: 내가 차를 타고 남천교 청연루까지 달려가 현장 미션을 하는 장면만
  if (process.env.ONLY === 'drive') {
    p = await page();
    await p.tap('#grip');
    const M = { lat: 35.81079, lng: 127.15328 }, S = { lat: M.lat - 0.0011, lng: M.lng - 0.0014 };
    const N = 14; // 1초에 한 번, 약 12m씩 (시속 40km 남짓)
    for (let k = 0; k <= N; k++) {
      const f = k / N * 0.88; // 미션 반경 바로 앞에서 멈춘다
      await p.evaluate(async ll => (await import('/demo.js?v=__BUILD__')).writePos('DEMO', { ...ll, acc: 4 }), { lat: S.lat + (M.lat - S.lat) * f, lng: S.lng + (M.lng - S.lng) * f });
      if (k <= 1) await p.waitForTimeout(1000); // 처음 두 번은 속도를 잴 시간
      for (let j = 0; j < 4 && k > 1; j++) await p.screenshot({ path: `${OUT}/drv-${String((k - 2) * 4 + j).padStart(3, '0')}.jpg`, quality: 88 }).then(() => p.waitForTimeout(150));
    }
    // 도착 → 현장 미션 창 → 확인 요청
    await p.evaluate(() => document.querySelector('.item[data-m="m5"]').click()); await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelector('#simGo')?.click()); await p.waitForTimeout(3000);
    await p.evaluate(() => document.querySelector('#simGo')?.remove()); // 테스트용 단추는 영상에서 뺀다
    await seq(p, 'task', 1);
    await p.evaluate(() => document.querySelector('#taskBtn')?.click());
    await seq(p, 'taskdone', 12, 80);
    // 진행자 화면: 확인 기다리는 현장 미션 → 판정 → 인정 → 점수가 오른다
    await p.evaluate(() => { document.querySelector('#sheet').hidden = true; document.querySelector('.tabs button[data-tab=host]').click(); }); await p.waitForTimeout(600);
    await seq(p, 'judgelist', 1);
    await p.evaluate(() => document.querySelector('[data-judge]').click()); await p.waitForTimeout(600);
    await seq(p, 'judge', 1);
    await p.evaluate(() => document.querySelector('#jOk').click());
    await seq(p, 'approved', 16, 80);
    return b.close();
  }
  // ONLY=types: 퀴즈·사진 미션을 하는 화면 (미션 종류 장면용)
  if (process.env.ONLY === 'types') {
    p = await page();
    const near = async m => {
      await p.evaluate(m => document.querySelector(`.item[data-m="${m}"]`).click(), m); await p.waitForTimeout(600);
      await p.evaluate(() => document.querySelector('#simGo')?.click()); await p.waitForTimeout(3000);
      await p.evaluate(() => document.querySelector('#simGo')?.remove()); // 테스트용 단추는 영상에서 뺀다
    };
    // 퀴즈: 문제 → 정답 치기 → 정답이에요!
    await near('m2');
    await seq(p, 'quiz', 1);
    await p.tap('#qAns');
    const ans = '이성계';
    for (let i = 0; i < ans.length; i++) { await p.evaluate(v => { document.querySelector('#qAns').value = v; }, ans.slice(0, i + 1)); await seq(p, 'quiztype' + i, 1); }
    await p.evaluate(() => document.querySelector('#qForm button').click());
    await seq(p, 'quizok', 10, 80);
    // 사진: 사진 미션 창 → 사진 올리기 → 진행자 확인 기다림
    await near('m3');
    await seq(p, 'photo', 1);
    await p.setInputFiles('#photoIn', path.join(__dirname, '..', 'assets', 'icon-512.png'));
    await seq(p, 'photook', 10, 80);
    // 현장 미션: 걸어서 도착 → 해냈어요 → 진행자가 인정
    await near('m5');
    await seq(p, 'task', 1);
    await p.evaluate(() => document.querySelector('#taskBtn').click());
    await seq(p, 'taskdone', 12, 80);
    await p.evaluate(() => { document.querySelector('#sheet').hidden = true; document.querySelector('.tabs button[data-tab=host]').click(); }); await p.waitForTimeout(600);
    await seq(p, 'judgelist', 1);
    await p.evaluate(() => [...document.querySelectorAll('[data-judge]')].find(n => n.textContent.includes('청연루'))?.click()); await p.waitForTimeout(600);
    await seq(p, 'judge', 1);
    await p.evaluate(() => document.querySelector('#jOk').click());
    await seq(p, 'approved', 16, 80);
    // 점수가 쌓인 뒤: 끝나기 5분 전 → 게임 끝 → 결과
    await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).saveMeta('DEMO', { endAt: Date.now() + 299000 })); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelector('.tabs button[data-tab=missions]').click()); await p.tap('#grip'); await p.waitForTimeout(500);
    await seq(p, 'timer', 1);
    await p.evaluate(() => document.querySelector('.tabs button[data-tab=host]').click()); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelector('#hEnd').click(); document.querySelector('#hEnd')?.click(); });
    await p.waitForTimeout(1300);
    await seq(p, 'result', 24, 60);
    return b.close();
  }
  // ONLY=map3d: 지도 모드 + 3D 건물 위로 팀원들이 돌아다닌다
  if (process.env.ONLY === 'map3d') {
    p = await page();
    await p.tap('#grip');
    await p.tap('#fabLayer'); await p.waitForTimeout(9000);
    await p.mouse.click(250, 260); await p.waitForTimeout(1500);
    await seq(p, 'mapthree', 36, 60, async i => { if (i % 12 === 0) await p.mouse.click(180 + (i % 24) * 3, 250); });
    return b.close();
  }
  // ONLY=tag: 술래잡기 미션 창 (술래가 팀마다 한 명, 내가 술래)
  if (process.env.ONLY === 'tag') {
    p = await page();
    await p.evaluate(() => document.querySelector('.item[data-m="mtag"]').click()); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelector('#simGo')?.remove());
    await seq(p, 'tag', 12, 80);
    return b.close();
  }
  // ONLY=beacons: 넓게 내려다본 지도에 미션 빛기둥들
  if (process.env.ONLY === 'beacons') {
    p = await page();
    await p.tap('#grip');
    await p.tap('#fabAll'); await p.waitForTimeout(2500);
    await seq(p, 'beacons', 24, 120);
    return b.close();
  }
  // ONLY=bus 처럼 주면 버스부터만 다시 찍는다
  if (process.env.ONLY !== 'bus') {
  // 1) 3D 지도: 내가 걸어가고 팀원들이 돌아다닌다
  p = await page();
  await p.tap('#grip');
  await p.mouse.click(250, 260); await p.waitForTimeout(1500);
  await seq(p, 'map', 40, 40, async i => { if (i % 12 === 0) await p.mouse.click(180 + (i % 24) * 3, 250); });
  // 2) 미션: 경기전 홍살문으로 가서 완료 → 알림·점수판
  await p.tap('#grip');
  await p.evaluate(() => document.querySelector('.item[data-m="m0"]').click()); await p.waitForTimeout(800);
  await p.evaluate(() => { const g = document.querySelector('#simGo'); if (g) g.style.visibility = 'hidden'; });
  await seq(p, 'msheet', 1);
  await p.evaluate(() => document.querySelector('#simGo')?.click());
  await seq(p, 'mdone', 30, 80);
  await p.context().close();
  if (process.env.ONLY === 'map') return b.close();
  }

  // 3) 단체 버스 (45명) — 사람이 많아 한 장에 몇 초씩 걸리니, 가짜 참가자를 세워 두고 1초씩만 움직여 찍는다
  // ONLY=basic: 버스·자동차 없이 지도·미션·남은 시간·결과만
  if (process.env.ONLY === 'basic') {
    p = await page();
    await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).saveMeta('DEMO', { endAt: Date.now() + 299000 })); await p.waitForTimeout(2500);
    await p.tap('#grip'); await p.waitForTimeout(500);
    await seq(p, 'timer', 1);
    await p.evaluate(() => { document.querySelector('.tabs button[data-tab=host]').click(); });
    await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelector('#hEnd').click(); document.querySelector('#hEnd')?.click(); });
    await p.waitForTimeout(1300);
    await seq(p, 'result', 24, 60);
    return b.close();
  }
  p = await page('&crowd');
  await p.tap('#grip'); await go(p, '은혜'); await p.waitForTimeout(34000);
  await p.mouse.move(200, 300); await p.mouse.wheel(0, 250); await p.waitForTimeout(2000);
  const step = async () => { await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).pause(false)); await p.waitForTimeout(1000); await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).pause(true)); await p.waitForTimeout(700); };
  await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).pause(true));
  await seq(p, 'bus', 32, 0, step);
  // 4) 자동차
  await go(p, '바람'); await step(); await step();
  await seq(p, 'car', 24, 0, step);
  await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).pause(false));
  // 5) 끝나는 시간 5분 전 → 6) 결과
  await p.evaluate(async () => (await import('/demo.js?v=__BUILD__')).saveMeta('DEMO', { endAt: Date.now() + 299000 })); await p.waitForTimeout(2500);
  await seq(p, 'timer', 1);
  await p.tap('#grip'); await p.tap('.tabs button[data-tab=host]');
  await p.evaluate(() => { document.querySelector('#hEnd').click(); document.querySelector('#hEnd')?.click(); });
  await p.waitForTimeout(1300);
  await seq(p, 'result', 24, 60);
  await b.close();
})();
