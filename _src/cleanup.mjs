// 끝난 게임 자동 정리: 끝나고 7일 지난 게임(games/{코드})을 통째로 지운다. GitHub Actions가 매일 돌린다(.github/workflows/cleanup.yml).
// 서버 함수(Cloud Functions)는 유료 요금제가 필요해서, 배포에 쓰는 서비스 계정으로 밖에서 지운다.
// 끝낸 시각: meta.endedAt(끝낼 때 앱이 적음). 없는 예전 게임은 처음 돌 때 지금으로 적는다.
// 쓰는 법: SA='서비스 계정 JSON' node _src/cleanup.mjs [--dry]
import admin from 'firebase-admin';

const DAYS = 7, DB = 'https://team-esc-default-rtdb.asia-southeast1.firebasedatabase.app';
const dry = process.argv.includes('--dry');
const sa = JSON.parse(process.env.SA);
const cred = admin.credential.cert(sa);
admin.initializeApp({ credential: cred, databaseURL: DB });
const db = admin.database();

// 게임 목록은 키만 받는다 (shallow — 사진까지 통째로 내려받지 않게)
const { access_token } = await cred.getAccessToken();
const codes = Object.keys((await (await fetch(`${DB}/games.json?shallow=true&access_token=${access_token}`)).json()) || {});
const cut = Date.now() - DAYS * 864e5;
let gone = 0;
for (const code of codes) {
  const meta = (await db.ref(`games/${code}/meta`).get()).val();
  if (!meta || meta.status !== 'ended') continue;
  // 끝낸 시각이 없는 예전 게임은 지금 끝난 것으로 적어 두고 7일을 준다 (만든 날로 재면 막 끝난 게임이 지워진다)
  if (!meta.endedAt) { console.log(`${dry ? '(적을 것)' : '적음'} ${code} endedAt = 지금`); if (!dry) await db.ref(`games/${code}/meta/endedAt`).set(Date.now()); continue; }
  const at = meta.endedAt;
  if (at > cut) continue;
  console.log(`${dry ? '(지울 것)' : '지움'} ${code} '${meta.name || ''}' 끝남 ${new Date(at).toISOString()}`);
  if (!dry) await db.ref(`games/${code}`).remove();
  gone++;
}
console.log(`게임 ${codes.length}개 중 ${gone}개 ${dry ? '지울 대상' : '지움'} (끝나고 ${DAYS}일 지난 것)`);
process.exit(0);
