/* Firebase: 로그인(이메일·구글)과 실시간 데이터베이스.
   자료 구조 (database.rules.json과 같게)
     users/{uid}                 { name, gender, avatar }
     games/{code}/meta           { name, host, center{lat,lng}, radius, layer, status: ready|live|ended, created }
     games/{code}/teams/{tid}    { name, color }
     games/{code}/members/{uid}  { name, avatar, team, online, joined }
     games/{code}/pos/{uid}      { lat, lng, acc, t }      — 걸을 때마다 몇 초에 한 번
     games/{code}/missions/{mid} { title, desc, type: arrive|quiz|photo|task, lat, lng, r, q, ah, pts, order, open }
     games/{code}/done/{tid}/{mid} { by, name, t, pts, status: ok|wait }
     games/{code}/photos/{tid}_{mid}  사진(작게 줄인 JPEG data URL) — done을 가볍게 두려고 따로
     games/{code}/feed/{push}    { t, team, text } */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, remove, push, onValue, onChildAdded, onDisconnect, serverTimestamp, query, limitToLast,
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
    await set(G(code, 'members/' + uid()), { name: me.name, avatar: me.avatar, team: '', joined: serverTimestamp() });
    await set(G(code, 'teams'), teams);
    return code;
  }
  throw new Error('게임 코드를 만들지 못했어요. 다시 해 주세요.');
}
export const gameMeta = async code => (await get(G(code, 'meta'))).val();
export async function joinGame(code, me) {
  const r = G(code, 'members/' + uid());
  const cur = (await get(r)).val();
  await set(r, { name: me.name, avatar: me.avatar, team: cur?.team || '', joined: cur?.joined || serverTimestamp() });
}
export const setTeam = (code, who, tid) => set(G(code, `members/${who}/team`), tid);
// 접속 표시: 연결이 끊기면 서버가 알아서 false로 바꾼다
export function presence(code) {
  const r = G(code, `members/${uid()}/online`);
  set(r, true);
  onDisconnect(r).set(false);
}

/* ---------- 실시간 구독 ---------- */
// h: { meta, teams, members, pos, missions, done, feed(item, isNew) } — 각 값이 바뀔 때마다 전체를 넘긴다
export function watch(code, h) {
  const offs = ['meta', 'teams', 'members', 'pos', 'missions', 'done'].map(k => onValue(G(code, k), s => h[k]?.(s.val() || {})));
  let primed = false;
  offs.push(onChildAdded(query(G(code, 'feed'), limitToLast(40)), s => h.feed?.({ id: s.key, ...s.val() }, primed)));
  get(G(code, 'feed')).then(() => setTimeout(() => (primed = true), 300));
  return () => offs.forEach(f => f());
}

/* ---------- 쓰기 ---------- */
export const writePos = (code, p) => set(G(code, 'pos/' + uid()), { ...p, t: serverTimestamp() });
export const clearPos = code => remove(G(code, 'pos/' + uid()));
export const setStatus = (code, status) => set(G(code, 'meta/status'), status);
export const saveMeta = (code, patch) => update(G(code, 'meta'), patch);
export const saveTeams = (code, teams) => set(G(code, 'teams'), teams);
export const addMission = (code, m) => push(G(code, 'missions'), m);
export const saveMission = (code, id, m) => set(G(code, 'missions/' + id), m);
export const delMission = (code, id) => remove(G(code, 'missions/' + id));
export const complete = (code, tid, mid, d) => set(G(code, `done/${tid}/${mid}`), { ...d, by: uid(), t: serverTimestamp() });
export const judge = (code, tid, mid, ok) => (ok ? set(G(code, `done/${tid}/${mid}/status`), 'ok') : remove(G(code, `done/${tid}/${mid}`)));
export const savePhoto = (code, tid, mid, url) => set(G(code, `photos/${tid}_${mid}`), url);
export const getPhoto = async (code, tid, mid) => (await get(G(code, `photos/${tid}_${mid}`))).val();
export const delPhoto = (code, tid, mid) => remove(G(code, `photos/${tid}_${mid}`));
export const say = (code, team, text) => push(G(code, 'feed'), { team: team || '', text, t: serverTimestamp() });
export const me = () => uid();
