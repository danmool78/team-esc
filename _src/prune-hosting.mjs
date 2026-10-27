// 호스팅 저장 공간 정리: 무료 요금제는 호스팅 저장 공간이 10GB라, 배포마다 쌓인 예전 판이 차면 배포가 429로 막힌다.
// live 채널은 최근 KEEP개만 남기게 정하고(앞으로 저절로 지워짐), 지금 어느 채널에도 걸려 있지 않은 예전 판을 지운다.
// 배포 워크플로가 호스팅 올리기 전에 돌린다. 쓰는 법: SA='서비스 계정 JSON' node _src/prune-hosting.mjs [--dry]
import admin from 'firebase-admin';

const KEEP = 5, SITE = 'https://firebasehosting.googleapis.com/v1beta1/sites/team-esc';
const dry = process.argv.includes('--dry');
const { access_token } = await admin.credential.cert(JSON.parse(process.env.SA)).getAccessToken();
const api = async (path, opt = {}) => {
  const r = await fetch(SITE + path, { ...opt, headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error(`${opt.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
  return r.json();
};
const all = async (path, key) => { const out = []; let tok = ''; do { const j = await api(`${path}${path.includes('?') ? '&' : '?'}pageSize=100${tok ? '&pageToken=' + tok : ''}`); out.push(...(j[key] || [])); tok = j.nextPageToken; } while (tok); return out; };

if (!dry) await api('/channels/live?updateMask=retainedReleaseCount', { method: 'PATCH', body: JSON.stringify({ retainedReleaseCount: KEEP }) });
// 남길 판: 채널마다 지금 걸린 판 + live의 최근 KEEP개(되돌리기용)
const keep = new Set();
for (const c of await all('/channels', 'channels')) if (c.release?.version?.name) keep.add(c.release.version.name);
(await api(`/channels/live/releases?pageSize=${KEEP}`)).releases?.forEach(r => r.version?.name && keep.add(r.version.name));
const vs = await all('/versions', 'versions');
// CREATED는 다른 배포가 올리는 중일 수 있어 1시간 지난 것만
const gone = vs.filter(v => !keep.has(v.name) && (['FINALIZED', 'ABANDONED', 'EXPIRED'].includes(v.status) || (v.status === 'CREATED' && Date.now() - Date.parse(v.createTime) > 36e5)));
const mb = list => (list.reduce((a, v) => a + +(v.versionBytes || 0), 0) / 1e6).toFixed(0);
console.log(`판 ${vs.length}개 (${mb(vs)}MB) — 남김 ${keep.size}개, ${dry ? '지울 대상' : '지움'} ${gone.length}개 (${mb(gone)}MB)`);
if (!dry) for (const v of gone) await api('/versions/' + v.name.split('/').pop(), { method: 'DELETE' }).catch(e => console.log('못 지움', v.name, e.message));
process.exit(0);
