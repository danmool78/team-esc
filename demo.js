/* 데모(?demo): net.js와 같은 함수를 메모리 안에서 흉내 낸다.
   로그인 없이 바로 들어가고, 가짜 참가자들이 미션 지점을 찾아 걸어 다니며 도착 미션을 수행한다.
   3D 화면·점수판·소식을 Firebase 없이 확인하는 용도 */
import { JEONJU, makeFrame, dist } from './geo.js';

const ME = 'me';
const S = { users: {}, games: {} };
const subs = new Map(); // code → [h]
const now = () => Date.now();
const fire = code => (subs.get(code) || []).forEach(h => { const g = S.games[code]; ['meta', 'teams', 'members', 'pos', 'missions', 'done', 'pdone'].forEach(k => h[k]?.(structuredClone(g[k] || {}))); });
let userCb = null;

export const onUser = cb => { userCb = cb; setTimeout(() => cb({ uid: ME, email: 'demo@example.com', name: '데모' }), 0); };
export const signUp = async () => {};
export const signIn = async () => {};
export const google = async () => {};
export const setRemember = async () => {};
export const resetPw = async () => {};
export const signOut = async () => { userCb?.(null); };
export const getProfile = async () => S.users[ME] || null;
export const saveProfile = async p => { S.users[ME] = p; };

export async function createGame(meta, teams, me) {
  const code = 'DEMO' + (Object.keys(S.games).length + 1);
  S.games[code] = { meta: { ...meta, host: ME, status: 'ready', created: now() }, teams, members: { [ME]: { name: me.name, avatar: me.avatar, robe: me.robe, team: '', online: true } }, pos: {}, missions: {}, done: {}, pdone: {}, feed: [], photos: {} };
  return code;
}
export const gameMeta = async code => S.games[code]?.meta || (code === 'DEMO' ? (seed(), S.games.DEMO.meta) : null);
export async function joinGame(code, me) { const g = S.games[code]; g.members[ME] = { ...g.members[ME], name: me.name, avatar: me.avatar, robe: me.robe, online: true, team: g.members[ME]?.team || 't1' }; fire(code); }
export const setTeam = async (code, who, tid) => { S.games[code].members[who].team = tid; fire(code); };
export const presence = () => {};

export function watch(code, h) {
  if (!subs.has(code)) subs.set(code, []);
  subs.get(code).push(h);
  fire(code);
  S.games[code].feed.forEach(f => h.feed?.(f, false));
  return () => subs.set(code, subs.get(code).filter(x => x !== h));
}
const feed = (code, team, text) => { const f = { id: 'f' + now() + Math.random(), team, text, t: now() }; S.games[code].feed.push(f); (subs.get(code) || []).forEach(h => h.feed?.(f, true)); };

export const writePos = async (code, p) => { S.games[code].pos[ME] = { ...p, t: now() }; fire(code); };
export const clearPos = async code => { delete S.games[code].pos[ME]; fire(code); };
export const setCohost = async (code, who, on) => { const m = S.games[code].meta; m.hosts ||= {}; if (on) m.hosts[who] = true; else delete m.hosts[who]; fire(code); };
export const setStatus = async (code, s) => { S.games[code].meta.status = s; fire(code); };
export const saveMeta = async (code, p) => { Object.assign(S.games[code].meta, p); fire(code); };
export const saveTeams = async (code, t) => { S.games[code].teams = t; fire(code); };
export const addMission = async (code, m) => { S.games[code].missions['m' + now()] = m; fire(code); };
export const saveMission = async (code, id, m) => { S.games[code].missions[id] = m; fire(code); };
export const delMission = async (code, id) => { delete S.games[code].missions[id]; fire(code); };
export const complete = async (code, tid, mid, d) => { const g = S.games[code]; (g.done[tid] ||= {})[mid] = { ...d, by: ME, t: now() }; fire(code); };
export const completeMine = async (code, mid, d) => { const g = S.games[code]; (g.pdone[ME] ||= {})[mid] = { ...d, t: now() }; fire(code); };
export const judgeMine = async (code, who, mid, ok) => { const g = S.games[code]; if (ok) g.pdone[who][mid].status = 'ok'; else delete g.pdone[who][mid]; fire(code); };
export const judge = async (code, tid, mid, ok) => { const g = S.games[code]; if (ok) g.done[tid][mid].status = 'ok'; else delete g.done[tid][mid]; fire(code); };
export const savePhoto = async (code, tid, mid, url) => { S.games[code].photos[tid + '_' + mid] = url; };
export const getPhoto = async (code, tid, mid) => S.games[code].photos[tid + '_' + mid];
export const delPhoto = async (code, tid, mid) => { delete S.games[code].photos[tid + '_' + mid]; };
export const say = async (code, team, text) => feed(code, team, text);
export const me = () => ME;
// 홍보 영상 촬영용: 가짜 참가자들을 잠깐 세운다 (무거운 장면을 1초씩 찍으려고 — promo/capture.js)
let paused = false;
export const pause = v => (paused = !!v);

/* ---------- 미리 차려 둔 게임 'DEMO': 한옥마을 둘레의 미션과 가짜 참가자 ---------- */
const BOTS = [
  ['b1', '하늘', 'man', 't1'], ['b2', '소망', 'woman', 't1'], ['b3', '믿음', 'peter', 't1'],
  ['b4', '사랑', 'woman2', 't2'], ['b5', '온유', 'traveler', 't2'], ['b6', '기쁨', 'martha', 't2'], ['b7', '화평', 'shepherd', 't3'],
];
// 탈것 확인용: 함께 걷는 단체 5명(20초 뒤 오픈버스)과 차로 달리는 1명
const TOUR = [['c1', '은혜', 'man'], ['c2', '진리', 'woman'], ['c3', '생명', 'shepherd'], ['c4', '빛', 'woman2'], ['c5', '평안', 'elder']];
// ?demo&crowd: 단체를 45명으로 (큰 버스 확인용)
if (new URLSearchParams(location.search).has('crowd')) for (let i = 6; i <= 45; i++) TOUR.push(['c' + i, '단체' + i, ['man', 'woman', 'shepherd', 'woman2', 'elder', 'traveler'][i % 6]]);
const DRIVER = ['d1', '바람', 'official', 't2'];
function seed() {
  if (S.games.DEMO) return;
  const F = makeFrame(JEONJU);
  const at = (x, z) => F.toLL(x, z);
  // 실제 자리 (OpenStreetMap Nominatim으로 찾은 좌표, 최명희문학관·홍살문은 지도에서 어림)
  const M = [
    ['경기전 홍살문', 'arrive', 35.8153, 127.1506], ['전동성당 앞', 'arrive', 35.81333, 127.14946], ['오목대 정자', 'quiz', 35.81404, 127.15415, '오목대에서 잔치를 연 사람은? (힌트: 조선을 세움)', '이성계'],
    ['향교 은행나무', 'photo', 35.81258, 127.15715], ['개인: 한옥마을 정문 찾기', 'arrive', 35.8162, 127.1517, null, null, true], ['남천교 청연루', 'task', 35.81079, 127.15328], ['최명희문학관', 'arrive', 35.8152, 127.1527], ['자만벽화마을', 'quiz', 35.81414, 127.15716, '벽화마을 이름 두 글자', '자만'],
  ];
  const missions = {};
  M.forEach(([title, type, lat, lng, q, a, each], i) => { missions['m' + i] = { title, type, lat, lng, r: 25, pts: type === 'arrive' ? 10 : 20, order: i, open: true, desc: '데모 미션', ...(q ? { q, ans: a } : {}), ...(each ? { each, pts: 5 } : {}) }; });
  // 술래잡기: 한옥마을 가운데 400m 안에서, 팀마다 술래 (청팀은 나)
  missions.mtag = { title: '술래잡기: 한옥마을 한바퀴', type: 'tag', lat: JEONJU.lat, lng: JEONJU.lng, r: 400, pts: 30, order: 99, open: true, desc: '데모 술래잡기', it: { t1: ME, t2: 'b4', t3: 'b7' }, catchR: 6 };
  const members = { [ME]: { name: '데모', avatar: 'disciple', team: 't1', online: true } };
  const pos = { [ME]: { ...at(0, 0), acc: 5, t: now() } };
  BOTS.forEach(([id, name, avatar, team], i) => { members[id] = { name, avatar, team, online: true }; pos[id] = { ...at(Math.sin(i) * 200, Math.cos(i) * 200), acc: 6, t: now() }; });
  TOUR.forEach(([id, name, avatar]) => { members[id] = { name, avatar, team: 't3', online: true }; });
  members[DRIVER[0]] = { name: DRIVER[1], avatar: DRIVER[2], team: DRIVER[3], online: true };
  // 단체는 지름 360m 원을 걸음 빠르기(1.4m/s)로 줄지어 돌고, 차는 지름 700m 원을 시속 40km로 돈다
  let tourA = 0, carA = 0;
  const moveExtras = () => {
    tourA += 1.4 / 180; carA += 11 / 350;
    TOUR.forEach(([id], i) => {
      const a = tourA - (i % 12) * 0.012, side = (i % 2 ? 2 : -2) + Math.floor(i / 12) * 3;
      pos[id] = { ...at(60 + Math.cos(a) * (180 + side) + (Math.random() - 0.5), -40 + Math.sin(a) * (180 + side) + (Math.random() - 0.5)), acc: 6, t: now() };
    });
    pos[DRIVER[0]] = { ...at(Math.cos(carA) * 350, Math.sin(carA) * 350), acc: 8, t: now() };
  };
  moveExtras();
  S.games.DEMO = {
    meta: { name: '한옥마을 팀 미션 (데모)', host: ME, center: JEONJU, radius: 600, layer: 'sat', status: 'live', created: now() },
    teams: { t1: { name: '청팀', color: '#3d7be0' }, t2: { name: '홍팀', color: '#e0503d' }, t3: { name: '녹팀', color: '#3dae6a' } },
    members, pos, missions, done: {}, pdone: {}, feed: [], photos: {},
  };
  // 가짜 참가자: 아직 자기 팀이 못 한 미션을 골라 걸어간다 (초당 약 4m — 화면에서 보이게 사람보다 빠르게)
  const goals = {};
  setInterval(() => {
    const g = S.games.DEMO;
    if (g.meta.status !== 'live' || paused) return;
    moveExtras();
    BOTS.forEach(([id, name, , team]) => {
      const p = g.pos[id];
      let mid = goals[id];
      if (!mid || g.done[team]?.[mid]) {
        const left = Object.keys(g.missions).filter(k => !g.missions[k].each && g.missions[k].type !== 'tag' && !g.done[team]?.[k]); // 가짜 참가자는 팀 미션만 (술래잡기는 빼고)
        mid = goals[id] = left[Math.floor(Math.random() * left.length)];
        if (!mid) return;
      }
      const m = g.missions[mid], d = dist(p, m);
      if (d < m.r * 0.6) {
        (g.done[team] ||= {})[mid] = { by: id, name, t: now(), pts: m.pts, status: m.type === 'photo' || m.type === 'task' ? 'wait' : 'ok' };
        feed('DEMO', team, `${g.teams[team].name} ${name} — '${m.title}' ${m.type === 'photo' || m.type === 'task' ? '확인 요청' : '완료!'}`);
        goals[id] = null;
        return;
      }
      const k = Math.min(1, 4 / d);
      g.pos[id] = { lat: p.lat + (m.lat - p.lat) * k + (Math.random() - 0.5) * 4e-6, lng: p.lng + (m.lng - p.lng) * k + (Math.random() - 0.5) * 4e-6, acc: 6, t: now() };
    });
    fire('DEMO');
  }, 1000);
}
