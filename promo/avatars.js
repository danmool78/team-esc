// 미니미 인형 그림 몇 개를 앱에서 받아 둔다 (사람 탭의 작은 그림 = 앱이 그린 인형)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://localhost:8765/?demo'); await p.waitForTimeout(5000);
  await p.tap?.('.tabs button[data-tab=people]').catch(() => {}); await p.click('.tabs button[data-tab=people]'); await p.waitForTimeout(1500);
  // 큰 그림이 필요해서 앱의 인형 그리기를 직접 크게 부른다
  const srcs = await p.evaluate(async () => { const W = await import('/world.js'); const C = ['#3d7be0', '#e0503d', '#3dae6a']; return ['man', 'woman', 'shepherd', 'woman2', 'peter', 'martha'].map((t, i) => W.avatarThumb(t, C[i % 3], 'p' + i)); }); // 앱과 같은 팀 색 옷
  srcs.forEach((s, i) => fs.writeFileSync(path.join(__dirname, 'cap', `av-${i}.png`), Buffer.from(s.split(',')[1], 'base64')));
  console.log('avatars', srcs.length); await b.close();
})();
