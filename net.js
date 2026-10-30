/* Firebase: 로그인(이메일·구글)과 실시간 데이터베이스.
   자료 구조 (database.rules.json과 같게)
     users/{uid}                 { name, gender, avatar }
     games/{code}/meta           { name, host, hosts{uid:true}, mode: team|solo, endAt(끝나는 시각 ms), center{lat,lng}, radius, layer, status: ready|live|ended, endedAt(끝낸 시각), created }
                                 끝나고 7일 지난 게임은 통째로 지운다 (.github/workflows/cleanup.yml)
                                 host = 게임을 만든 진행자(바꿀 수 없음), hosts = 그가 회원 중에서 더한 진행자(host·hosts 말고는 똑같이 진행)
     games/{code}/teams/{tid}    { name, color }
     games/{code}/members/{uid}  { name, avatar, team, online, joined }
     games/{code}/pos/{uid}      { lat, lng, acc, t, sim }  — 걸을 때마다 몇 초에 한 번 (sim: 테스트 모드)
     games/{code}/missions/{mid} { title, desc, type: arrive|quiz|photo|task|voice, each, lat, lng, r, q, ah, pts, order, open }
                                 each = 개인 미션 (팀원 각자 해서 점수를 팀에 보탠다). 개인전(mode solo)이면 모든 미션이 개인 미션
                                 type tag = 술래잡기: it{팀: 술래 uid} — 다른 팀 술래 사진을 올리면 done에 wait(caught: 찍힌 술래), 진행자가 먼저 인정한 팀이 승리
     games/{code}/done/{tid}/{mid} { by, name, t, pts, status: ok|wait }
     games/{code}/pdone/{uid}/{mid} { name, team, t, pts, status: ok|wait } — 개인 미션·개인전의 완료
     games/{code}/photos/{tid}_{mid}  사진·음성 녹음 (개인 완료는 u_{uid}_{mid})(작게 줄인 JPEG / 녹음 audio data URL) — done을 가볍게 두려고 따로
     games/{code}/feed/{push}    { t, team, text }
     games/{code}/guide          { name, mode, endAt, teams[{name,color}], missions[{title,type,each,pts,desc,r,lat,lng,open}], at }
                                 미션 안내 페이지(guide.html?g=코드)용 요약 — 진행자 화면이 미션이 바뀔 때마다 써 둔다. 링크만 있으면 로그인 없이 읽는다(퀴즈 문제·정답은 뺀다)
     games/{code}/banned/{uid}   { name, t } — 진행자가 내보낸 사람. 같은 코드로 다시 들어오지 못한다(본인은 자기 것만 읽어 내보내진 걸 안다)
     games/{code}/albumIdx/{key} { mid, title, who, color, t } — 사진 모음 페이지(album.html?g=코드): 진행자가 인정한 사진(사진·술래잡기)만
     games/{code}/album/{key}    그 사진(JPEG data URL) — key는 photos와 같다. 목록을 먼저 받고 사진은 하나씩 받게 따로 둔다. 둘 다 누구나 읽기 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, remove, push, onValue, onChildAdded, onChildRemoved, onDisconnect, serverTimestamp, query, limitToLast,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js';

const app = initializeApp({
  apiKey: 'AIzaSyCIGAZddK60hJnuaDnqKs7j528ilYJNER8',
  authDomain: 'team-esc.firebaseapp.com',
  databaseURL: 'https://team-esc-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'team-esc',
  storageBucket: 'team-esc.firebasestorage.app',
  messagingSenderId: '803728738604',
  appId: '1:803728738604:web:68e0bcfbc23741b7c3c489',
});
const auth = getAuth(app);
const db = getDatabase(app);
const G = (code, path = '') => ref(db, `games/${code}${path ? '/' + path : ''}`);

/* ---------- 로그인 ---------- */
export const onUser = cb => onAuthStateChanged(auth, u => cb(u && { uid: u.uid, email: u.email, name: u.displayName }));
export async function signUp(email, pw, name) {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  if (name) await updateProfile(c.user, { displayName: name });
}
export const signIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const google = () => signInWithPopup(auth, new GoogleAuthProvider());
// 로그인 유지: 켜면 브라우저를 닫아도 그대로, 끄면 창을 닫을 때 로그아웃
export const setRemember = on => setPersistence(auth, on ? browserLocalPersistence : browserSessionPersistence);
export const resetPw = email => sendPasswordResetEmail(auth, email);
export const signOut = () => fbSignOut(auth);
const uid = () => auth.currentUser?.uid;

/* ---------- 프로필 ---------- */
export const getProfile = async () => (await get(ref(db, `users/${uid()}`))).val();
export const saveProfile = p => set(ref(db, `users/${uid()}`), p);

/* ---------- 게임 만들기·들어가기 ---------- */
// 헷갈리기 쉬운 글자(0·O, 1·I)는 뺀다
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function createGame(meta, teams, me) {
  for (let n = 0; n < 6; n++) {
    const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    if ((await get(G(code, 'meta'))).exists()) continue;
    await set(G(code, 'meta'), { ...meta, host: uid(), status: 'ready', created: serverTimestamp() });
    await set(G(code, 'members/' + uid()), { name: me.name, avatar: me.avatar, robe: me.robe || null, team: '', joined: serverTimestamp() });
    await set(G(code, 'teams'), teams);
    return code;
  }
  throw new Error('게임 코드를 만들지 못했어요. 다시 해 주세요.');
}
export const gameMeta = async code => (await get(G(code, 'meta'))).val();
export async function joinGame(code, me) {
  const r = G(code, 'members/' + uid());
  const cur = (await get(r)).val();
  await set(r, { name: me.name, avatar: me.avatar, robe: me.robe || null, team: cur?.team || '', joined: cur?.joined || serverTimestamp() });
}
export const setTeam = (code, who, tid) => set(G(code, `members/${who}/team`), tid);
// 접속 표시: 연결이 끊기면 서버가 알아서 false로 바꾼다
export function presence(code) {
  const r = G(code, `members/${uid()}/online`);
  set(r, true);
  onDisconnect(r).set(false);
}

/* ---------- 실시간 구독 ---------- */
// h: { meta, teams, members, pos, missions, done, pdone, feed(item, isNew) } — 각 값이 바뀔 때마다 전체를 넘긴다
export function watch(code, h) {
  const offs = ['meta', 'teams', 'members', 'pos', 'missions', 'done', 'pdone'].map(k => onValue(G(code, k), s => h[k]?.(s.val() || {})));
  let primed = false;
  offs.push(onChildAdded(query(G(code, 'feed'), limitToLast(40)), s => h.feed?.({ id: s.key, ...s.val() }, primed)));
  offs.push(onChildRemoved(query(G(code, 'feed'), limitToLast(40)), s => h.feedGone?.(s.key))); // 진행자가 소식을 비우면
  // 내보내졌는지: 내 회원 자리가 지워지면 members를 읽을 권한도 사라지므로 따로 본다
  offs.push(onValue(G(code, 'banned/' + uid()), s => s.exists() && h.kicked?.(), () => {}));
  get(G(code, 'feed')).then(() => setTimeout(() => (primed = true), 300));
  return () => offs.forEach(f => f());
}

/* ---------- 쓰기 ---------- */
export const writePos = (code, p) => set(G(code, 'pos/' + uid()), { ...p, t: serverTimestamp() });
export const clearPos = code => remove(G(code, 'pos/' + uid()));
// 게임 지우기: 게임을 만든 진행자만 (규칙이 게임 전체를 지울 때만 허락한다). 내 접속 표시가 끊길 때 되살아나지 않게 먼저 거둔다
export async function deleteGame(code) {
  await onDisconnect(G(code, `members/${uid()}/online`)).cancel().catch(() => {});
  await remove(G(code));
}
// 진행자 더하기·빼기: 게임을 만든 진행자만 (규칙이 막는다)
// 내보내기 (진행자): 회원·위치를 지우고 내보낸 명단에. 해낸 미션 기록은 남긴다(팀 점수)
export const kick = (code, who, name) => update(G(code), { [`members/${who}`]: null, [`pos/${who}`]: null, [`banned/${who}`]: { name: name || '', t: serverTimestamp() } });
export const unban = (code, who) => remove(G(code, 'banned/' + who));
export const bannedList = async code => (await get(G(code, 'banned'))).val() || {};
export const amBanned = async code => (await get(G(code, 'banned/' + uid())).catch(() => null))?.exists() || false;
// 내보내져 나갈 때: 접속이 끊길 때 서버가 online=false를 써서 회원 자리를 되살리지 않게 미리 거둔다
export const dropPresence = code => onDisconnect(G(code, `members/${uid()}/online`)).cancel().catch(() => {});
export const setCohost = (code, who, on) => set(G(code, `meta/hosts/${who}`), on ? true : null);
// 끝낸 시각(endedAt)을 함께 적는다 — 7일 지난 끝난 게임은 GitHub Actions가 매일 지운다(_src/cleanup.mjs)
export const setStatus = (code, status) => update(G(code, 'meta'), { status, endedAt: status === 'ended' ? serverTimestamp() : null });
export const saveMeta = (code, patch) => update(G(code, 'meta'), patch);
export const saveTeams = (code, teams) => set(G(code, 'teams'), teams);
export const addMission = (code, m) => push(G(code, 'missions'), m);
export const saveMission = (code, id, m) => set(G(code, 'missions/' + id), m);
export const delMission = (code, id) => remove(G(code, 'missions/' + id));
export const complete = (code, tid, mid, d) => set(G(code, `done/${tid}/${mid}`), { ...d, by: uid(), t: serverTimestamp() });
// 개인 완료 (개인 미션·개인전)
export const completeMine = (code, mid, d) => set(G(code, `pdone/${uid()}/${mid}`), { ...d, t: serverTimestamp() });
export const judgeMine = (code, who, mid, ok) => (ok ? set(G(code, `pdone/${who}/${mid}/status`), 'ok') : remove(G(code, `pdone/${who}/${mid}`)));
export const judge = (code, tid, mid, ok) => (ok ? set(G(code, `done/${tid}/${mid}/status`), 'ok') : remove(G(code, `done/${tid}/${mid}`)));
export const savePhoto = (code, tid, mid, url) => set(G(code, `photos/${tid}_${mid}`), url);
export const getPhoto = async (code, tid, mid) => (await get(G(code, `photos/${tid}_${mid}`))).val();
export const delPhoto = (code, tid, mid) => remove(G(code, `photos/${tid}_${mid}`));
export const publishGuide = (code, g) => set(G(code, 'guide'), g);
export const readGuide = async code => (await get(G(code, 'guide'))).val();
export const albumAdd = (code, key, idx, url) => update(G(code), { [`album/${key}`]: url, [`albumIdx/${key}`]: idx });
export const albumDel = (code, key) => update(G(code), { [`album/${key}`]: null, [`albumIdx/${key}`]: null });
export const albumIdx = async code => (await get(G(code, 'albumIdx'))).val() || {};
export const albumPhoto = async (code, key) => (await get(G(code, 'album/' + key))).val();
// 게임 리셋 (진행자): 점수·완료·사진·녹음·사진 모음·소식 같은 데이터만 지우고 '시작 전'으로. 미션·팀·참가자(팀 배정)·설정은 남긴다.
// 끝나는 시간은 이미 지났을 때만 지운다(clearEnd). 깜짝 미션은 시계를 비워 다시 시작할 때 걸리게(armTimed)
export const resetGame = (code, missionIds, clearEnd) => update(G(code), {
  feed: null, done: null, pdone: null, photos: null, album: null, albumIdx: null,
  'meta/status': 'ready', 'meta/endedAt': null, ...(clearEnd ? { 'meta/endAt': null } : {}),
  ...Object.fromEntries(missionIds.flatMap(id => [[`missions/${id}/until`, null], [`missions/${id}/openAt`, null]])),
});
export const say = (code, team, text) => push(G(code, 'feed'), { team: team || '', text, t: serverTimestamp() });
export const me = () => uid();
