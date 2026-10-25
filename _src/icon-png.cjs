// 아이콘 PNG 만들기: node _src/icon-png.cjs (저장소 맨 위에서, 서버 없이 파일로 그린다)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch();
  const jobs = [['assets/icon.svg', 'assets/icon-512.png', 512], ['assets/icon.svg', 'assets/icon-192.png', 192], ['assets/icon.svg', 'assets/apple-touch-icon.png', 180],
    ['_src/icon-maskable.svg', 'assets/icon-maskable-512.png', 512], ['_src/icon-maskable.svg', 'assets/icon-maskable-192.png', 192]];
  for (const [src, out, n] of jobs) {
    const pg = await b.newPage({ viewport: { width: n, height: n } });
    await pg.setContent(`<style>*{margin:0}</style><img src="data:image/svg+xml;base64,${fs.readFileSync(src).toString('base64')}" width="${n}" height="${n}">`);
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: out });
    await pg.close();
  }
  await b.close();
})();
