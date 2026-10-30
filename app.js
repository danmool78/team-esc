/* 비전 퀘스트 — 팀 미션 앱.
   흐름: 로그인(구글·이메일) → 별칭·인형(처음 한 번) → 게임 코드로 들어가기 / 진행자는 새 게임 만들기 → 팀 고르기 → 3D 지도
   지도: 실제 GPS 좌표를 몇 초마다 올리고, 모두의 좌표를 받아 미니미 인형이 그 자리까지 걸어가게 한다.
   점수판: 팀마다 해낸 미션 수와 점수를 위에 늘 보이고, 바뀌는 순간 반짝인다 */
import { JEONJU, dist, fmtDist } from './geo.js';
// 3D 장면은 판 번호를 붙여 불러온다 — 폰이 예전 world.js를 들고 있으면 새 app.js가 부르는 함수가 없어 위치가 멈췄다
import * as W from './world.js?v=__BUILD__';
import { ic, iconImage, iconURL } from './icons.js';
import { SAMPLES } from './samples.js';

// 판 번호: 배포 때 GitHub Actions가 index.html과 같이 커밋 번호로 바꾼다. 홈 화면 앱이 예전 index.html을 들고 있으면
// 새 app.js가 없는 단추를 찾다 멈춰 빈 화면이 된다 — 판이 다르면 주소를 바꿔 한 번 새로 불러온다
const BUILD = '__BUILD__';
if (document.querySelector('meta[name=build]')?.content !== BUILD) {
  let tried = false;
  try { tried = sessionStorage.getItem('reload-' + BUILD); sessionStorage.setItem('reload-' + BUILD, 1); } catch {}
  if (!tried) { const u = new URL(location.href); u.searchParams.set('v', BUILD); location.replace(u); await new Promise(() => {}); }
}
const DEMO = new URLSearchParams(location.search).has('demo');
// 시험용 가짜 GPS: ?fakegps=36.3504,127.3845 — 그 좌표를 GPS가 준 것처럼 쓴다 (클라우드 컴퓨터·데스크톱에서 확인할 때)
const FAKE = (() => { const v = new URLSearchParams(location.search).get('fakegps')?.split(',').map(Number); return v?.length === 2 && v.every(isFinite) ? { lat: v[0], lng: v[1], acc: 5 } : null; })();
// 화면 크기 고정: 아이폰 사파리는 확대 금지(user-scalable=no)를 무시하므로 두 손가락 확대를 직접 막는다 (3D 지도 위의 두 손가락은 지도가 쓴다)
['gesturestart', 'gesturechange'].forEach(k => document.addEventListener(k, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !e.target.closest('#world')) e.preventDefault(); }, { passive: false });
const net = await import((DEMO ? './demo.js' : './net.js') + '?v=' + BUILD);
const $ = s => document.querySelector(s);
// 이모티콘 대신 귀여운 SVG 아이콘: data-ic가 붙은 단추 앞에 넣고, 찾기 칸에는 돋보기를 깐다
document.querySelectorAll('[data-ic]').forEach(el => el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic)));
$('#find').style.backgroundImage = iconURL('search');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

// 그 길의 미니미 중에서 성별에 맞는 평범한 옷차림만 (예수·마리아·천사·실루엣 전용 인물은 뺀다)
const OUTFITS = {
  m: ['man', 'disciple', 'peter', 'thomas', 'shepherd', 'traveler', 'levi', 'official', 'rich', 'steward', 'servant', 'john', 'elder', 'guard'],
  f: ['woman', 'woman2', 'martha', 'samaritan', 'phoenician', 'mother', 'anna'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const TEAM_PRESET = [['청팀', '#3d7be0'], ['홍팀', '#e0503d'], ['녹팀', '#3dae6a'], ['황팀', '#d9a520'], ['자팀', '#8e5bd6'], ['주팀', '#e8862e'], ['하늘팀', '#3fbfd9'], ['분홍팀', '#e06aa8'], ['백팀', '#d8d2c4'], ['흑팀', '#55504a']];
// 개인전: 사람마다 색 (uid로 늘 같은 색)
const PERSON_COLORS = ['#3d7be0', '#e0503d', '#3dae6a', '#d9a520', '#8e5bd6', '#e8862e', '#3fbfd9', '#e06aa8', '#7fae3a', '#c0763f', '#5a6fd6', '#d6455f'];
const personColor = uid => PERSON_COLORS[[...uid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PERSON_COLORS.length];
const TYPES = { arrive: ['pin', '도착'], quiz: ['quiz', '퀴즈'], photo: ['camera', '사진'], task: ['flag', '현장 미션'], voice: ['mic', '음성'], tag: ['tag', '술래잡기'] };
const tic = type => ic(TYPES[type]?.[0] || 'pin');
// 알림(팀 없는 소식)은 확성기 아이콘으로 — 예전 소식 앞의 이모티콘은 떼어 낸다
const plain = t => String(t || '').replace(/^📣\s*/u, '');
const STATUS = { ready: '시작 전', live: '진행 중', ended: '끝남' };
const STALE = 90e3; // 이만큼 좌표가 안 오면 흐리게

const screens = ['auth', 'profile', 'lobby', 'game'];
// 첫 화면이 뜨면 시작 성공 — index.html의 비상구를 닫는다
const show = id => { screens.forEach(s => ($('#' + s).hidden = s !== id)); window.__booted = true; if ($('#rescue')) $('#rescue').hidden = true; window.hideSplash?.(); };
let user = null, profile = null;

/* ---------- 로그인 ---------- */
let signing = false;
$('#toggleSign').onclick = () => {
  signing = !signing;
  $('#emailBtn').textContent = signing ? '가입하기' : '로그인';
  $('#authSub').textContent = signing ? '가입하고 함께 여정을 시작하세요' : '로그인하고 새로운 여정을 시작하세요';
  $('#toggleQ').textContent = signing ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?';
  $('#toggleSign').textContent = signing ? '로그인' : '회원가입';
  $('#pw').placeholder = signing ? '비밀번호를 정하세요 (6자 이상)' : '비밀번호를 입력하세요';
  $('#pw').autocomplete = signing ? 'new-password' : 'current-password';
};
$('#pwEye').onclick = () => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; $('#pwEye').classList.toggle('on', p.type === 'text'); };
// 로그인 유지: 끄면 이 브라우저 창을 닫을 때 로그아웃 (같이 쓰는 폰·PC에서)
const remember = () => net.setRemember?.($('#remember').checked);
const authErr = e => {
  const m = { 'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.', 'auth/email-already-in-use': '이미 가입한 이메일이에요. 로그인해 주세요.', 'auth/weak-password': '비밀번호는 6자 이상으로 해 주세요.', 'auth/invalid-email': '이메일 주소를 확인해 주세요.', 'auth/popup-closed-by-user': '구글 로그인 창이 닫혔어요.', 'auth/operation-not-allowed': '아직 이 로그인 방식이 켜져 있지 않아요 (Firebase 콘솔에서 켜야 해요).', 'auth/configuration-not-found': '아직 로그인 설정이 되어 있지 않아요 (Firebase 콘솔 → Authentication 시작).' }[e.code];
  $('#authMsg').className = 'msg err';
  $('#authMsg').textContent = m || e.message;
};
$('#emailForm').onsubmit = async e => {
  e.preventDefault();
  if (inApp) return goOutside();
  $('#authMsg').textContent = '';
  try { await remember(); await (signing ? net.signUp : net.signIn)($('#email').value.trim(), $('#pw').value); } catch (er) { authErr(er); }
};
// 카카오톡 등 앱 안 브라우저에서 로그인하려 하면 바로 바깥 브라우저(아이폰 Safari·안드로이드 크롬)로 연다 —
// 구글은 앱 안 로그인을 막고, 이메일도 바깥에서 해야 로그인이 그 브라우저(나중에 설치할 앱)에 남는다. 입력칸을 누르는 순간 넘겨 헛되이 적지 않게
const goOutside = () => {
  const out = outUrl(false);
  if (out) { location.href = out; return true; }
  $('#authMsg').className = 'msg err'; $('#authMsg').textContent = '이 앱 안에서는 로그인이 막혀요. 메뉴에서 ‘다른 브라우저로 열기’를 눌러 주세요.';
  return true;
};
$('#googleBtn').onclick = () => {
  if (inApp) return goOutside();
  Promise.resolve(remember()).then(() => net.google()).catch(authErr);
};
['#email', '#pw'].forEach(s => $(s).addEventListener('pointerdown', e => { if (inApp) { e.preventDefault(); goOutside(); } }));
/* ---------- 앱으로 설치하기 · 앱 안 브라우저 (그 길과 같게) ---------- */
// 설치 창 이벤트는 페이지를 연 직후에 올 수 있어 일찍 받아 둔다
let installEv = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(navigator.userAgent); // 메신저 등 앱 안 브라우저는 설치도 구글 로그인도 못 한다
// 앱 안 브라우저에서 바깥 브라우저로 넘기는 주소: 카카오톡은 자체 주소(iOS는 Safari, 안드로이드는 기본 브라우저로),
// 그 밖의 안드로이드 앱 안 브라우저는 크롬 intent. 초대 주소(?g=코드)는 그대로 들고 간다. install이면 넘어가서 설치 안내를 다시 띄운다
function outUrl(install) {
  const q = new URLSearchParams(location.search); q.delete('install'); if (install) q.set('install', '');
  const qs = q.toString().replace(/=(&|$)/g, '$1'), path = location.pathname + (qs ? '?' + qs : '');
  if (/KAKAOTALK/i.test(navigator.userAgent)) return `kakaotalk://web/openExternal?url=${encodeURIComponent(location.origin + path)}`;
  if (inApp && /android/i.test(navigator.userAgent)) return `intent://${location.host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
  return null;
}
const INSTALL_ICO = {
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 10H5.5v10.5h13V10H17"/>',
  add: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  menu: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M12 7.5v7m-3-3 3 3 3-3"/>',
};
const installSteps = list => `<ol class="install-steps">${list.map(([text, i]) => `<li><span>${text}</span><svg viewBox="0 0 24 24" aria-hidden="true">${INSTALL_ICO[i]}</svg></li>`).join('')}</ol>`;
// 안내 창: 설치 창을 띄울 수 있으면(안드로이드 크롬 등) '지금 설치하기' 하나, 아이폰은 Safari '홈 화면에 추가' 순서, 그 밖은 브라우저 메뉴 순서
function installSheet() {
  const out = inApp && outUrl(true);
  const body = out ? `<p class="install-note">앱 안 브라우저에서는 설치할 수 없어요. 아래 단추로 열면 그 브라우저에서 설치 안내가 이어져요.</p><a class="btn wide goldbtn install-out" href="${esc(out)}">${ios ? 'Safari로 열기' : '크롬(기본 브라우저)으로 열기'}</a>`
    : installEv ? `<button class="btn wide goldbtn" id="installNow">지금 설치하기</button><p class="fine">설치 창이 뜨면 ‘설치’를 누르면 끝이에요.</p>`
    : (ios ? installSteps([['Safari 아래쪽(아이패드는 위쪽)의 공유 단추를 눌러요', 'share'], ['목록을 올려 ‘홈 화면에 추가’를 눌러요', 'add'], ['오른쪽 위 ‘추가’를 누르면 홈 화면에 ‘비전 퀘스트’가 생겨요', 'phone']])
      : installSteps([['브라우저 오른쪽 위 메뉴(⋮)를 눌러요', 'menu'], ['‘앱 설치’ 또는 ‘홈 화면에 추가’를 눌러요', 'phone'], ['‘설치’를 누르면 홈 화면에 ‘비전 퀘스트’가 생겨요', 'add']]))
      + (inApp ? `<p class="install-note">카카오톡 같은 앱 안에서 열었다면, 오른쪽 아래(또는 위)의 메뉴에서 ‘다른 브라우저로 열기’를 먼저 눌러요.</p>` : '');
  openSheet(`<div class="install-box"><img src="assets/icon-192.png" alt="" width="64" height="64" class="install-icon"><h3>앱으로 설치하기</h3>
    <p class="install-lead">홈 화면에 아이콘이 생기고, 주소창 없이 앱처럼 꽉 찬 화면으로 열려요.</p>${body}</div>`, el => {
    el.querySelector('#installNow')?.addEventListener('click', async () => {
      const ev = installEv; installEv = null;
      ev.prompt(); try { await ev.userChoice; } catch { /* 닫음 */ }
      closeSheet();
    });
  });
}
document.querySelectorAll('.install-app').forEach(b => { b.hidden = !!standalone; b.onclick = installSheet; });
addEventListener('appinstalled', () => { document.querySelectorAll('.install-app').forEach(b => (b.hidden = true)); if ($('#sheetCard .install-box')) closeSheet(); });
// 설치 창 이벤트가 안내 창을 연 뒤에 오면(바깥 브라우저로 막 넘어온 때) '지금 설치하기'로 바꿔 그린다
addEventListener('beforeinstallprompt', () => { if (!$('#sheet').hidden && $('#sheetCard .install-box')) installSheet(); });
// 앱 안 브라우저에서 넘어와 열렸으면 주소의 install을 지우고(홈 화면에 추가할 주소에 남지 않게) 안내 창을 바로 띄운다 (시작 화면이 걷히면 보인다)
if (new URLSearchParams(location.search).has('install')) {
  const q = new URLSearchParams(location.search); q.delete('install');
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString().replace(/=(&|$)/g, '$1') : '') + location.hash);
  if (!standalone) installSheet();
}
$('#resetBtn').onclick = async () => {
  const em = $('#email').value.trim();
  if (!em) { $('#authMsg').textContent = '이메일을 먼저 적어 주세요.'; return; }
  try { await net.resetPw(em); $('#authMsg').className = 'msg'; $('#authMsg').textContent = '비밀번호를 다시 정하는 메일을 보냈어요.'; } catch (er) { authErr(er); }
};

/* ---------- 별칭·인형 ---------- */
// 옷 색은 각자 고른다 (팀은 이름표·발밑 고리 색으로 구분하니 옷은 자유). 망토는 사람마다 밝은 색, 띠는 금색
const ROBES = ['#f4efe4', '#3d7be0', '#e0503d', '#3dae6a', '#ffcf3a', '#8e5bd6', '#e8862e', '#3fbfd9', '#e06aa8', '#7fae3a', '#2b2d3a'];
let draft = { gender: 'm', avatar: pick(OUTFITS.m), robe: pick(ROBES) };
// 옷 색: 고른 색, 아직 안 골랐으면(예전 가입자) 사람마다 정해진 밝은 색
const robeOf = uid => G.members[uid]?.robe || personColor(uid);
const myThumb = (t, robe) => W.avatarThumb(t, robe || profile?.robe || personColor(net.me() || 'me'), net.me() || '');
$('#robes').innerHTML = ROBES.map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="옷 색"></button>`).join('');
$('#robes').onclick = e => { const c = e.target.closest('button')?.dataset.c; if (c) { draft.robe = c; drawDraft(); } };
function drawDraft() {
  $('#avatarImg').src = myThumb(draft.avatar, draft.robe);
  document.querySelectorAll('#robes button').forEach(b => b.classList.toggle('on', b.dataset.c === draft.robe));
  document.querySelectorAll('#genderSeg button').forEach(b => b.classList.toggle('on', b.dataset.g === draft.gender));
}
document.querySelectorAll('#genderSeg button').forEach(b => (b.onclick = () => { draft.gender = b.dataset.g; draft.avatar = pick(OUTFITS[draft.gender]); drawDraft(); }));
$('#reroll').onclick = () => {
  const list = OUTFITS[draft.gender].filter(t => t !== draft.avatar);
  draft.avatar = pick(list);
  drawDraft();
};
function editProfile() {
  draft = profile ? { gender: profile.gender || 'm', avatar: profile.avatar, robe: profile.robe || personColor(net.me()) } : { gender: 'm', avatar: pick(OUTFITS.m), robe: pick(ROBES) };
  $('#profName').value = profile?.name || (user.name || '').slice(0, 12);
  drawDraft();
  show('profile');
}
$('#profSave').onclick = async () => {
  const name = $('#profName').value.trim();
  if (name.length < 2) { $('#profName').focus(); $('#profName').placeholder = '별칭을 2자 이상 적어 주세요'; return; }
  profile = { name, gender: draft.gender, avatar: draft.avatar, robe: draft.robe };
  await net.saveProfile(profile);
  // 이미 들어가 있던 게임의 이름표·인형도 바꾼다
  if (G.code) net.joinGame(G.code, profile);
  toLobby();
};

/* ---------- 게임 고르기 ---------- */
// 게임에서 나와 로비로 (게임이 지워졌을 때)
function leaveGame(msg) {
  G.off?.(); G.off = null; G.code = null; G.meta = {};
  store.set('lastGame', null);
  history.replaceState(null, '', location.pathname + (DEMO ? '?demo' : ''));
  W.stop();
  if (msg) toast(msg);
  if (DEMO) show('lobby'); else toLobby(); // 데모는 로비에서 바로 다시 들어가 버리지 않게
}
function toLobby() {
  $('#lobbyAvatar').src = myThumb(profile.avatar);
  $('#lobbyName').textContent = profile.name;
  $('#lobbyEmail').textContent = user.email || '';
  show('lobby');
  const want = new URLSearchParams(location.search).get('g') || store.get('lastGame');
  if (DEMO) enter('DEMO');
  else if (want) { $('#joinCode').value = want; }
}
$('#editProfile').onclick = editProfile;
$('#logout').onclick = () => { store.set('lastGame', null); net.signOut(); };
$('#joinForm').onsubmit = e => { e.preventDefault(); enter($('#joinCode').value.trim().toUpperCase()); };
$('#cCenter').onchange = () => ($('#cLL').hidden = $('#cCenter').value !== 'custom');
const here = () => new Promise((ok, no) => navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), no, { enableHighAccuracy: true, timeout: 15000 }));
$('#createForm').onsubmit = async e => {
  e.preventDefault();
  const msg = $('#lobbyMsg');
  msg.className = 'msg'; msg.textContent = '만드는 중…';
  try {
    let center = JEONJU;
    if ($('#cCenter').value === 'here') center = await here();
    if ($('#cCenter').value === 'custom') {
      const [lat, lng] = $('#cLL').value.split(',').map(Number);
      if (!isFinite(lat) || !isFinite(lng)) throw new Error('위도, 경도를 "35.8155, 127.1525"처럼 적어 주세요.');
      center = { lat, lng };
    }
    // 개인전이면 팀 없이, 팀전이면 고른 수만큼 (진행 중에도 팀을 더하고 뺄 수 있다)
    const solo = $('#cTeams').value === 'solo';
    const teams = {};
    if (!solo) TEAM_PRESET.slice(0, +$('#cTeams').value).forEach(([name, color], i) => (teams['t' + (i + 1)] = { name, color }));
    const code = await net.createGame({ name: $('#cName').value.trim(), mode: solo ? 'solo' : 'team', center, radius: +$('#cRadius').value, layer: 'sat' }, teams, profile);
    msg.textContent = '';
    enter(code);
  } catch (er) { msg.className = 'msg err'; msg.textContent = er.message || '만들지 못했어요.'; }
};

/* ---------- 게임 ---------- */
const G = { code: null, meta: {}, teams: {}, members: {}, pos: {}, missions: {}, done: {}, pdone: {}, feed: [], off: null, areaKey: '' };
const myTeam = () => G.members[net.me()]?.team || '';
// 진행 중: 진행자가 시작했고, 끝나는 시간(endAt)이 있으면 아직 그 전 (규칙도 같은 조건으로 막는다)
const timeUp = () => !!G.meta.endAt && Date.now() >= G.meta.endAt;
const isLive = () => G.meta.status === 'live' && !timeUp();
const isOver = () => G.meta.status === 'ended' || (G.meta.status === 'live' && timeUp());
// 진행자: 게임을 만든 사람(host)과, 그가 회원 중에서 더한 사람들(hosts)
const isOwner = () => G.meta.host === net.me();
const isHostUid = uid => uid === G.meta.host || G.meta.hosts?.[uid] === true;
const isHost = () => isHostUid(net.me());
const teamOf = tid => G.teams[tid] || { name: '팀 없음', color: '#8a8070' };
// 개인전(solo): 팀 없이 각자. 개인 미션(each): 팀전에서도 팀원 각자 해서 점수를 자기 팀에 보탠다 — 완료는 pdone/{uid}에
const solo = () => G.meta.mode === 'solo';
const isEach = m => solo() || !!m?.each;
const colorOf = uid => (solo() ? personColor(uid) : teamOf(G.members[uid]?.team).color);
// 이 미션에서 나(개인 미션) 또는 우리 팀(팀 미션)의 완료
const myDone = id => (isEach(G.missions[id]) ? G.pdone[net.me()]?.[id] : G.done[myTeam()]?.[id]);
// 개인 미션을 해낸 사람들 [uid, 완료]
const eachDone = id => Object.entries(G.pdone).map(([u, ms]) => [u, ms?.[id]]).filter(([, d]) => d?.status === 'ok');
let myLL = null, tab = 'missions', unseen = 0;

async function enter(code) {
  if (!code) return;
  const msg = $('#lobbyMsg');
  const meta = await net.gameMeta(code).catch(() => null);
  if (!meta) { msg.className = 'msg err'; msg.textContent = `'${code}' 게임을 찾지 못했어요.`; return; }
  if (await net.amBanned(code)) { msg.className = 'msg err'; msg.textContent = '진행자가 이 게임에서 내보냈어요. 다시 들어가려면 진행자에게 말해 주세요.'; store.set('lastGame', null); return; }
  msg.className = 'msg'; msg.textContent = '들어가는 중…';
  try { await net.joinGame(code, profile); }
  catch (er) { msg.className = 'msg err'; msg.textContent = `들어가지 못했어요 (${er.code || er.message}). 진행자에게 알려 주세요.`; return; }
  msg.textContent = '';
  net.presence(code);
  store.set('lastGame', code);
  history.replaceState(null, '', `?${DEMO ? 'demo&' : ''}${FAKE ? `fakegps=${FAKE.lat},${FAKE.lng}&` : ''}g=${code}`);
  G.code = code;
  G.feed = [];
  G.shownResult = false;
  show('game');
  $('#nogl').hidden = W.hasGL;
  W.start();
  G.off?.();
  G.off = net.watch(code, {
    meta: v => { if (!v.host && G.meta.host) { leaveGame('진행자가 게임을 지웠어요.'); return; } G.meta = v; onMeta(); }, // 게임이 지워지면 로비로
    teams: v => { G.teams = v; refresh(); },
    // 이름 없는 자리는 거른다 (내보낸 사람의 접속 표시가 늦게 되살아나는 경우)
    members: v => { G.members = Object.fromEntries(Object.entries(v).filter(([, m]) => m?.name)); refresh(); },
    kicked: () => { net.dropPresence(code); leaveGame('진행자가 게임에서 내보냈어요.'); },
    pos: v => { G.pos = v; syncPlayers(); if (tab === 'people') renderPanel(); },
    missions: v => { G.missions = v; refresh(); checkArrive(); },
    done: v => { G.done = v; refresh(); },
    pdone: v => { G.pdone = v; refresh(); },
    feed: (f, isNew) => {
      G.feed.unshift(f);
      if (G.feed.length > 60) G.feed.pop();
      if (isNew) { toast(plain(f.text), f.team ? null : 'megaphone'); if (tab !== 'feed') unseen++; if (plain(f.text).startsWith('깜짝 미션')) navigator.vibrate?.([300, 120, 300]); }
      if (tab === 'feed') renderPanel(); else renderTabs();
    },
    feedGone: id => {
      G.feed = G.feed.filter(f => f.id !== id);
      if (!G.feed.length) unseen = 0;
      if (tab === 'feed') renderPanel(); else renderTabs();
    },
  });
  W.follow(net.me());
  // 테스트 모드는 그때만 — 다시 열면 GPS로 (전에 시험해 본 폰이 행사 날 테스트 모드에 갇히지 않게). 끄기를 고른 것만 기억한다
  setMode(FAKE ? 'gps' : DEMO ? 'sim' : store.get('posMode') === 'off' ? 'off' : 'gps');
}

function onMeta() {
  $('#gName').textContent = G.meta.name || '';
  $('#gStatus').textContent = `${STATUS[G.meta.status] || ''} · 코드 ${G.code}`;
  // 끝나는 시간이 새로 정해지거나 바뀌면 (처음 들어올 때 말고) 폰을 울려 알린다 — 글은 소식으로 함께 온다
  if (G.endSeen !== undefined && G.meta.endAt !== G.endSeen) { navigator.vibrate?.([200, 100, 200]); warned = {}; }
  G.endSeen = G.meta.endAt;
  tickTimer();
  if (!isOver()) { G.shownResult = false; if (resultOpen()) closeSheet(); } // 리셋·다시 시작하면 결과 화면을 거둔다
  checkResults();
  $('#hostTab').hidden = !isHost();
  // 테스트 모드 단추도 진행자에게만. 진행자에서 빠졌는데 테스트 모드였으면 GPS로 돌아간다 (데모는 그대로)
  $('#simBtn').hidden = sim || !isHost();
  if (sim && !isHost() && !DEMO && G.meta.host) setMode('gps');
  if (tab === 'host' && !isHost()) { tab = 'missions'; renderTabs(); renderPanel(); } // 진행자에서 빠지면 진행 탭을 닫는다
  simHome();
  // 3D 건물 단추는 지도 모드일 때만 (지도 단추 바로 밑)
  $('#fabBld').hidden = G.meta.layer !== 'map';
  const center = G.meta.center;
  const key = [center?.lat, center?.lng, G.meta.radius, G.meta.layer].join();
  if (key !== G.areaKey && center) {
    G.areaKey = key;
    W.loadArea({ center, radius: G.meta.radius || 600, layer: G.meta.layer || 'sat' }).then(t => {
      if (!t) return; // 그 사이 다른 지역을 요청했다
      $('#credit').textContent = [t.credit, t.demOk ? '고도 © Mapzen/AWS Terrain Tiles' : ''].filter(Boolean).join(' · ');
      syncPlayers(); syncMissions();
    });
  }
  refresh();
}

function refresh() {
  if (!G.code) return;
  syncGuide();
  if (resultOpen() && JSON.stringify(standings()) + pendings().length !== resultKey) showResults(true);
  renderScores();
  syncPlayers();
  syncMissions();
  renderTabs();
  renderPanel();
  // 팀이 아직 없으면 고르게 한다 (진행자는 팀 없이도 된다)
  if (!solo() && G.members[net.me()] && !myTeam() && !isHost() && Object.keys(G.teams).length && $('#sheet').hidden) teamPicker();
}

/* ---------- 점수판 ---------- */
// 팀 점수 = 팀 미션 + 그 팀 사람들이 해낸 개인 미션 (완료할 때의 팀으로 센다). n은 팀 미션 수만 (전체 몇 개 중 몇 개)
const okPts = list => list.reduce((s, x) => s + (+x.pts || 0), 0);
const teamScore = tid => {
  const d = Object.values(G.done[tid] || {}).filter(x => x.status === 'ok');
  const mine = Object.values(G.pdone).flatMap(ms => Object.values(ms || {})).filter(x => x.status === 'ok' && x.team === tid);
  return { n: d.length, pts: okPts(d) + okPts(mine) };
};
const personScore = uid => { const d = Object.values(G.pdone[uid] || {}).filter(x => x.status === 'ok'); return { n: d.length, pts: okPts(d) }; };
// 점수가 오르는 순간 그 칸을 반짝인다
let lastPts = {};
// 순위표: 개인전은 사람, 팀전은 팀 — 점수, 같으면 미션 수로. 점수판과 결과 화면이 같이 쓴다
function standings() {
  const open = Object.values(G.missions).filter(m => m.open !== false);
  const rows = solo()
    ? Object.entries(G.members).filter(([u]) => !isHostUid(u) || personScore(u).n).map(([u, m]) => ({ key: 'u' + u, id: u, kind: 'u', name: m.name, color: personColor(u), mine: u === net.me(), total: open.length, ...personScore(u) }))
    : Object.entries(G.teams).map(([tid, t]) => ({ key: 't' + tid, id: tid, kind: 't', name: t.name, color: t.color, mine: tid === myTeam(), total: open.filter(m => !m.each).length, ...teamScore(tid) }));
  rows.sort((a, b) => b.pts - a.pts || b.n - a.n);
  // 같은 점수·같은 미션 수면 같은 등수
  rows.forEach((r, i) => (r.rank = i && r.pts === rows[i - 1].pts && r.n === rows[i - 1].n ? rows[i - 1].rank : i + 1));
  return rows;
}
// 점수판: 팀(개인전은 사람)마다 점수만 — 'n/전체' 미션 수는 팀 인원으로 읽히고 개인 미션이 빠져 헷갈렸다
function renderScores() {
  const rows = standings();
  $('#scores').innerHTML = rows.map(r => `
    <div class="score ${r.mine ? 'mine' : ''} ${lastPts[r.key] != null && r.pts > lastPts[r.key] ? 'bump' : ''}" data-${r.kind}="${r.id}">
      <i style="background:${esc(r.color)}"></i><div class="sv"><b>${esc(r.name)}</b><em>${r.pts}<small>점</small></em></div>
    </div>`).join('');
  lastPts = Object.fromEntries(rows.map(r => [r.key, r.pts]));
  document.querySelectorAll('.score').forEach(el => {
    el.onclick = () => (el.dataset.u ? focusPlayer(el.dataset.u) : focusTeam(el.dataset.t));
    el.addEventListener('animationend', () => el.classList.remove('bump'));
  });
}

/* ---------- 3D에 반영 ---------- */
function syncPlayers() {
  if (!W.frame()) return;
  const now = Date.now();
  // 한 사람에서 탈이 나도 나머지 사람은 계속 옮긴다
  Object.entries(G.members).forEach(([uid, m]) => { try {
    const p = G.pos[uid];
    if (!p) { W.removePlayer(uid); return; }
    const stale = !m.online || now - (p.t || 0) > STALE;
    // 술래잡기 중인 술래는 이름표 아래에 '술래'
    const it = isIt(uid);
    W.upsertPlayer({ uid, name: m.name, avatar: m.avatar, robe: robeOf(uid), color: colorOf(uid), team: m.team, me: uid === net.me(), sub: [it ? '술래' : '', stale ? ago(p.t) : ''].filter(Boolean).join(' · ') });
    W.movePlayer(uid, p, stale);
  } catch (e) { console.error(e); } });
}
function syncMissions() {
  if (!W.frame()) return;
  const seen = new Set(), placed = [];
  Object.entries(G.missions).sort((x, y) => (x[1].order ?? 0) - (y[1].order ?? 0)).forEach(([id, m]) => {
    if (m.open === false && !isHost()) { W.removeMission(id); return; }
    seen.add(id);
    const stack = placed.filter(p => dist(p, m) < 15).length; placed.push(m); // 같은 자리 몇 번째인지
    const st = myDone(id)?.status;
    const by = isEach(m) ? (eachDone(id).length ? eachDone(id).length + '명' : '') : Object.keys(G.teams).filter(t => G.done[t]?.[id]?.status === 'ok').map(t => G.teams[t].name).join('·');
    const z = m.type === 'tag' ? { ...zone(m), r: 0 } : m; // 술래잡기는 가운데 표지만 — 구역은 연두색 띠
    W.upsertMission({ id, stack, icon: iconImage(TYPES[m.type]?.[0] || 'pin'), title: `${m.title}${m.each && !solo() ? ' (개인)' : ''}`, lat: z.lat, lng: z.lng, r: z.r, dim: st === 'ok' || m.open === false || expired(m),
      color: st === 'ok' ? '#7fdc8f' : st === 'wait' ? '#f0d79a' : '#ffcf6a', sub: `${m.pts || 0}점${m.until && m.open !== false ? (expired(m) ? ' · 시간 끝' : ` · 남은 ${Math.ceil((m.until - Date.now()) / 60e3)}분`) : ''}${by ? ' · ✓ ' + by : ''}` });
  });
  removedMissions(seen);
}
let knownMissions = new Set();
function removedMissions(seen) { knownMissions.forEach(id => !seen.has(id) && W.removeMission(id)); knownMissions = seen; }

const ago = t => {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`;
};

/* ---------- 아래 판: 미션 · 사람 · 소식 · 진행 ---------- */
document.querySelectorAll('.tabs button[data-tab]').forEach(b => (b.onclick = () => { tab = b.dataset.tab; if (tab === 'feed') unseen = 0; setDock(false); renderTabs(); renderPanel(); }));
// 아래 창 접기/펴기 (탭을 누르면 펴진다 — 단추 글자도 같이 바꾼다)
const setDock = min => { $('#dock').classList.toggle('min', min); $('#grip').innerHTML = (min ? '펴기 ' : '접기 ') + ic(min ? 'up' : 'down'); };
setDock(false);
$('#grip').onclick = () => setDock(!$('#dock').classList.contains('min'));
function renderTabs() {
  const waits = isHost() ? pendings().length : 0;
  document.querySelectorAll('.tabs button[data-tab]').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
    const n = b.dataset.tab === 'feed' ? unseen : b.dataset.tab === 'host' ? waits : 0;
    const base = { missions: '미션', people: '사람', feed: '소식', host: '진행' }[b.dataset.tab];
    b.innerHTML = base + (n ? `<span class="badge">${n}</span>` : '');
  });
}
function renderPanel() {
  const el = $('#panel');
  if (tab === 'missions') el.innerHTML = missionList();
  if (tab === 'people') el.innerHTML = peopleList();
  if (tab === 'feed') el.innerHTML = G.feed.length ? G.feed.map(f => `<div class="feed"><time>${clock(f.t)}</time><span>${f.team ? `<span class="dot" style="background:${esc(teamOf(f.team).color)}"></span>` : ic('megaphone')} ${esc(plain(f.text))}</span></div>`).join('') : '<p class="empty">아직 소식이 없어요.</p>';
  if (tab === 'host') el.innerHTML = hostPanel();
  el.querySelector('#seeResult')?.addEventListener('click', showResults);
  el.querySelectorAll('[data-m]').forEach(n => (n.onclick = () => openMission(n.dataset.m)));
  el.querySelectorAll('[data-u]').forEach(n => (n.onclick = () => focusPlayer(n.dataset.u)));
  el.querySelectorAll('[data-kick]').forEach(n => (n.onclick = e => { e.stopPropagation(); kickSheet(n.dataset.kick); }));
  el.querySelectorAll('[data-t]').forEach(n => (n.onclick = () => focusTeam(n.dataset.t)));
  if (tab === 'host') bindHost(el);
}
const clock = t => (t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '');
const sortedMissions = () => Object.entries(G.missions).filter(([, m]) => m.open !== false || isHost()).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
function missionList() {
  const list = sortedMissions();
  const banner = isOver() ? `<button class="banner" id="seeResult">${ic('trophy')} 게임이 끝났어요 — 결과 보기</button>` : '';
  return banner + missionItems(list);
}
function missionItems(list) {
  if (!list.length) return `<p class="empty">아직 미션이 없어요.${isHost() ? '<br>진행 탭 「미션 관리」에서 미션을 더해 주세요.' : ''}</p>`;
  return list.map(([id, m]) => {
    const st = myDone(id)?.status;
    const d = !myLL ? '' : m.type === 'tag' ? (near(m) ? '지역 안' : '') : fmtDist(dist(myLL, m));
    // 해낸 팀은 팀 색 점으로, 개인 미션은 해낸 사람 수로
    const dots = isEach(m) ? (eachDone(id).length ? ` · ${ic('check')} ${eachDone(id).length}명` : '') : Object.entries(G.teams).filter(([t]) => G.done[t]?.[id]?.status === 'ok').map(([, t]) => `<i style="background:${esc(t.color)}"></i>`).join('');
    return `<div class="item" data-m="${id}">
      <div class="ic ${st || ''}">${ic(st === 'ok' ? 'check' : st === 'wait' ? 'wait' : TYPES[m.type]?.[0] || 'pin')}</div>
      <div class="tx"><b>${esc(m.title)}</b><small>${solo() ? '' : `<span class="kind ${m.each ? 'each' : 'team'}">${m.each ? '개인' : '팀'}</span> `}${TYPES[m.type]?.[1] || ''} · ${m.pts || 0}점${m.open === false ? ' · 닫힘' : m.until ? ` · ${ic('clock')}${cd(m)}` : ''}<span class="dots">${dots}</span></small></div>
      <div class="rt">${d}</div></div>`;
  }).join('');
}
function peopleList() {
  const row = ([uid, m]) => {
    const p = G.pos[uid], live = m.online && p && Date.now() - (p.t || 0) < STALE, s = personScore(uid);
    return `<div class="item" data-u="${uid}"><img class="mini" src="${thumb(m.avatar, uid)}" alt="">
      <div class="tx"><b>${solo() ? `<span class="dot" style="background:${personColor(uid)}"></span> ` : ''}${esc(m.name)}${uid === net.me() ? ' (나)' : ''}${isHostUid(uid) ? ' · 진행자' : ''}</b>
      <small><span class="dot ${live ? 'on-dot' : 'off-dot'}"></span> ${p ? (live ? '위치 공유 중' : ago(p.t) + ' 위치') : '위치 없음'}${s.n ? ` · ${solo() ? '' : '개인 '}${s.n}개 ${s.pts}점` : ''}</small></div>
      <div class="rt">${myLL && p && uid !== net.me() ? fmtDist(dist(myLL, p)) : ''}${canKick(uid) ? `<button class="kick" data-kick="${uid}">내보내기</button>` : ''}</div></div>`;
  };
  // 개인전: 점수 순으로 한 줄. 팀전: 팀별로 묶는다
  if (solo()) return Object.entries(G.members).sort(([a], [b]) => personScore(b).pts - personScore(a).pts).map(row).join('');
  const groups = {};
  Object.entries(G.members).forEach(([uid, m]) => (groups[m.team || ''] ||= []).push([uid, m]));
  const order = [...Object.keys(G.teams), ''];
  return order.filter(t => groups[t]).map(t => {
    const team = teamOf(t), s = t ? teamScore(t) : null;
    return `<div class="group-h" data-t="${t}"><span class="dot" style="background:${esc(team.color)}"></span><b>${esc(team.name)}</b>${s ? ` · 미션 ${s.n} · ${s.pts}점` : ''}</div>` + groups[t].map(row).join('');
  }).join('');
}
const thumbs = {};
// 사람 목록의 작은 인형: 3D와 같은 옷 (각자 고른 겉옷 색, 사람마다 망토 색)
const thumb = (t, uid) => { const c = uid ? robeOf(uid) : '', k = `${t}|${c}|${uid || ''}`; return (thumbs[k] ||= W.avatarThumb(t || 'man', c, uid)); };

/* ---------- 찾기: 별칭이나 팀 이름 → 그 미니미에게로 ---------- */
const findEl = $('#find'), findsEl = $('#finds');
function finds(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const teams = Object.entries(solo() ? {} : G.teams).filter(([, t]) => t.name.toLowerCase().includes(q)).map(([tid, t]) => ({ kind: 't', id: tid, label: t.name, color: t.color, sub: `팀 · ${Object.values(G.members).filter(m => m.team === tid).length}명` }));
  const people = Object.entries(G.members).filter(([, m]) => (m.name || '').toLowerCase().includes(q)).map(([uid, m]) => ({ kind: 'u', id: uid, label: m.name, color: colorOf(uid), sub: (solo() ? `${personScore(uid).pts}점` : teamOf(m.team).name) + (G.pos[uid] ? '' : ' · 위치 없음'), avatar: m.avatar }));
  return [...people, ...teams].slice(0, 12);
}
findEl.oninput = () => {
  const r = finds(findEl.value);
  findsEl.hidden = !findEl.value.trim();
  findsEl.innerHTML = r.length ? r.map(x => `<button data-k="${x.kind}" data-id="${x.id}">${x.avatar ? `<img class="mini" src="${thumb(x.avatar, x.id)}" alt="">` : `<span class="dot" style="background:${esc(x.color)};width:14px;height:14px"></span>`}<span><b>${esc(x.label)}</b><br><small class="fine">${esc(x.sub)}</small></span></button>`).join('') : '<div class="none">찾는 사람이나 팀이 없어요.</div>';
  findsEl.querySelectorAll('button').forEach(b => (b.onclick = () => { closeFind(); b.dataset.k === 'u' ? focusPlayer(b.dataset.id) : focusTeam(b.dataset.id); }));
};
findEl.onkeydown = e => { if (e.key === 'Enter') { const r = finds(findEl.value)[0]; if (r) { closeFind(); r.kind === 'u' ? focusPlayer(r.id) : focusTeam(r.id); } } if (e.key === 'Escape') closeFind(); };
const closeFind = () => { findsEl.hidden = true; findEl.value = ''; findEl.blur(); };
document.addEventListener('pointerdown', e => { if (!e.target.closest('.finder')) findsEl.hidden = true; });

/* ---------- 내보내기 (진행자) ---------- */
// 진행자는 진행자가 아닌 참가자를 내보낼 수 있다(진행자는 먼저 진행자에서 빼야). 해낸 미션 기록은 팀 점수로 남는다
const canKick = uid => isHost() && uid !== net.me() && !isHostUid(uid);
function kickSheet(uid) {
  const m = G.members[uid];
  if (!m) return;
  const it = Object.values(G.missions).some(x => x.type === 'tag' && Object.values(x.it || {}).includes(uid));
  openSheet(`<p class="eyebrow">내보내기</p><h3>${esc(m.name)} 님을 게임에서 내보낼까요?</h3>
    <p class="fine">지도와 사람 목록에서 사라지고, 같은 코드로 다시 들어오지 못해요. 이미 해낸 미션 점수는 팀에 남아요. 실수였다면 진행 탭 '내보낸 사람'에서 다시 들일 수 있어요.</p>
    ${it ? `<div class="box warn">${ic('tag')} 술래잡기의 술래예요. 내보낸 뒤 미션 관리에서 술래를 다시 정해 주세요.</div>` : ''}
    <div class="row"><button class="btn wide danger" id="kickYes">내보내기</button><button class="btn wide" id="kickNo">그만두기</button></div><p class="msg" id="kickMsg"></p>`, s => {
    s.querySelector('#kickNo').onclick = closeSheet;
    s.querySelector('#kickYes').onclick = async () => {
      try { await net.kick(G.code, uid, m.name); closeSheet(); toast(`${m.name} 님을 내보냈어요.`); }
      catch (er) { s.querySelector('#kickMsg').className = 'msg err'; s.querySelector('#kickMsg').textContent = '내보내지 못했어요 (' + (er.code || er.message) + ')'; }
    };
  });
}
async function bannedSheet() {
  const list = Object.entries(await net.bannedList(G.code).catch(() => ({})));
  openSheet(`<p class="eyebrow">내보낸 사람</p><h3>${list.length ? `${list.length}명` : '내보낸 사람이 없어요'}</h3>
    ${list.length ? `<p class="fine">다시 들이면 같은 코드로 들어올 수 있어요. 팀은 들어와서 다시 골라요.</p>` + list.map(([u, b]) => `<div class="item"><div class="tx"><b>${esc(b.name || '이름 없음')}</b><small>${clock(b.t)}에 내보냄</small></div><div class="rt"><button class="btn small" data-unban="${u}">다시 들이기</button></div></div>`).join('') : ''}`, s =>
    s.querySelectorAll('[data-unban]').forEach(b => (b.onclick = async () => { await net.unban(G.code, b.dataset.unban); toast('다시 들어올 수 있어요.'); bannedSheet(); })));
}
function focusPlayer(uid) {
  const p = G.pos[uid], m = G.members[uid];
  if (!p) { toast(`${m?.name || ''} 님은 아직 위치를 공유하지 않았어요.`); return; }
  W.flyTo(p, 110);
  W.follow(uid);
  setFab();
  toast(`${m.name}${solo() ? '' : ' · ' + teamOf(m.team).name}${myLL && uid !== net.me() ? ' · ' + fmtDist(dist(myLL, p)) : ''} — 따라가는 중`);
}
// 팀: 위치가 있는 팀원들의 가운데로, 모두 들어오게 물러난다
function focusTeam(tid) {
  const pts = Object.entries(G.members).filter(([, m]) => m.team === tid).map(([u]) => G.pos[u]).filter(Boolean);
  if (!pts.length) { toast(`${teamOf(tid).name}에 위치를 공유한 사람이 없어요.`); return; }
  const c = { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length };
  const spread = Math.max(...pts.map(p => dist(c, p)));
  W.follow(null);
  W.flyTo(c, Math.max(140, spread * 2.6));
  setFab();
  toast(`${teamOf(tid).name} · ${pts.length}명`);
}

/* ---------- 지도 단추 ---------- */
// 내 위치 단추: 꺼짐(회색 과녁) → 따라가기(파란 과녁) → 진행 방향 고정(파란 화살) → 꺼짐. 아이콘이 단계마다 바뀐다
let fabMode = null;
const setFab = () => {
  const mode = W.following() !== net.me() ? '' : W.headingUp() ? 'nav' : 'on';
  $('#fabMe').classList.toggle('on', mode === 'on');
  $('#fabMe').classList.toggle('nav', mode === 'nav');
  if (mode !== fabMode) { fabMode = mode; $('#fabMe').innerHTML = ic(mode === 'nav' ? 'nav' : mode === 'on' ? 'locate' : 'locateOff'); }
};
// 첫 번째: 내 자리로 다시 날아가(화면 갱신) 따라간다. 지도 방향은 그대로.
// 두 번째: 진행 방향 고정 — 나는 가운데, 가는 방향이 늘 위, 배율은 지금 그대로. 지도가 내 걸음에 맞춰 돌고 움직인다.
// 세 번째: 따라가기를 푼다
$('#fabMe').onclick = () => {
  if (!G.pos[net.me()]) { toast(watchId != null ? '내 위치를 찾는 중이에요. 잠시만요.' : '먼저 위치 공유를 켜 주세요.'); return; }
  startCompass();
  const mode = W.following() !== net.me() ? '' : W.headingUp() ? 'nav' : 'on';
  if (mode === '') { W.follow(net.me(), false); W.flyTo(G.pos[net.me()], 140); }
  else if (mode === 'on') { W.follow(net.me(), true); toast('진행 방향 고정 — 내가 가는 방향이 늘 위로 와요', 'nav'); }
  else { W.follow(null); toast('따라가기를 껐어요', 'locateOff'); }
  setFab();
};
setFab();
W.on('unfollow', setFab);
// 폰 나침반: 안드로이드는 deviceorientationabsolute(alpha는 반시계), 아이폰은 webkitCompassHeading(누른 뒤 허락을 받아야 한다).
// 나침반이 없는 기기(PC)는 걸어간 방향으로 돌린다
let compassOn = false, phoneHeading = null, headingAt = 0; // 조준 카메라 화살표도 쓴다
function startCompass() {
  if (compassOn || !window.DeviceOrientationEvent) return;
  const on = e => {
    const h = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null);
    W.setCompass(h == null ? null : h + (screen.orientation?.angle || 0)); // 가로로 들면 그만큼 더한다
    if (h != null) { phoneHeading = h + (screen.orientation?.angle || 0); headingAt = Date.now(); }
  };
  const listen = () => (compassOn = true) && window.addEventListener('ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation', on);
  // 아이폰은 단추를 누른 순간에만 물을 수 있다 — 그 밖에서 부르면 조용히 넘어가고 다음 누름에 다시 묻는다
  if (DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(r => r === 'granted' && listen()).catch(() => {});
  else listen();
}
$('#fabAll').onclick = () => { W.resetView(); setFab(); };
// 주머니 모드: 브라우저는 화면이 꺼지면 위치를 멈추므로, 화면은 켜 둔 채 까맣게 덮고 3D 그리기를 멈춰 배터리를 아낀다.
// 주머니 속에서 눌리지 않게 1초 길게 눌러야 풀린다
let pocketT = null, holdT = null;
$('#fabPocket').onclick = () => {
  if (!myLL) { toast('먼저 위치 공유를 켜 주세요.'); return; }
  $('#pocket').hidden = false;
  W.stop();
  keepAwake();
  document.documentElement.requestFullscreen?.().catch(() => {}); // 위쪽 알림줄까지 가린다 (아이폰은 안 돼도 그만)
  pocketTick();
  pocketT = setInterval(pocketTick, 1000);
};
function pocketOff() {
  $('#pocket').hidden = true;
  clearInterval(pocketT); pocketT = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  W.start();
}
function pocketTick() {
  const on = watchId != null || sim || FAKE;
  // 다시 올리기(8초마다)가 아니라 GPS가 실제로 새 값을 준 때로 센다
  const ago = fixAt ? Math.round((Date.now() - fixAt) / 1000) : null;
  const late = watchId != null && ago != null && ago > 120; // 8초마다 보내니 2분 넘게 조용하면 위치가 안 잡히는 것 (가만히 서 있으면 폰이 새 값을 늦게 주기도 해서 넉넉히)
  const sl = on && sendLate(), sAgo = ackAt ? Math.round((Date.now() - ackAt) / 1000) : null;
  $('#pkBox').classList.toggle('warn', !on || late || sl);
  $('#pkState').textContent = !on ? '위치 공유가 꺼져 있어요' : sl ? '서버로 위치가 안 가요 — 인터넷 확인' : late ? '2분 넘게 새 위치가 없어요' : '위치 보내는 중';
  $('#pkSub').textContent = on && ago != null ? `${ago < 5 ? '방금' : ago + '초 전'} 위치 받음 · 오차 ${myLL?.acc ?? '-'}m${sAgo != null ? ` · 서버 확인 ${sAgo < 5 ? '방금' : sAgo + '초 전'}` : ''}` : '';
  // 화면에 글씨 자국이 남지 않게 30초마다 자리를 옮긴다
  if (Math.floor(Date.now() / 1000) % 30 === 0) $('#pkBox').style.top = 18 + Math.random() * 56 + '%';
}
// 1초 채우면 풀 준비만 하고, 손을 뗀 뒤 잠깐 있다 걷는다 — 바로 걷으면 손 뗄 때의 누름이 아래 목록·지도에 떨어진다
let armed = false;
$('#pocket').addEventListener('pointerdown', e => {
  e.preventDefault();
  armed = false;
  $('#pocket').classList.add('hold');
  holdT = setTimeout(() => (armed = true), 1000);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(k => $('#pocket').addEventListener(k, () => {
  clearTimeout(holdT);
  $('#pocket').classList.remove('hold');
  if (armed) { armed = false; setTimeout(pocketOff, 400); }
}));
$('#pocket').addEventListener('contextmenu', e => e.preventDefault());
$('#fabLayer').onclick = () => {
  const layer = G.meta.layer === 'map' ? 'sat' : 'map';
  if (isHost()) net.saveMeta(G.code, { layer });
  else { G.meta.layer = layer; onMeta(); } // 참가자는 내 화면에서만 바꾼다
};
// 3D 건물 켜고 끄기: 내 화면에서만, 기기에 기억한다 (처음엔 켬)
const setBld = v => { W.setBuildings(v); $('#fabBld').classList.toggle('on', v); store.set('bld', v ? null : 'off'); };
setBld(store.get('bld') !== 'off');
$('#fabBld').onclick = () => setBld(!$('#fabBld').classList.contains('on'));
W.on('tapPlayer', focusPlayer);
// 같은 자리(15m 안)에 미션이 여럿이면 빛기둥이 겹쳐 위의 것만 눌리므로, 어느 미션인지 고르게 한다
W.on('tapMission', id => {
  const m = G.missions[id];
  const here = m ? sortedMissions().filter(([, x]) => dist(x, m) < 15) : [];
  if (here.length < 2) return openMission(id);
  openSheet(`<p class="eyebrow">이 자리의 미션 ${here.length}개</p><h3>어느 미션을 볼까요?</h3>${missionItems(here)}`, el =>
    el.querySelectorAll('.item[data-m]').forEach(n => (n.onclick = () => openMission(n.dataset.m))));
});
W.on('tapGround', ll => {
  if (placing) { const f = placing; placing = null; $('#placing').hidden = true; f(ll); return; }
  if (sim) setMyPos({ lat: ll.lat, lng: ll.lng, acc: 3 });
});

/* ---------- 내 위치: 끔 · GPS · 테스트 모드 ---------- */
// 테스트 모드: 게임 지역 밖(예: 대전에서 전주 게임)에서 시험할 때 GPS 대신 지도를 눌러 내 자리를 정한다.
// 다음에 들어올 때도 같은 방식으로 이어지게 기기에 기억한다
let watchId = null, lastSent = null, wake = null, sim = false, gpsAt = 0;
$('#gpsBtn').onclick = () => setMode('gps');
$('#simBtn').onclick = () => setMode('sim');
function setMode(mode) {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  wake?.release?.().catch(() => {}); wake = null; wakeVid?.pause();
  sim = mode === 'sim';
  W.setGroundFirst(sim);
  $('#gpsBtn').hidden = mode === 'gps';
  $('#simBtn').hidden = mode === 'sim' || !isHost(); // 테스트 모드는 진행자만 (참가자가 잘못 눌러 현장에 없는 것처럼 되지 않게)
  if (!DEMO && !FAKE) store.set('posMode', mode);
  if (mode === 'off') {
    // 끄면 내 좌표를 지워 다른 사람 지도에서도 내 인형이 사라진다
    myLL = null; lastSent = null; ackAt = pendAt = 0; ackErr = false; sendState();
    if (G.code) net.clearPos(G.code);
    gpsText('위치 공유가 꺼져 있어요');
    return;
  }
  if (mode === 'sim') {
    gpsText('테스트 모드: 현장에 있는 것처럼 — 지도를 누르면 내 인형이 그리로 걸어가요');
    // 아직 자리가 없으면 게임 지역 가운데에 세운다 (GPS로 받은 먼 좌표도 버린다). 그리고 현장에 선 내 모습으로 바로 데려간다
    simHome();
    if (myLL) { W.follow(net.me()); W.flyTo(myLL, 140); setFab(); }
    return;
  }
  if (FAKE) { setMyPos(FAKE); return; }
  if (!navigator.geolocation) { gpsText('이 기기는 위치를 알 수 없어요.'); setMode('off'); return; }
  gpsText('위치를 찾는 중…');
  gpsAt = Date.now();
  startWatch();
  // 화면이 꺼지면 브라우저가 위치를 멈추므로 켜 둔다
  keepAwake();
}
// 위치 받기를 (다시) 건다. 폰은 다른 앱에 다녀오거나 GPS를 다른 앱과 나눠 쓴 뒤 이 브라우저에 새 값을 안 주기도 한다
// (다른 내비를 켰다 끄면 그제야 움직였다) — 그래서 돌아올 때와 오래 조용할 때 새로 건다
let rawAt = 0; // 폰이 값을 준 마지막 때 (걸러서 버린 값도)
function startWatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  rawAt = Date.now();
  watchId = navigator.geolocation.watchPosition(
    p => {
      rawAt = Date.now();
      // 자리부터 올린다 — 아래 방향 처리에서 무슨 일이 나도 위치는 멈추지 않게
      const f = cleanFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, v: p.coords.speed }); if (f) setMyPos(f);
      // 움직이는 중이면 GPS가 알려 주는 이동 방향을 진행 방향으로 (폰을 어느 쪽으로 들었든)
      try { if (p.coords.speed > 0.8 && Number.isFinite(p.coords.heading)) W.setCourse?.(p.coords.heading); } catch {}
    },
    e => {
      // 권한 거절만 다시 켜는 단추를 보인다. 시간 초과는 위치 찾기가 계속 돌고 있으니 기다리면 된다.
      // 카카오톡·네이버 같은 앱 안 브라우저는 폰에서 허용해도 위치를 막기도 한다. 권한 거절은 다시 걸어도 소용없으니 멈춤 감시에서 뺀다
      if (e.code === 1) { rawAt = Infinity; gpsText(INAPP ? '이 앱 안에서는 위치를 쓸 수 없어요 — 오른쪽 위 메뉴에서 크롬·사파리로 열어 주세요' : '위치 권한이 꺼져 있어요. 브라우저 설정에서 이 사이트의 위치를 허용해 주세요.'); $('#gpsBtn').hidden = false; }
      else if (!myLL) gpsText('위치를 아직 못 찾았어요 — 하늘이 보이는 곳에서 잠시 기다려 주세요');
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }); // 묵은 값을 다시 받으면 평균이 속으니 늘 새로 잰 값만
}
// 다른 앱에 다녀오면 화면 켜 두기가 풀리고 위치 받기도 멈춰 있을 수 있으므로 둘 다 다시 건다
document.addEventListener('visibilitychange', () => {
  if (document.hidden || watchId == null) return;
  keepAwake();
  startWatch();
});
/* 화면 켜 두기: 화면이 꺼지면 브라우저가 위치를 멈춘다. Wake Lock을 걸고, 시스템이 풀어 버리면(절전 등) 1초 뒤 다시 건다.
   거절당하면(손길이 있어야 하는 브라우저) 다음에 화면을 만질 때 다시. Wake Lock이 없는 예전 브라우저는 소리 없는 작은 영상을
   반복 재생해 꺼짐을 막는다 */
let wakeVid = null;
const awake = () => (wake && !wake.released) || (wakeVid && !wakeVid.paused);
function keepAwake() {
  if (document.hidden || awake()) return;
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').then(w => {
      wake = w;
      w.addEventListener('release', () => { if (wake === w) wake = null; if (watchId != null && !document.hidden) setTimeout(keepAwake, 1000); });
    }).catch(() => {});
    return;
  }
  if (!wakeVid) {
    wakeVid = Object.assign(document.createElement('video'), { src: 'assets/awake.mp4', muted: true, loop: true, playsInline: true });
    wakeVid.setAttribute('playsinline', '');
    wakeVid.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(wakeVid);
  }
  wakeVid.play().catch(() => {});
}
document.addEventListener('pointerdown', () => { if (watchId != null) keepAwake(); }, { passive: true });
// 화면을 보고 있는데 12초 넘게 폰이 아무 값도 안 주면 위치 받기가 멈춘 것으로 보고 새로 건다 (서 있어도 폰은 몇 초마다 준다)
setInterval(() => { if (watchId != null && !document.hidden && Date.now() - rawAt > 12000) startWatch(); }, 4000);
const gpsText = t => ($('#gpsText').textContent = t);
// 게임 정보(meta)가 아직 안 왔으면 onMeta에서 다시 부른다
function simHome() {
  const c = G.meta.center;
  if (sim && c && (!myLL || dist(myLL, c) > (G.meta.radius || 600) * 1.5)) setMyPos({ lat: c.lat, lng: c.lng, acc: 3 });
}
const INAPP = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps/i.test(navigator.userAgent);
// GPS 다듬기: 이상한 값을 먼저 거르고, 걸을 땐 최근 4초 값을 정확도로 가중 평균해(1/오차²) 흔들리지 않게 한다
//  ① 오차가 튀는 값: 좋은 값(30m 이내)을 받은 지 20초 안에 오차가 그 세 배 넘고 50m 넘는 값, 1분 안에 좋은 값이 있었는데 150m 넘는 값
//  ② 순간이동: 앞 값에서 (두 값의 오차를 빼고도) 시속 160km(45m/s)보다 빨라야 닿는 자리. 단 그런 값이 연달아 세 번 오고
//     그 셋끼리는 말이 되는 속도로 이어지면(차로 달리는 중이어도) 정말 옮긴 것으로 받는다
//     — 예전엔 셋이 30m 안에 모여야 받아서, 앱을 켤 때의 기지국 값에 걸린 채 차로 달리면 처음 자리에 계속 멈춰 있었다
//  ③ 4초 묶음에서 혼자 튀는 값: 묶음 가운데(중앙값)에서 오차의 두 배(최소 8m)보다 먼 값은 평균에서 뺀다
//  빠르게 움직이면(초속 3m 넘게, 차·버스) 평균 내지 않고 방금 값을 그대로 쓴다 — 평균하면 수십 m씩 늦는다
let fixes = [], goodAt = 0, goodAcc = Infinity, odd = [];
const median = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const tooFast = (a, b) => Math.max(0, dist(a, b) - (a.acc || 0) - (b.acc || 0)) / Math.max(0.5, Math.abs(b.t - a.t) / 1000) > 45;
function cleanFix(p) {
  const now = Date.now(), f0 = { ...p, t: now };
  if (p.acc <= 30) { goodAt = now; goodAcc = p.acc; }
  else if ((now - goodAt < 20000 && p.acc > goodAcc * 3 && p.acc > 50) || (now - goodAt < 60000 && p.acc > 150)) return null;
  const prev = fixes[fixes.length - 1];
  if (prev && tooFast(prev, f0)) {
    odd.push(f0);
    if (odd.length > 3) odd.shift();
    const chain = odd.length === 3 && !tooFast(odd[0], odd[1]) && !tooFast(odd[1], odd[2]);
    if (!chain) return null;
    fixes = odd; odd = []; // 세 번 이어서 같은 쪽 — 정말 옮겼다 (방금 값도 이 안에 있다)
  } else {
    odd = [];
    fixes.push(f0);
  }
  fixes = fixes.filter(f => now - f.t < 4000);
  const first = fixes[0], v = first && first !== fixes[fixes.length - 1] ? dist(first, f0) / Math.max(0.5, (now - first.t) / 1000) : 0;
  if (p.v > 3 || v > 3) return { lat: p.lat, lng: p.lng, acc: Math.max(1, Math.round(p.acc)) };
  const mLat = median(fixes.map(f => f.lat)), mLng = median(fixes.map(f => f.lng));
  let keep = fixes.filter(f => dist({ lat: mLat, lng: mLng }, f) <= Math.max(8, f.acc * 2));
  if (!keep.length) keep = [fixes[fixes.length - 1]];
  let w = 0, lat = 0, lng = 0;
  keep.forEach(f => { const k = 1 / (f.acc * f.acc); w += k; lat += f.lat * k; lng += f.lng * k; });
  // 연달아 잰 값의 오차는 서로 닮아서 개수만큼 줄지는 않는다 — 가장 좋은 값의 절반 아래로는 말하지 않는다
  const best = Math.min(...keep.map(f => f.acc));
  return { lat: lat / w, lng: lng / w, acc: Math.max(1, Math.round(Math.max(best / 2, 1 / Math.sqrt(w)))) };
}
// 게임 지역에서 이만큼 넘게 떨어진 위치는 기기가 잘못 알려 준 것으로 본다 (PC 브라우저의 와이파이 위치가 베이징으로 잡힌 일이 있었다)
const WILD = 100e3;
// 서버 전송 확인: 올린 위치를 서버가 받았다고 답한 때(ackAt). 답을 못 받은 채 기다린 지 오래면(pendAt) 인터넷이 끊긴 것
let ackAt = 0, pendAt = 0, ackErr = false;
function sendPos(p) {
  lastSent = { ...p, at: Date.now() };
  pendAt ||= Date.now();
  net.writePos(G.code, sim ? { ...p, sim: true } : p)
    .then(() => { ackAt = Date.now(); pendAt = 0; ackErr = false; sendState(); })
    .catch(() => { ackErr = true; sendState(); });
}
// 내 폰에서도 내 위치가 서버에 들어가는지 보이게: 제목 줄 오른쪽 끝 전파 표시. 받을 때마다 초록으로 한 번 퍼지고, 30초 넘게 답이 없거나 거절되면 빨갛게
const SEND_LATE = 30e3;
const sendLate = () => ackErr || (pendAt && Date.now() - pendAt > SEND_LATE);
let pingAt = 0;
function sendState() {
  const el = $('#sendIc'), on = watchId != null || sim || FAKE;
  el.hidden = !on || (!ackAt && !pendAt);
  if (el.hidden) return;
  const late = !!sendLate();
  el.classList.toggle('late', late);
  // 새로 받았으면 전파를 한 번 퍼뜨린다 (애니메이션을 처음부터 다시)
  if (!late && ackAt > pingAt) { pingAt = ackAt; el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
  const s = Math.round((Date.now() - ackAt) / 1000);
  el.title = ackErr ? '서버가 위치를 받지 않아요 — 눌러서 다시 요청' : late ? '서버로 위치가 안 가요 — 눌러서 다시 요청'
    : ackAt ? `서버 전송 ✓ ${s < 3 ? '방금' : s + '초 전'}` : '서버로 보내는 중…';
}
// 누르면: 빨간 때는 위치 받기를 새로 걸고 마지막 자리를 다시 올린다, 초록일 땐 언제 보냈는지 알려 준다
$('#sendIc').onclick = () => {
  if (sendLate() || !ackAt) {
    if (watchId != null) startWatch();
    ackErr = false; pendAt = 0;
    if (myLL && G.code) sendPos(myLL);
    sendState();
    toast('위치를 다시 요청했어요', 'signal');
  } else toast($('#sendIc').title, 'signal');
};
setInterval(sendState, 1000);
// 가만히 서 있으면 폰이 새 값을 안 줄 수 있다 — 8초 넘게 조용하면 마지막 자리를 다시 올려 다른 사람 화면에서 흐려지지 않게
setInterval(() => { if (G.code && myLL && watchId != null && lastSent && Date.now() - lastSent.at > 8000) sendPos(myLL); }, 2000);
let fixAt = 0; // 마지막으로 새 위치를 받은 때
function setMyPos(p) {
  fixAt = Date.now();
  if (!sim && G.meta.center && dist(p, G.meta.center) > WILD) {
    gpsText(`기기가 알려 준 위치가 이상해요 (게임 지역에서 ${fmtDist(dist(p, G.meta.center))}) — 폰에서 '정확한 위치'를 켜거나 테스트 모드를 써 주세요`);
    return;
  }
  myLL = p;
  W.setAccuracy(net.me(), sim ? 0 : p.acc);
  const first = !lastSent;
  const away = !sim && G.meta.center ? dist(p, G.meta.center) - (G.meta.radius || 600) : 0;
  gpsText(sim ? '테스트 모드: 현장에 있는 것처럼 — 지도를 누르면 내 인형이 그리로 걸어가요'
    // 수백 m 오차는 대개 '대략적 위치'만 허용된 것 (안드로이드 12+, iOS '정확한 위치' 끔).
    // 다만 켠 직후엔 정확한 위치도 기지국 값부터 오므로 15초는 기다려 본다
    : p.acc > 300 && Date.now() - gpsAt < 15000 ? `위치를 더 정확히 잡는 중 · 오차 ${fmtDist(p.acc)}`
    : p.acc > 300 ? `위치가 대략적으로만 잡혀요 (오차 ${fmtDist(p.acc)}) — 폰 설정에서 이 사이트의 '정확한 위치'를 켜 주세요`
    : away > 0 ? `게임 지역에서 ${fmtDist(away)} 밖 · 오차 ${p.acc}m` : `위치 공유 중 · 오차 ${p.acc}m${p.acc > 40 ? ' (실내면 커요)' : ''}`);
  // 새 위치를 받을 때마다 바로 올린다 (폰은 1초에 한 번쯤 준다). 테스트 모드 표시(sim): 누를 때마다 뛰어가는 자리라 차·버스 계산에서 뺀다
  sendPos(p);
  if (first) { startCompass(); W.follow(net.me()); W.flyTo(p, 140); setFab(); }
  checkArrive();
  if (tab === 'missions') renderPanel();
}

/* ---------- 미션 수행 ---------- */
// 술래잡기 구역은 늘 게임 지역 전체(연두색 띠) — 진행자가 지역을 바꾸면 함께 따라간다. 미션에 적힌 자리·반경은 쓰지 않는다
const zone = m => (m.type === 'tag' && G.meta.center ? { lat: G.meta.center.lat, lng: G.meta.center.lng, r: G.meta.radius || m.r } : m);
const near = m => { const z = zone(m); return myLL && (!z.r || dist(myLL, z) <= z.r + Math.min(myLL.acc || 0, 15)); }; // GPS 오차를 15m까지는 봐준다
const busy = new Set();
// 미션을 할 수 있는 사람: 개인전은 누구나, 팀전은 팀이 있어야
const canPlay = () => solo() || !!myTeam();
// 깜짝 미션(제한 시간): limit(분)을 정하면 열리는 순간부터 until(시각)까지만 할 수 있다. 게임 끝나는 시간은 넘기지 않는다
const expired = m => !!m.until && Date.now() >= m.until;
// openAt(연 시각)을 따로 두어 끝나는 시간을 늦추면 다시 계산한다(reTime)
const capUntil = (m, openAt, end = G.meta.endAt) => Math.min(openAt + m.limit * 60e3, end > Date.now() ? end : Infinity);
const startUntil = m => capUntil(m, Date.now());
const late = id => expired(G.missions[id] || {}); // 창을 연 사이 시간이 끝났는지 (보내기 직전에 다시 본다)
// 게임 시작(다시 시작) 때: 열려 있는 깜짝 미션의 시계를 그때부터 건다 — 시작 전에 만든 미션이 미리 끝나 버리지 않게
async function armTimed() {
  for (const [id, m] of Object.entries(G.missions)) {
    if (!m.limit || m.open === false || (m.until && !expired(m))) continue;
    const now = Date.now();
    await net.saveMission(G.code, id, { ...m, openAt: now, until: startUntil(m) });
    net.say(G.code, '', `깜짝 미션! '${m.title}' — ${m.limit}분 안에 해내세요`);
  }
}
// 끝나는 시간을 바꾸면 돌고 있는 깜짝 미션의 마감도 다시 (연 시각 + 제한 시간, 끝나는 시간까지)
async function reTime(end) {
  for (const [id, m] of Object.entries(G.missions)) {
    if (!m.limit || !m.openAt || m.open === false || Date.now() >= m.openAt + m.limit * 60e3) continue;
    const u = capUntil(m, m.openAt, end);
    if (u !== m.until) await net.saveMission(G.code, id, { ...m, until: u });
  }
}
const cd = m => (m.until ? `<span class="cd" data-until="${m.until}">${expired(m) ? '시간 끝' : left(m.until - Date.now())}</span>` : ''); // 1초마다 tickTimer가 고친다
// 열고 닫기: 깜짝 미션은 열 때 시계를 새로 건다 (모두에게 알리고)
async function setOpen(id, m, open) {
  const v = { ...m, open };
  delete v.until; delete v.openAt;
  if (open && m.limit && isLive()) { v.openAt = Date.now(); v.until = startUntil(m); } // 시작 전이면 시작할 때 건다(armTimed)
  await net.saveMission(G.code, id, v);
  if (open && m.limit && isLive()) net.say(G.code, '', `깜짝 미션! '${m.title}' — ${Math.round((v.until - Date.now()) / 60e3)}분 안에 해내세요`);
}
/* ---------- 술래잡기 (술래 사진 찍기) ----------
   진행자가 팀마다 술래를 한 명씩 정한다(mission.it = {팀: uid}). 술래는 지도에 '술래'로 보인다.
   다른 팀 술래를 찾아 게임 지역(연두색 띠) 안에서 사진을 찍어 올리면(누구를 찍었는지 caught) 진행자가 확인하고,
   먼저 인정받은 팀이 이긴다 — GPS 거리로 자동 판정하던 것은 오차가 커서 사진으로 바꿨다.
   진행자 술래 모드(mission.itHost = 진행자 uid): 진행자 한 명이 모든 팀의 술래. 팀마다 진행자 사진을 찍어 인정받으면 그 팀에 점수
   (팀마다 한 번, 한 팀이 잡아도 끝나지 않는다) */
const tagWinner = id => (G.missions[id]?.itHost ? null : Object.keys(G.teams).find(t => G.done[t]?.[id]?.status === 'ok'));
const tagLive = ([id, m]) => m.type === 'tag' && m.open !== false && !tagWinner(id);
const itsOf = m => (m.itHost ? [m.itHost] : Object.values(m.it || {}));
const isIt = uid => isLive() && Object.entries(G.missions).some(e => tagLive(e) && itsOf(e[1]).includes(uid));
const itName = (m, tid) => G.members[m.it?.[tid]]?.name || '?';
function tagInfo(id, m, live) {
  if (m.itHost) return hostTagInfo(id, m, live);
  const its = Object.entries(m.it || {}).map(([tid, u]) => `<span class="pill"><span class="dot" style="background:${esc(teamOf(tid).color)}"></span> ${esc(teamOf(tid).name)} ${esc(G.members[u]?.name || '?')}</span>`).join('');
  const win = tagWinner(id), me = net.me(), t = myTeam(), d = G.done[t]?.[id];
  const targets = Object.keys(m.it || {}).filter(tid => tid !== t && G.teams[tid]);
  let role;
  if (win) { const w = G.done[win][id], ct = G.members[w.caught]?.team; role = `${ic('trophy')} <b>${esc(teamOf(win).name)}</b> 승리! (${esc(w.name)} — ${esc(ct ? teamOf(ct).name + ' 술래 ' : '')}${esc(G.members[w.caught]?.name || '')} 사진)`; }
  else if (!live) role = G.meta.status === 'ended' || timeUp() ? '게임이 끝났어요.' : '진행자가 게임을 시작하면 열려요.';
  else if (m.it?.[t] === me) role = `${ic('tag')} <b>내가 술래!</b> 다른 팀에게 사진 찍히지 않게 피해 다녀요. 찍혀서 진행자가 인정하면 그 팀이 이겨요.`;
  else if (d?.status === 'wait') role = `${ic('wait')} 우리 팀이 올린 술래 사진을 진행자가 확인하고 있어요.`;
  else if (!near(m)) role = `게임 지역(지도의 연두색 띠) 안으로 들어가면 술래 사진을 올릴 수 있어요. 우리 팀 술래 <b>${esc(itName(m, t))}</b>는 지켜 주세요!`;
  else role = `다른 팀 술래를 찾아 <b>사진</b>을 찍어 올려요. 진행자가 확인하면 승리! (우리 팀 술래 <b>${esc(itName(m, t))}</b>는 지켜 주세요)`;
  const up = live && !win && m.it?.[t] !== me && !d && near(m) && targets.length && canPlay()
    ? `<label>누구를 찍었나요?<select id="tagWho">${targets.map(tid => `<option value="${esc(m.it[tid])}">${esc(teamOf(tid).name)} 술래 ${esc(itName(m, tid))}</option>`).join('')}</select></label>
       <button class="btn wide primary" id="tagCam">${ic('aim')} 술래 조준해서 찍기</button>
       <label class="aim-alt">기본 카메라로 찍기<input type="file" accept="image/*" capture="environment" id="tagPhoto" hidden></label><p class="msg" id="qMsg"></p>` : '';
  return `<div class="teamrow">${its}</div>${retryNote(m)}<div class="box">${role}</div>${up}`;
}
// 이름 뒤 을/를: 마지막 글자에 받침이 있으면 '을'
const josa = s => { const c = String(s).slice(-1).charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '을' : '를'; };
// 진행자 술래: 모든 팀이 진행자 한 명을 쫓는다. 잡은(인정받은) 팀은 점수, 다른 팀은 계속
function hostTagInfo(id, m, live) {
  const me = net.me(), t = myTeam(), d = G.done[t]?.[id], hn = G.members[m.itHost]?.name || '진행자';
  let role;
  if (!live) role = G.meta.status === 'ended' || timeUp() ? '게임이 끝났어요.' : '진행자가 게임을 시작하면 열려요.';
  else if (me === m.itHost) role = `${ic('tag')} <b>내가 술래!</b> 모든 팀이 나를 찾아 사진을 찍으러 와요. 찍혀서 인정되면 그 팀이 ${m.pts || 0}점을 받아요.`;
  else if (d?.status === 'ok') role = `${ic('check')} 우리 팀이 진행자 술래를 잡았어요! (+${m.pts || 0}점)`;
  else if (d?.status === 'wait') role = `${ic('wait')} 우리 팀이 올린 술래 사진을 확인하고 있어요.`;
  else if (!near(m)) role = `게임 지역(지도의 연두색 띠) 안으로 들어가면 술래 사진을 올릴 수 있어요.`;
  else role = `진행자 술래 <b>${esc(hn)}</b>${josa(hn)} 찾아 <b>사진</b>을 찍어 올려요. 인정되면 우리 팀 +${m.pts || 0}점! 지도에 '술래'로 보여요.`;
  const up = live && me !== m.itHost && !d && near(m) && canPlay()
    ? `<select id="tagWho" hidden><option value="${esc(m.itHost)}">진행자 술래 ${esc(hn)}</option></select>
       <button class="btn wide primary" id="tagCam">${ic('aim')} 술래 조준해서 찍기</button>
       <label class="aim-alt">기본 카메라로 찍기<input type="file" accept="image/*" capture="environment" id="tagPhoto" hidden></label><p class="msg" id="qMsg"></p>` : '';
  return `<div class="box">${ic('tag')} 진행자 술래 · <b>${esc(hn)}</b></div>${retryNote(m)}<div class="box">${role}</div>${up}`; // 팀마다 잡았는지는 미션 창 위의 팀 줄이 보여 준다
}
function checkArrive() {
  if (!isLive() || !canPlay() || !myLL) return;
  Object.entries(G.missions).forEach(([id, m]) => {
    if (m.type !== 'arrive' || m.open === false || expired(m) || myDone(id) || busy.has(id) || !near(m)) return;
    busy.add(id);
    finish(id, m, 'ok').finally(() => busy.delete(id));
  });
}
// 완료를 먼저 쓴다 — 시간이 끝났거나 다른 팀원이 먼저 해냈으면 규칙이 막아 false (사진이 홀로 남지 않게 사진은 그 뒤에, attach)
async function finish(id, m, status, attach) {
  const t = myTeam(), d = { name: profile.name, pts: m.pts || 0, status };
  try {
    if (isEach(m)) await net.completeMine(G.code, id, { ...d, team: t });
    else await net.complete(G.code, t, id, d);
  } catch { return false; }
  if (attach) await attach(); // 실패하면 부른 쪽이 알린다 (진행자 창엔 '사진이 없어요' → 다시 하게)
  net.say(G.code, t, `${solo() ? '' : teamOf(t).name + ' '}${profile.name} — '${m.title}' ${status === 'ok' ? '완료!' : '확인 요청'}${m.each && !solo() ? ' (개인)' : ''}`).catch(() => {});
  return true;
}
const safeData = u => (typeof u === 'string' && /^data:(image|audio)\/[\w.+-]+(;[\w.+=-]+)*;base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '');
const NOPE = '보내지 못했어요 — 깜짝 미션 시간이 끝났거나 이미 해냈어요.';
// 사진 자리: 팀 미션은 팀, 개인 완료는 사람마다
const photoKey = (m, uid = net.me()) => (isEach(m) ? 'u_' + uid : myTeam());
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// 정답 비교: 띄어쓰기·대소문자 무시. 정답 원문은 저장하지 않고 미션 id를 섞은 해시만 둔다
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, '');
const answerHash = (mid, a) => sha(mid + ':' + norm(a));

function openSheet(html, bind) {
  $('#sheetCard').innerHTML = `<button class="x" data-close>×</button>` + html;
  $('#sheet').hidden = false;
  $('#sheet').querySelectorAll('[data-close]').forEach(x => (x.onclick = closeSheet));
  bind?.($('#sheetCard'));
}
const closeSheet = () => { $('#sheet').hidden = true; refresh(); };

function openMission(id) {
  const m = G.missions[id];
  if (!m) return;
  W.flyTo(m, 160); W.follow(null); setFab();
  const d = myDone(id), live = isLive(), each = isEach(m);
  // 개인 미션은 팀마다 해낸 사람 수(개인전은 전체 수), 팀 미션은 팀마다 ✓
  const others = solo() ? `<span class="pill">${ic('check')} ${eachDone(id).length}명 해냈어요</span>` : Object.entries(G.teams).map(([tid, tm]) => {
    const x = G.done[tid]?.[id], n = eachDone(id).filter(([, y]) => y.team === tid).length;
    return `<span class="pill ${each ? (n ? 'ok' : '') : x?.status || ''}"><span class="dot" style="background:${esc(tm.color)}"></span> ${esc(tm.name)} ${each ? n + '명' : x?.status === 'ok' ? ic('check') : x ? ic('wait') : '—'}</span>`;
  }).join('');
  let act = '';
  if (m.type === 'tag') act = tagInfo(id, m, live);
  else if (d?.status === 'ok') act = `<div class="box">${ic('check')} ${each ? `해냈어요 (${clock(d.t)})` : `우리 팀이 해냈어요 (${esc(d.name)}, ${clock(d.t)})`}</div>`;
  else if (d?.status === 'wait') act = `<div class="box">${ic('wait')} 진행자가 확인하고 있어요.</div>`;
  else if (!canPlay()) act = `<div class="box">팀에 들어가야 미션을 할 수 있어요.</div>`;
  else if (!live) act = `<div class="box">${G.meta.status === 'ended' || timeUp() ? '게임이 끝났어요.' : '진행자가 게임을 시작하면 열려요.'}</div>`;
  else if (expired(m)) act = `<div class="box">${ic('clock')} 깜짝 미션 시간이 끝났어요.</div>`;
  else if (!near(m)) act = retryNote(m) + `<div class="box">${myLL ? `${fmtDist(dist(myLL, m))} 남았어요. ` : '위치 공유를 켜 주세요. '}반경 ${m.r}m 안으로 가면 ${m.type === 'arrive' ? '저절로 완료돼요' : '열려요'}.</div>`;
  else if (m.type === 'quiz') act = retryNote(m) + `<div class="box">${esc(m.q)}</div><form class="row" id="qForm"><input id="qAns" placeholder="정답" autocomplete="off"><button class="btn primary">제출</button></form><p class="msg" id="qMsg"></p>`;
  else if (m.type === 'photo') act = retryNote(m) + `<label class="btn wide primary" style="text-align:center">${ic('camera')} 사진 찍어 올리기<input type="file" accept="image/*" capture="environment" id="photoIn" hidden></label><p class="msg" id="qMsg"></p>`;
  else if (m.type === 'task') act = retryNote(m) + `<button class="btn wide primary" id="taskBtn">${ic('flag')} 해냈어요 — 진행자에게 확인 요청</button>`;
  else if (m.type === 'voice') act = retryNote(m) + `<div class="rec" id="rec"></div><p class="msg" id="qMsg"></p>`;
  else act = `<div class="box">도착! 곧 완료돼요.</div>`;
  // 테스트 모드: 미션 자리로 바로 옮겨 가 본다
  if (sim && !d) act += `<button class="btn wide" id="simGo">${ic('flask')} 여기로 이동 (테스트)</button>`;
  const host = isHost() ? `<div class="hostgrid"><button class="btn small" id="mEdit">수정</button><button class="btn small" id="mToggle">${m.open === false ? '열기' : '닫기'}</button><button class="btn small danger" id="mDel">삭제</button></div>` : '';
  openSheet(`<p class="eyebrow">${tic(m.type)} ${TYPES[m.type]?.[1]}${solo() ? '' : m.each ? ' · 개인 미션 — 팀원 각자 해서 팀 점수에 보태요' : m.type === 'tag' ? '' : ' · 팀 미션 — 팀에서 한 명만 하면 돼요'} · ${m.pts || 0}점</p><h3>${esc(m.title)}</h3>
    ${m.desc ? `<p class="fine">${esc(m.desc)}</p>` : ''}${m.until && m.open !== false && !expired(m) && !d ? `<div class="box warn">${ic('clock')} 깜짝 미션 — 남은 시간 <b>${cd(m)}</b></div>` : ''}<div class="teamrow">${others}</div>${act}${host}`, el => {
    el.querySelector('#qForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const a = el.querySelector('#qAns').value;
      const ok = m.ah ? (await answerHash(id, a)) === m.ah : norm(a) === norm(m.ans || '');
      if (ok && (late(id) || !(await finish(id, m, 'ok')))) { const q = el.querySelector('#qMsg'); q.className = 'msg err'; q.textContent = NOPE; return; }
      if (ok) { closeSheet(); toast('정답이에요!', 'party'); }
      else { const q = el.querySelector('#qMsg'); q.className = 'msg err'; q.textContent = '아니에요. 다시 생각해 보세요.'; }
    });
    el.querySelector('#photoIn')?.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      const q = el.querySelector('#qMsg'), err = t => { q.className = 'msg err'; q.textContent = t; };
      if (late(id)) return err(NOPE);
      q.textContent = '올리는 중…';
      try {
        const url = await shrink(f);
        if (!(await finish(id, m, 'wait', () => net.savePhoto(G.code, photoKey(m), id, url)))) return err(NOPE);
        closeSheet(); toast('사진을 올렸어요. 진행자가 확인하면 점수가 올라가요.');
      } catch (er) { err('올리지 못했어요 (' + (er.code || er.message) + ')'); }
    });
    el.querySelector('#simGo')?.addEventListener('click', () => { closeSheet(); setMyPos({ lat: m.lat, lng: m.lng, acc: 3 }); setTimeout(() => openMission(id), 300); });
    el.querySelector('#taskBtn')?.addEventListener('click', async () => { if (late(id) || !(await finish(id, m, 'wait'))) { toast(NOPE, 'clock'); return; } closeSheet(); toast('확인을 요청했어요.'); });
    if (el.querySelector('#rec')) voiceRecorder(el, id, m);
    // 술래 사진 보내기: 조준 카메라와 기본 카메라가 함께 쓴다. 실패하면 throw (조준 카메라는 그 화면에 알린다)
    const sendTag = async (url, who) => {
      const t = myTeam();
      if (late(id)) throw new Error(NOPE);
      await net.complete(G.code, t, id, { name: profile.name, pts: m.pts || 0, status: 'wait', caught: who }); // 완료 먼저 (사진이 홀로 남지 않게)
      await net.savePhoto(G.code, t, id, url);
      await net.say(G.code, t, `${teamOf(t).name} ${profile.name} — ${m.itHost ? '진행자' : teamOf(G.members[who]?.team).name} 술래 ${G.members[who]?.name} 사진! '${m.title}' 확인 요청`);
      closeSheet(); toast('술래 사진을 올렸어요. 진행자가 확인하면 승리!', 'tag');
    };
    el.querySelector('#tagPhoto')?.addEventListener('change', async e => {
      const f = e.target.files[0], who = el.querySelector('#tagWho').value;
      if (!f || !who) return;
      el.querySelector('#qMsg').textContent = '올리는 중…';
      try { await sendTag(await shrink(f), who); }
      catch (er) { el.querySelector('#qMsg').className = 'msg err'; el.querySelector('#qMsg').textContent = er.message === NOPE ? NOPE : '올리지 못했어요 (' + (er.code || er.message) + ')'; }
    });
    el.querySelector('#tagCam')?.addEventListener('click', () => {
      startCompass();
      const targets = [...el.querySelectorAll('#tagWho option')].map(o => ({ uid: o.value, label: o.textContent }));
      aimCamera({ targets, pick: el.querySelector('#tagWho').value, send: sendTag,
        fail: () => { const q = el.querySelector('#qMsg'); q.className = 'msg err'; q.textContent = '카메라를 열 수 없어요(권한이 꺼져 있을 수 있어요). 아래 ‘기본 카메라로 찍기’를 눌러 주세요.'; } });
    });
    el.querySelector('#mEdit')?.addEventListener('click', () => missionForm(id));
    el.querySelector('#mToggle')?.addEventListener('click', async () => { await setOpen(id, m, m.open === false); closeSheet(); });
    el.querySelector('#mDel')?.addEventListener('click', async () => { if (confirmIn(el.querySelector('#mDel'))) { await net.delMission(G.code, id); closeSheet(); } });
  });
}
// 지우기처럼 되돌릴 수 없는 단추는 두 번 눌러야 한다 (브라우저 확인 창 대신)
function confirmIn(btn) {
  if (btn.dataset.sure) return true;
  btn.dataset.sure = 1; btn.textContent = '한 번 더 누르면 지워요';
  return false;
}
// 사진은 긴 변 900px JPEG로 줄여 데이터베이스에 바로 넣는다 (Storage 없이)
// 진행자가 다시 하라고 한 이유: 우리 팀(개인 미션은 나)에게 온 이 미션의 마지막 '다시 해 주세요' 소식
function retryNote(m) {
  const t = myTeam(), f = G.feed.find(f => (solo() || f.team === t) && f.text.includes(`'${m.title}' 다시 해 주세요`) && (!isEach(m) || solo() || f.text.includes(profile.name)));
  const why = f?.text.split('다시 해 주세요')[1]?.replace(/^\s*[—:-]\s*/, '').trim();
  return f ? `<div class="box warn">${ic('megaphone')} 진행자: 다시 해 주세요${why ? ` — <b>${esc(why)}</b>` : ''}</div>` : '';
}
/* ---------- 음성 미션: 현장에서 녹음(노래 한 소절, 팀 구호 등 — 미션 설명대로) → 들어 보고 보내기 → 진행자가 듣고 인정 ----------
   녹음은 사진과 같은 자리(photos)에 data URL로 둔다. 길이는 최대 20초, 32kbps로 작게(규칙의 크기 한도 안) */
const REC_MAX = 20;
function voiceRecorder(el, id, m) {
  const box = el.querySelector('#rec'), msg = el.querySelector('#qMsg');
  let rec = null, chunks = [], timer = null, url = null, blob = null;
  const idle = () => { box.innerHTML = `<button class="btn wide primary" id="recGo">${ic('mic')} 녹음 시작 (최대 ${REC_MAX}초)</button>`; box.querySelector('#recGo').onclick = start; };
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { msg.className = 'msg err'; msg.textContent = '이 브라우저는 녹음을 할 수 없어요. 크롬이나 사파리로 열어 주세요.'; return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { msg.className = 'msg err'; msg.textContent = '마이크 권한이 꺼져 있어요. 브라우저 설정에서 마이크를 허용해 주세요.'; return; }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(timer); blob = new Blob(chunks, { type: rec.mimeType || type }); url = URL.createObjectURL(blob); review(); };
    rec.start();
    const t0 = Date.now();
    box.innerHTML = `<div class="recbar"><span class="recdot"></span> 녹음 중 <b id="recT">0</b>초 / ${REC_MAX}초</div><button class="btn wide danger" id="recStop">■ 그만 — 다 불렀어요</button>`;
    box.querySelector('#recStop').onclick = () => rec.state !== 'inactive' && rec.stop();
    timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const n = box.querySelector('#recT'); if (n) n.textContent = s; if (s >= REC_MAX && rec.state !== 'inactive') rec.stop(); }, 250);
    msg.textContent = '';
  }
  function review() {
    box.innerHTML = `<audio controls src="${url}" class="recplay"></audio>
      <div class="grid2"><button class="btn" id="recAgain">${ic('mic')} 다시 녹음</button><button class="btn primary" id="recSend">보내기 — 진행자 확인</button></div>`;
    box.querySelector('#recAgain').onclick = () => { URL.revokeObjectURL(url); idle(); start(); };
    box.querySelector('#recSend').onclick = async () => {
      msg.className = 'msg'; msg.textContent = '보내는 중…';
      const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      if (data.length > 390000) { msg.className = 'msg err'; msg.textContent = '너무 길어요. 조금 짧게 다시 녹음해 주세요.'; return; }
      try {
        if (late(id) || !(await finish(id, m, 'wait', () => net.savePhoto(G.code, photoKey(m), id, data)))) { msg.className = 'msg err'; msg.textContent = NOPE; return; }
        closeSheet(); toast('녹음을 보냈어요. 진행자가 듣고 인정하면 점수가 올라가요.', 'mic');
      } catch (er) { msg.className = 'msg err'; msg.textContent = '보내지 못했어요 (' + (er.code || er.message) + ')'; }
    };
  }
  idle();
}
/* ---------- 술래 조준 카메라 ---------- */
// 술래 사진은 앱 안에서 카메라를 띄워 찍는다 — 기본 카메라 앱 화면엔 아무것도 그릴 수 없어서. 가운데 표적과 찾을 술래 이름을 띄우고,
// 찍은 사진에도 표적·대상·시각을 새긴다(진행자 확인·사진 모음에서 보인다). 카메라를 못 열면 fail → 기본 카메라로 찍게 안내
// 방위(북에서 시계 방향, 도)와 여덟 방위 이름
const bearingTo = (a, b) => { const r = Math.PI / 180, y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r), x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r); return (Math.atan2(y, x) / r + 360) % 360; };
const compass8 = d => ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(d / 45) % 8];
const RETICLE = `<svg class="aim-ret" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke-linecap="round">
  <circle cx="100" cy="100" r="62" stroke="rgba(0,0,0,.45)" stroke-width="7"/><circle cx="100" cy="100" r="62" stroke="#ff4d4d" stroke-width="3"/>
  <circle cx="100" cy="100" r="5" fill="#ff4d4d" stroke="#fff" stroke-width="1.5"/>
  <path d="M100 18v30M100 152v30M18 100h30M152 100h30" stroke="rgba(0,0,0,.45)" stroke-width="7"/><path d="M100 18v30M100 152v30M18 100h30M152 100h30" stroke="#ff4d4d" stroke-width="3"/>
  <path d="M8 34V8h26M166 8h26v26M192 166v26h-26M34 192H8v-26" stroke="#fff" stroke-width="3" opacity=".85"/></g></svg>`;
// 찍은 사진에 표적을 그린다 (화면의 표적과 같은 자리·비율)
function stampReticle(g, w, h, label) {
  const s = Math.min(w, h) * 0.6 / 200, cx = w / 2, cy = h / 2;
  g.save(); g.translate(cx - 100 * s, cy - 100 * s); g.scale(s, s); g.lineCap = 'round';
  const both = (fn, wide) => { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = wide; fn(); g.stroke(); g.strokeStyle = '#ff4d4d'; g.lineWidth = 3; fn(); g.stroke(); };
  both(() => { g.beginPath(); g.arc(100, 100, 62, 0, Math.PI * 2); }, 7);
  both(() => { g.beginPath(); [[100, 18, 100, 48], [100, 152, 100, 182], [18, 100, 48, 100], [152, 100, 182, 100]].forEach(([a, b, c, d]) => { g.moveTo(a, b); g.lineTo(c, d); }); }, 7);
  g.beginPath(); g.arc(100, 100, 5, 0, Math.PI * 2); g.fillStyle = '#ff4d4d'; g.fill(); g.restore();
  // 아래쪽 띠: 대상 · 시각
  const fs = Math.round(Math.max(14, w * 0.035)), text = `술래 조준 · ${label} · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, h - fs * 2.1, w, fs * 2.1);
  g.fillStyle = '#fff'; g.font = `600 ${fs}px "Noto Sans KR", system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillText(text, fs * 0.7, h - fs * 1.05);
}
async function aimCamera({ targets, pick, send, fail }) {
  if (!navigator.mediaDevices?.getUserMedia || !targets.length) return fail();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false }); }
  catch { return fail(); }
  let cur = Math.max(0, targets.findIndex(t => t.uid === pick)), shot = null;
  const box = document.createElement('div');
  box.className = 'aim';
  box.innerHTML = `<video playsinline muted autoplay></video><img class="aim-pic" alt="" hidden>${RETICLE}
    <div class="aim-top"><button class="aim-x" aria-label="닫기">×</button><button class="aim-who"></button></div>
    <div class="aim-nav"><svg class="aim-arrow" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l11 30-11-7-11 7z" fill="#ff4d4d" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><div><b class="aim-dist"></b><small class="aim-sub"></small></div></div>
    <div class="aim-bot"><p class="aim-msg"></p><div class="aim-ctl"><button class="aim-shot" aria-label="찍기"></button></div></div><div class="aim-flash"></div>`;
  document.body.appendChild(box);
  const $a = s => box.querySelector(s), v = $a('video');
  v.srcObject = stream; v.play().catch(() => {});
  const who = () => ($a('.aim-who').innerHTML = `${ic('tag')} <b>${esc(targets[cur].label)}</b>${targets.length > 1 ? ' <small>바꾸기 ›</small>' : ''}`);
  who();
  $a('.aim-who').onclick = () => { if (targets.length > 1 && !shot) { cur = (cur + 1) % targets.length; who(); nav?.(); } };
  // 대상 술래까지 거리·방향: 나침반이 있으면 화살표가 실제 그쪽을, 없으면 북쪽 기준으로 돌리고 방위를 글로
  const nav = () => {
    const p = G.pos[targets[cur].uid], me = myLL, arrow = $a('.aim-arrow');
    if (!p || !me) { $a('.aim-dist').textContent = p ? '내 위치를 켜 주세요' : '위치를 몰라요'; $a('.aim-sub').textContent = ''; arrow.style.opacity = .3; return; }
    const d = dist(me, p), b = bearingTo(me, p), fresh = phoneHeading != null && Date.now() - headingAt < 3000;
    const old = Date.now() - (p.t || 0) > 60e3 ? ` · ${ago(p.t)} 위치` : '';
    arrow.style.opacity = 1; arrow.style.transform = `rotate(${fresh ? b - phoneHeading : b}deg)`;
    $a('.aim-nav').classList.toggle('near', d < 15);
    $a('.aim-dist').textContent = d < 15 ? `바로 근처! ${fmtDist(d)}` : fmtDist(d);
    $a('.aim-sub').textContent = (fresh ? '화살표 쪽으로' : `${compass8(b)}쪽 · 북쪽 기준`) + old;
  };
  nav();
  const navT = setInterval(nav, 500);
  const close = () => { clearInterval(navT); stream.getTracks().forEach(t => t.stop()); box.remove(); };
  $a('.aim-x').onclick = close;
  const ctl = $a('.aim-ctl'), msg = t => ($a('.aim-msg').textContent = t || '');
  const live = () => { shot = null; $a('.aim-pic').hidden = true; $a('.aim-ret').style.display = ''; v.play().catch(() => {}); msg(''); ctl.innerHTML = '<button class="aim-shot" aria-label="찍기"></button>'; ctl.querySelector('.aim-shot').onclick = take; };
  function take() {
    if (!v.videoWidth) return;
    // 화면에 보이는 그대로(가운데를 채워 자른 영역)를 긴 변 900px로
    const vw = v.videoWidth, vh = v.videoHeight, bw = box.clientWidth, bh = box.clientHeight;
    const s = Math.max(bw / vw, bh / vh), cw = bw / s, ch = bh / s, k = Math.min(1, 900 / Math.max(cw, ch));
    const c = document.createElement('canvas'); c.width = Math.round(cw * k); c.height = Math.round(ch * k);
    const g = c.getContext('2d');
    g.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, c.width, c.height);
    stampReticle(g, c.width, c.height, targets[cur].label);
    shot = c.toDataURL('image/jpeg', 0.72);
    $a('.aim-flash').classList.remove('on'); void $a('.aim-flash').offsetWidth; $a('.aim-flash').classList.add('on');
    navigator.vibrate?.(40);
    v.pause(); $a('.aim-pic').src = shot; $a('.aim-pic').hidden = false; $a('.aim-ret').style.display = 'none';
    ctl.innerHTML = `<button class="btn" id="aimAgain">다시 찍기</button><button class="btn goldbtn" id="aimSend">보내기 — 진행자 확인</button>`;
    ctl.querySelector('#aimAgain').onclick = live;
    ctl.querySelector('#aimSend').onclick = async () => {
      ctl.querySelectorAll('button').forEach(b => (b.disabled = true)); msg('보내는 중…');
      try { await send(shot, targets[cur].uid); close(); }
      catch (er) { msg(er.message === NOPE ? NOPE : '보내지 못했어요 (' + (er.code || er.message) + ')'); ctl.querySelectorAll('button').forEach(b => (b.disabled = false)); }
    };
  }
  ctl.querySelector('.aim-shot').onclick = take;
}
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

function teamPicker() {
  openSheet(`<p class="eyebrow">팀 고르기</p><h3>어느 팀인가요?</h3><p class="fine">진행자가 나중에 바꿀 수도 있어요.</p>
    <div class="teampick">${Object.entries(G.teams).map(([tid, t]) => `<button data-pick="${tid}"><i style="background:${esc(t.color)}"></i>${esc(t.name)}<small class="fine" style="margin-left:auto">${Object.values(G.members).filter(m => m.team === tid).length}명</small></button>`).join('')}</div>`,
  el => el.querySelectorAll('[data-pick]').forEach(b => (b.onclick = async () => { await net.setTeam(G.code, net.me(), b.dataset.pick); closeSheet(); })));
}

/* ---------- 진행자 ---------- */
let placing = null;
$('#placeCancel').onclick = () => { placing = null; $('#placing').hidden = true; };
// 확인 대기: 팀 미션(done)과 개인 완료(pdone) — who는 팀 id 또는 사람 uid
const pendings = () => [
  ...Object.entries(G.done).flatMap(([tid, ms]) => Object.entries(ms || {}).filter(([, d]) => d.status === 'wait').map(([mid, d]) => ({ kind: 't', who: tid, tid, mid, d }))),
  ...Object.entries(G.pdone).flatMap(([uid, ms]) => Object.entries(ms || {}).filter(([, d]) => d.status === 'wait').map(([mid, d]) => ({ kind: 'u', who: uid, tid: d.team, mid, d }))),
].sort((a, b) => (a.d.t || 0) - (b.d.t || 0));
function hostPanel() {
  const st = G.meta.status, live = st === 'live', ended = st === 'ended';
  const link = `${location.origin}${location.pathname}?g=${G.code}`;
  const waits = pendings(), nM = Object.keys(G.missions).length;
  const end = G.meta.endAt;
  // 진행 도구는 큼직한 한 줄씩. 게임 단계(시작 전 · 진행 중 · 끝난 뒤)마다 그때 중요한 것을 위로 올리고 나머지는 '그 밖에'로
  const R = {
    start: [live ? 'hEnd' : 'hStart', live ? 'stop' : 'play', live ? '게임 끝내기' : ended ? '다시 시작' : '게임 시작',
      live ? '모두에게 결과가 떠요' : ended ? '같은 미션으로 이어서 다시 시작해요' : '시작하면 모두 미션을 할 수 있어요', live ? 'danger' : 'primary'],
    teams: ['hTeams', 'team', solo() ? '방식·팀' : '팀 정하기', solo() ? '개인전·팀전 바꾸기' : `팀 ${Object.keys(G.teams).length}개 · 사람을 팀에 넣고 빼기`],
    missions: ['hAdd', 'flag', '미션 관리', `미션 ${nM}개 · 더하기·고치기·순서·열고 닫기`],
    guide: ['hGuide', 'book', '미션 안내 페이지', '참가자가 미리 보는 링크 보내기'],
    notice: ['hNotice', 'megaphone', '알림 보내기', '모두의 폰에 소식 띄우기'],
    endAt: ['hEndAt', 'clock', '끝나는 시간', end ? `${hhmm(end)}에 끝나요` : '아직 정하지 않았어요'],
    album: ['hAlbum', 'camera', '사진 모음 페이지', '인정된 사진을 링크로 나누기'],
    result: ['hResult', 'trophy', '결과 보기', '시상대와 순위'],
    area: ['hArea', 'map', '지역 바꾸기', '게임 지도의 가운데와 반경'],
    hosts: ['hHosts', 'crown', '진행자 더하기', '함께 진행할 사람 정하기'],
    banned: ['hBanned', 'team', '내보낸 사람', '목록 · 다시 들이기'],
    reset: ['hReset', 'stop', '게임 리셋', '점수·사진·소식만 지우고 처음 상태로', 'danger'],
    del: ['hDel', 'stop', '게임 지우기', '이 게임을 서버에서 통째로 지워요', 'danger'],
  };
  const order = ended ? [['album', 'result', 'start'], ['missions', 'notice', 'teams', 'guide', 'endAt', 'area', 'hosts', 'banned', 'reset', 'del']]
    : live ? [['missions', 'notice', 'endAt', 'teams'], ['guide', 'album', 'area', 'hosts', 'banned', 'start', 'reset']]
    : [['start', 'teams', 'missions', 'guide'], ['endAt', 'notice', 'area', 'hosts', 'banned', 'album', 'reset']];
  const ok = k => (k !== 'hosts' && k !== 'del') || isOwner();
  const row = k => { const [id, icon, t, sub, cls = ''] = R[k]; return `<button class="hrow ${cls}" id="${id}"><span class="hi">${ic(icon)}</span><span class="ht"><b>${t}</b><small>${esc(sub)}</small></span><span class="chev">›</span></button>`; };
  const waitList = `<div class="group-h">확인을 기다리는 미션 ${waits.length}</div>
    ${waits.length ? waits.map(({ kind, who, tid, mid, d }) => `<div class="item" data-judge="${kind}|${who}|${mid}"><div class="ic wait">${tic(G.missions[mid]?.type)}</div>
      <div class="tx"><b>${esc(G.missions[mid]?.title || mid)}${kind === 'u' && !solo() ? ' (개인)' : ''}</b><small><span class="dot" style="background:${esc(kind === 'u' && solo() ? personColor(who) : teamOf(tid).color)}"></span> ${solo() ? '' : esc(teamOf(tid).name) + ' · '}${esc(d.name)} · ${clock(d.t)}</small></div><div class="rt">보기 ›</div></div>`).join('') : '<p class="empty">없어요.</p>'}`;
  return `<div class="code">${G.code}</div><p class="fine" style="text-align:center">참가자에게 이 코드를 알려 주세요 · <button class="link" id="hCopy" data-link="${esc(link)}">초대 링크 복사</button></p>
    <div class="group-h">${ended ? '게임이 끝났어요' : live ? '진행 중' : '시작 전'}</div>
    <div class="hlist">${order[0].filter(ok).map(row).join('')}</div>
    ${live || waits.length ? waitList : ''}
    <div class="group-h">그 밖에</div>
    <div class="hlist">${order[1].filter(ok).map(row).join('')}</div>
    ${!live && !waits.length ? waitList : ''}`;
}
/* ---------- 미션 관리 ---------- */
// 진행자가 미션 전체를 목록으로 보며 더하기·고치기·지우기·순서 바꾸기·열고 닫기를 한 곳에서 한다.
// 이 창은 refresh가 다시 그리지 않으므로 바꾼 뒤엔 스스로 다시 그린다 (그래서 '한 번 더 누르기' 지우기가 풀리지 않는다)
function missionManager() {
  const list = Object.entries(G.missions).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  const total = list.reduce((a, [, m]) => a + (m.pts || 0), 0);
  openSheet(`<p class="eyebrow">미션 관리</p><h3>미션 ${list.length}개 · 모두 ${total}점</h3>
    <div class="hostgrid"><button class="btn small primary" id="mgAdd">${ic('plus')} 미션 더하기</button><button class="btn small" id="mgSample">${ic('flag')} 샘플 넣기</button><button class="btn small" id="mgExport">${ic('down')} 표 내려받기</button></div>
    ${list.length ? `<div class="mgr">${list.map(([id, m], i) => `<div class="mrow${m.open === false ? ' off' : ''}" data-id="${id}">
      <span class="no">${i + 1}</span><div class="ic">${tic(m.type)}</div>
      <div class="tx" data-edit><b>${esc(m.title)}</b><small>${solo() ? '' : m.type === 'tag' ? '<span class="kind team">팀</span> ' : `<span class="kind ${m.each ? 'each' : 'team'}">${m.each ? '개인' : '팀'}</span> `}${TYPES[m.type]?.[1] || ''} · ${m.pts || 0}점${m.limit ? ` · 깜짝 ${m.limit}분` : ''}${m.open === false ? ' · 닫힘' : m.until ? ' · ' + cd(m) : ''}</small></div>
      <div class="acts"><button class="mb" data-up ${i ? '' : 'disabled'} aria-label="위로">${ic('up')}</button><button class="mb" data-down ${i < list.length - 1 ? '' : 'disabled'} aria-label="아래로">${ic('down')}</button>
        <button class="mb txt" data-open>${m.open === false ? '열기' : '닫기'}</button><button class="mb txt del" data-del>삭제</button></div></div>`).join('')}</div>
      <p class="fine">이름을 누르면 고쳐요. 닫은 미션은 참가자에게 안 보여요.</p>` : '<p class="empty">아직 미션이 없어요. 더하거나 샘플을 넣어 보세요.</p>'}`, el => {
    el.querySelector('#mgAdd').onclick = () => missionForm(null, null, missionManager);
    el.querySelector('#mgSample').onclick = sampleSheet;
    el.querySelector('#mgExport').onclick = exportMissions;
    el.querySelectorAll('.mrow').forEach(row => {
      const id = row.dataset.id, m = G.missions[id], i = list.findIndex(([k]) => k === id);
      row.querySelector('[data-edit]').onclick = () => missionForm(id, null, missionManager);
      // 순서: 목록 차례대로 order를 다시 매기고, 바뀐 것만 저장한다 (예전 미션은 order가 겹치거나 없을 수 있다)
      const move = async d => {
        const ids = list.map(([k]) => k);
        [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
        await Promise.all(ids.map((k, n) => (G.missions[k].order === n ? null : net.saveMission(G.code, k, { ...G.missions[k], order: n }))));
        missionManager();
      };
      row.querySelector('[data-up]').onclick = () => move(-1);
      row.querySelector('[data-down]').onclick = () => move(1);
      row.querySelector('[data-open]').onclick = async () => { await setOpen(id, m, m.open === false); missionManager(); };
      row.querySelector('[data-del]').onclick = async e => {
        const b = e.currentTarget;
        if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '지울까요?'; b.classList.add('sure'); return; }
        await net.delMission(G.code, id); missionManager();
      };
    });
  });
}
/* ---------- 샘플 미션 넣기 · 미션 표 내려받기 ---------- */
// 지역 샘플(samples.js)을 한 번에 넣는다. 이름이 같은 미션은 건너뛰고, 순서는 지금 미션들 뒤에 붙인다
function sampleSheet() {
  const opts = Object.entries(SAMPLES);
  const c = G.meta.center;
  const row = s => s.missions.filter(x => x.type !== 'tag' || !solo()).map(x => `<li>${esc(x.title)} <small class="fine">· ${TYPES[x.type][1]}${solo() ? '' : x.type === 'tag' ? '' : x.each ? ' · 개인' : ' · 팀'} · ${x.pts}점</small></li>`).join('');
  openSheet(`<p class="eyebrow">샘플 미션 넣기</p><h3>지역 샘플을 한 번에 넣어요</h3>
    <label>지역<select id="smpWhich">${opts.map(([k, s]) => `<option value="${k}">${esc(s.name)} (${s.missions.length}개)</option>`).join('')}</select></label>
    <div id="smpInfo"></div><ul class="smp" id="smpList"></ul>
    <p class="fine">넣은 뒤에도 미션마다 고치거나 지울 수 있어요. 술래잡기는 닫힌 채로 들어가니 술래를 정하고 여세요.</p>
    <button class="btn wide primary" id="smpGo">이대로 넣기</button><p class="msg" id="smpMsg"></p>`, el => {
    const paint = () => {
      const s = SAMPLES[el.querySelector('#smpWhich').value];
      el.querySelector('#smpList').innerHTML = row(s);
      const far = c ? dist(c, s.center) : 0;
      el.querySelector('#smpInfo').innerHTML = far > 3000 ? `<div class="box warn">이 게임 지역에서 ${fmtDist(far)} 떨어진 곳의 샘플이에요. 지역을 확인해 주세요.</div>` : '';
    };
    el.querySelector('#smpWhich').onchange = paint; paint();
    el.querySelector('#smpGo').onclick = async () => {
      const s = SAMPLES[el.querySelector('#smpWhich').value], msg = el.querySelector('#smpMsg');
      const have = new Set(Object.values(G.missions).map(x => x.title));
      const add = s.missions.filter(x => !have.has(x.title) && (x.type !== 'tag' || !solo()));
      if (!add.length) { msg.className = 'msg err'; msg.textContent = '이미 다 들어 있어요.'; return; }
      msg.className = 'msg'; msg.textContent = '넣는 중…';
      let order = Math.max(0, ...Object.values(G.missions).map(x => x.order || 0)) + 1;
      const stamp = Date.now().toString(36);
      try {
        for (const [i, x] of add.entries()) {
          const id = `s${stamp}${i}`, { ans, ...v } = x;
          const mv = { ...v, order: order++, open: x.open !== false };
          if (solo()) delete mv.each;
          if (x.type === 'tag') Object.assign(mv, { it: {} }, zone(mv)); // 구역은 이 게임의 지역 전체
          if (ans) mv.ah = await answerHash(id, ans);
          await net.saveMission(G.code, id, mv);
        }
        missionManager(); toast(`샘플 미션 ${add.length}개를 넣었어요.`, 'flag');
        if (isLive()) net.say(G.code, '', `새 미션 ${add.length}개가 생겼어요`);
      } catch (er) { msg.className = 'msg err'; msg.textContent = '넣지 못했어요 (' + (er.code || er.message) + ')'; }
    };
  });
}
// 미션 표 내려받기: 엑셀·구글 시트에서 바로 열리는 CSV (한글이 깨지지 않게 BOM). 퀴즈 정답은 저장하지 않으므로 칸만 둔다
function exportMissions() {
  const list = sortedMissions();
  if (!list.length) { toast('아직 미션이 없어요.'); return; }
  const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['순서', '미션', '종류', '팀/개인', '점수', '반경(m)', '위도', '경도', '설명', '퀴즈 문제', '술래', '상태', '해낸 팀·사람'];
  const rows = list.map(([id, m], i) => [i + 1, m.title, TYPES[m.type]?.[1] || m.type, solo() ? '개인전' : m.type === 'tag' ? '팀' : m.each ? '개인' : '팀', m.pts || 0, zone(m).r || 0,
    zone(m).lat?.toFixed(6), zone(m).lng?.toFixed(6), m.desc || '', m.q || '',
    Object.entries(m.it || {}).map(([tid, u]) => `${teamOf(tid).name} ${G.members[u]?.name || '?'}`).join(' / '),
    m.open === false ? '닫힘' : '열림',
    isEach(m) ? eachDone(id).map(([u]) => G.members[u]?.name || '?').join(' / ') : Object.keys(G.teams).filter(t => G.done[t]?.[id]?.status === 'ok').map(t => teamOf(t).name).join(' / ')]);
  const csv = '\ufeff' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `vision-quest-missions-${G.code}.csv`; // 영문 이름: 일부 브라우저가 한글 파일 이름을 'download'로 바꿔 버린다
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('미션 표를 내려받았어요 (엑셀·구글 시트에서 열려요).', 'down');
}
/* ---------- 미션 안내 페이지 ---------- */
// 팀원이 게임에 들어오기 전에도 링크로 미리 보게, 진행자 화면이 미션 요약을 games/{코드}/guide에 써 둔다 (바뀔 때만, 잠깐 모아서).
// 닫힌 미션도 '나중에 열림'으로 보이고, 퀴즈 문제는 현장에서만 보이게 뺀다
const guideLink = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}guide.html?g=${G.code}${DEMO ? '&demo' : ''}`;
function guideData() {
  const n = v => (v == null ? null : v);
  return {
    name: G.meta.name || '', mode: solo() ? 'solo' : 'team', endAt: n(G.meta.endAt),
    teams: solo() ? [] : Object.values(G.teams).map(t => ({ name: t.name, color: t.color })),
    missions: Object.values(G.missions).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(m => ({
      title: m.title || '', type: m.type || 'arrive', each: !!(m.each && !solo()), pts: m.pts || 0, desc: m.desc || '', r: zone(m).r || 0,
      lat: n(zone(m).lat), lng: n(zone(m).lng), open: m.open !== false, limit: m.limit || 0, itHost: !!m.itHost,
    })),
  };
}
let guideKey = '', guideT = 0;
function syncGuide() {
  if (!isHost() || !G.code || !G.meta.host || guideT) return; // refresh는 1초에도 여러 번 불려 미루기만 하면 영영 안 쓰이므로, 걸린 타이머가 있으면 그대로 둔다
  guideT = setTimeout(() => {
    guideT = 0;
    const g = guideData(), key = G.code + JSON.stringify(g);
    if (key === guideKey) return;
    guideKey = key;
    net.publishGuide(G.code, { ...g, at: Date.now() }).catch(() => { guideKey = ''; });
  }, 1500);
}
function guideSheet() {
  const link = guideLink();
  openSheet(`<p class="eyebrow">미션 안내 페이지</p><h3>참가자에게 미리 보여 주기</h3>
    <p class="fine">링크만 있으면 로그인 없이 미션 목록, 미션 하는 법, 준비물을 볼 수 있어요. 미션을 고치면 안내 페이지도 저절로 바뀌어요. 퀴즈 문제는 현장에서만 보여요.</p>
    <input readonly value="${esc(link)}" onclick="this.select()">
    <div class="row"><button class="btn wide primary" id="gShare">${ic('megaphone')} 보내기</button><button class="btn wide" id="gCopy">링크 복사</button></div>
    <a class="btn wide" style="display:block;text-align:center;text-decoration:none;color:inherit" href="${esc(link)}" target="_blank" rel="noopener">안내 페이지 열어 보기</a>`, s => {
    guideKey = ''; clearTimeout(guideT); guideT = 0; syncGuide(); // 지금 미션으로 한 번 더 써 둔다
    s.querySelector('#gCopy').onclick = () => { navigator.clipboard?.writeText(link); toast('안내 페이지 링크를 복사했어요.'); };
    s.querySelector('#gShare').onclick = () => navigator.share ? navigator.share({ title: `${G.meta.name || '비전 퀘스트'} 미션 안내`, url: link }).catch(() => {})
      : (navigator.clipboard?.writeText(link), toast('안내 페이지 링크를 복사했어요.'));
  });
}
/* ---------- 사진 모음 페이지 ---------- */
// 진행자가 인정한 사진(사진·술래잡기 미션)을 미션별로 모아 링크로 보여 준다 (album.html?g=코드, 로그인 없이).
// 참가자 사진(photos)은 게임 회원만 읽으므로, 인정할 때 진행자 화면이 album에 따로 옮겨 둔다
const albumLink = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}album.html?g=${G.code}${DEMO ? '&demo' : ''}`;
// 인정된 사진 목록: [key, mid, uid|null, tid, 완료 기록]
const approvedPhotos = () => [
  ...Object.entries(G.done).flatMap(([tid, ms]) => Object.entries(ms || {}).map(([mid, d]) => [tid + '_' + mid, mid, null, tid, d])),
  ...Object.entries(G.pdone).flatMap(([uid, ms]) => Object.entries(ms || {}).map(([mid, d]) => ['u_' + uid + '_' + mid, mid, uid, d.team, d])),
].filter(([, mid, , , d]) => d?.status === 'ok' && ['photo', 'tag'].includes(G.missions[mid]?.type));
async function albumPut(key, mid, uid, tid, d) {
  const url = safeData(await net.getPhoto(G.code, key.slice(0, -(mid.length + 1)), mid));
  if (!url.startsWith('data:image/')) return false;
  const m = G.missions[mid] || {};
  const who = solo() ? d?.name || '' : `${teamOf(tid).name}${uid ? ' · ' + (d?.name || '') : ''}`;
  await net.albumAdd(G.code, key, { mid, title: m.title || '', who, color: solo() && uid ? personColor(uid) : teamOf(tid).color, t: d?.t || Date.now() }, url);
  return true;
}
// 이 기능 전에 인정한 사진도 모으고, 지운 미션·취소된 사진은 뺀다
async function albumSync() {
  const have = await net.albumIdx(G.code), want = approvedPhotos();
  const keys = new Set(want.map(([k]) => k));
  for (const k of Object.keys(have)) if (!keys.has(k)) await net.albumDel(G.code, k);
  for (const [k, mid, uid, tid, d] of want) if (!have[k]) await albumPut(k, mid, uid, tid, d);
  return Object.keys(await net.albumIdx(G.code)).length;
}
function albumSheet() {
  const link = albumLink();
  openSheet(`<p class="eyebrow">사진 모음 페이지</p><h3>인정된 사진을 미션별로 한눈에</h3>
    <p class="fine">진행자가 인정한 사진(사진·술래잡기 미션)이 미션마다 모여요. 링크만 있으면 로그인 없이 볼 수 있고, 새로 인정하는 사진도 저절로 더해져요.</p>
    <div class="box" id="alN">사진을 모으는 중…</div>
    <input readonly value="${esc(link)}" onclick="this.select()">
    <div class="row"><button class="btn wide primary" id="aShare">${ic('megaphone')} 보내기</button><button class="btn wide" id="aCopy">링크 복사</button></div>
    <a class="btn wide" style="display:block;text-align:center;text-decoration:none;color:inherit" href="${esc(link)}" target="_blank" rel="noopener">사진 모음 열어 보기</a>`, s => {
    albumSync().then(n => { s.querySelector('#alN').innerHTML = `${ic('camera')} 인정된 사진 ${n}장`; })
      .catch(er => { s.querySelector('#alN').textContent = '사진을 모으지 못했어요 (' + (er.code || er.message) + ')'; });
    s.querySelector('#aCopy').onclick = () => { navigator.clipboard?.writeText(link); toast('사진 모음 링크를 복사했어요.'); };
    s.querySelector('#aShare').onclick = () => navigator.share ? navigator.share({ title: `${G.meta.name || '비전 퀘스트'} 사진 모음`, url: link }).catch(() => {})
      : (navigator.clipboard?.writeText(link), toast('사진 모음 링크를 복사했어요.'));
  });
}
function bindHost(el) {
  el.querySelector('#hCopy')?.addEventListener('click', e => { navigator.clipboard?.writeText(e.target.dataset.link); toast('초대 링크를 복사했어요.'); });
  // 다시 시작할 때 이미 지난 끝나는 시간은 지운다
  el.querySelector('#hStart')?.addEventListener('click', async () => { if (timeUp()) await net.saveMeta(G.code, { endAt: null }); await net.setStatus(G.code, 'live'); net.say(G.code, '', '게임이 시작됐어요!'); armTimed(); });
  // 끝내기는 따로 창을 띄워 묻는다 — 진행 탭은 자주 새로 그려져 '한 번 더 누르기'가 풀리고, 아이콘을 누르면 단추가 아닌 아이콘에 표시가 붙었다
  el.querySelector('#hEnd')?.addEventListener('click', () => openSheet(`<p class="eyebrow">게임 끝내기</p><h3>지금 게임을 끝낼까요?</h3>
    <p class="fine">모두에게 결과가 뜨고, 그 뒤로는 미션을 할 수 없어요. 진행 탭에서 다시 시작할 수 있어요.</p>
    <div class="row"><button class="btn wide danger" id="endYes">끝내기</button><button class="btn wide" id="endNo">그만두기</button></div>`, s => {
    s.querySelector('#endNo').onclick = closeSheet;
    s.querySelector('#endYes').onclick = async () => { closeSheet(); await net.setStatus(G.code, 'ended'); net.say(G.code, '', '게임이 끝났어요. 수고하셨어요!'); };
  }));
  el.querySelector('#hAdd')?.addEventListener('click', missionManager);
  el.querySelector('#hGuide')?.addEventListener('click', guideSheet);
  el.querySelector('#hAlbum')?.addEventListener('click', albumSheet);
  el.querySelector('#hTeams')?.addEventListener('click', teamEditor);
  el.querySelector('#hArea')?.addEventListener('click', areaEditor);
  el.querySelector('#hEndAt')?.addEventListener('click', endEditor);
  // 끝난 게임 지우기 (만든 진행자만): 진행 탭은 자주 새로 그려져 '한 번 더 누르기'가 풀리므로 따로 창을 띄워 묻는다.
  // 구독부터 끊고 지운 뒤 로비로
  el.querySelector('#hDel')?.addEventListener('click', () => openSheet(`<p class="eyebrow">게임 지우기</p><h3>'${esc(G.meta.name || G.code)}' 게임을 지울까요?</h3>
    <p class="fine">참가자 위치, 미션 기록, 사진, 소식이 서버에서 모두 지워지고 되돌릴 수 없어요. 결과가 필요하면 먼저 캡처해 두세요.</p>
    <div class="row"><button class="btn wide danger" id="delYes">지우기</button><button class="btn wide" id="delNo">그만두기</button></div><p class="msg" id="delMsg"></p>`, s => {
    s.querySelector('#delNo').onclick = closeSheet;
    s.querySelector('#delYes').onclick = async () => {
      const code = G.code;
      G.off?.(); G.off = null;
      try { await net.deleteGame(code); $('#sheet').hidden = true; leaveGame('게임을 지웠어요.'); }
      catch (er) { s.querySelector('#delMsg').className = 'msg err'; s.querySelector('#delMsg').textContent = '지우지 못했어요 (' + (er.code || er.message) + ')'; }
    };
  }));
  el.querySelector('#hHosts')?.addEventListener('click', hostEditor);
  el.querySelector('#hBanned')?.addEventListener('click', bannedSheet);
  el.querySelector('#hResult')?.addEventListener('click', showResults);
  // 게임 리셋: 연습해 본 뒤 처음부터 다시 할 때. 진행 탭은 자주 새로 그려지므로 따로 창을 띄워 묻는다
  el.querySelector('#hReset')?.addEventListener('click', () => openSheet(`<p class="eyebrow">게임 리셋</p><h3>게임을 처음 상태로 되돌릴까요?</h3>
    <div class="box"><b>지워요</b> — 점수·미션 완료 기록, 올린 사진·녹음, 사진 모음, 소식${timeUp() ? ', 이미 지난 끝나는 시간' : ''}<br><b>남아요</b> — 미션, 팀, 참가자와 팀 배정, 진행자${G.meta.endAt && !timeUp() ? ', 끝나는 시간' : ''}</div>
    <p class="fine">게임은 '시작 전'으로 돌아가요. 되돌릴 수 없으니 남길 사진은 먼저 저장해 두세요.</p>
    <div class="row"><button class="btn wide danger" id="rsYes">리셋</button><button class="btn wide" id="rsNo">그만두기</button></div><p class="msg" id="rsMsg"></p>`, s => {
    s.querySelector('#rsNo').onclick = closeSheet;
    s.querySelector('#rsYes').onclick = async () => {
      try {
        await net.resetGame(G.code, Object.keys(G.missions), timeUp());
        closeSheet(); toast('게임을 처음 상태로 되돌렸어요.');
        net.say(G.code, '', '게임 생성');
      } catch (er) { s.querySelector('#rsMsg').className = 'msg err'; s.querySelector('#rsMsg').textContent = '되돌리지 못했어요 (' + (er.code || er.message) + ')'; }
    };
  }));
  el.querySelector('#hNotice')?.addEventListener('click', () => openSheet(`<h3>모두에게 알림</h3><form class="stack" id="nf"><input id="nt" placeholder="예: 10분 뒤 광장에 모여요" required><button class="btn primary">보내기</button></form>`,
    s => (s.querySelector('#nf').onsubmit = async e => { e.preventDefault(); await net.say(G.code, '', s.querySelector('#nt').value.trim()); closeSheet(); })));
  el.querySelectorAll('[data-judge]').forEach(n => (n.onclick = () => judgeSheet(...n.dataset.judge.split('|'))));
}
async function judgeSheet(kind, who, mid) {
  // kind 't': 팀 미션(who = 팀), 'u': 개인 완료(who = 사람)
  const m = G.missions[mid] || {}, d = kind === 'u' ? G.pdone[who]?.[mid] : G.done[who]?.[mid], tid = kind === 'u' ? d?.team : who;
  const key = kind === 'u' ? 'u_' + who : who;
  const judge = ok => (kind === 'u' ? net.judgeMine(G.code, who, mid, ok) : net.judge(G.code, who, mid, ok));
  const label = solo() ? d?.name : `${teamOf(tid).name}${kind === 'u' ? ' ' + d?.name : ''}`;
  openSheet(`<p class="eyebrow">확인 요청 · ${esc(solo() ? '개인' : teamOf(tid).name)}</p><h3>${esc(m.title)}</h3><p class="fine">${esc(d?.name)} · ${clock(d?.t)}</p>
    ${m.type === 'tag' && d?.caught ? `<div class="box">${ic('tag')} ${m.itHost ? '진행자' : esc(teamOf(G.members[d.caught]?.team).name)} 술래 <b>${esc(G.members[d.caught]?.name || '?')}</b>${josa(G.members[d.caught]?.name || '?')} 찍었대요</div>` : ''}
    <div id="ph">${m.type === 'photo' || m.type === 'tag' ? '<p class="fine">사진을 불러오는 중…</p>' : m.type === 'voice' ? '<p class="fine">녹음을 불러오는 중…</p>' : ''}</div>
    <label class="fine">다시 하게 할 때 이유 (모두에게 알려요)<input id="jWhy" maxlength="60" placeholder="${m.type === 'voice' ? '예: 더 크게 불러 주세요' : m.type === 'tag' ? '예: 술래 얼굴이 안 보여요' : '예: 팀원 모두 나오게 찍어 주세요'}"></label>
    <div class="grid2"><button class="btn danger" id="jNo">다시 하게 하기</button><button class="btn primary" id="jOk">인정 (+${m.pts || 0}점)</button></div>`, async el => {
    el.querySelector('#jOk').onclick = async () => {
      if (m.type === 'tag' && tagWinner(mid)) { toast(`이미 ${teamOf(tagWinner(mid)).name}이 이겼어요.`); return; }
      await judge(true);
      if (m.type === 'photo' || m.type === 'tag') albumPut(key + '_' + mid, mid, kind === 'u' ? who : null, tid, d).catch(() => {}); // key는 photos 앞부분(팀 또는 u_사람)
      net.say(G.code, tid || '', m.type === 'tag' ? (m.itHost ? `${label} — 진행자 술래 ${G.members[d?.caught]?.name || ''} 잡았다! +${m.pts || 0}점` : `${label} — ${teamOf(G.members[d?.caught]?.team).name} 술래 ${G.members[d?.caught]?.name || ''} 잡았다! '${m.title}' 승리`) : `${label} — '${m.title}' 완료!`);
      closeSheet();
    };
    el.querySelector('#jNo').onclick = async () => { const why = el.querySelector('#jWhy').value.trim(); await judge(false); await net.delPhoto(G.code, key, mid); net.say(G.code, tid || '', `${label} — '${m.title}' 다시 해 주세요${why ? ' — ' + why : ''}`); closeSheet(); };
    if (m.type === 'photo' || m.type === 'tag') { const url = safeData(await net.getPhoto(G.code, key, mid)); el.querySelector('#ph').innerHTML = url ? `<img class="photo" src="${url}" alt="">` : '<p class="fine">사진이 없어요.</p>'; }
    if (m.type === 'voice') { const url = safeData(await net.getPhoto(G.code, key, mid)); el.querySelector('#ph').innerHTML = url ? `<audio controls src="${url}" class="recplay"></audio>` : '<p class="fine">녹음이 없어요.</p>'; }
  });
}
/* ---------- 결과: 게임이 끝나면 모두에게 등수를 바로 보여 준다 ---------- */
// 끝나는 순간(진행자가 끝내거나 시간이 다 되면) 한 번 띄운다. 점수 자료가 마저 오게 잠깐 기다린다
function checkResults() {
  if (!G.code || !isOver() || G.shownResult) return;
  G.shownResult = true;
  setTimeout(showResults, 1200);
}
// 끝나기 직전에 올린 사진은 끝난 뒤에 인정되기도 한다 — 결과 창이 열려 있으면 순위를 다시 그린다(빵가루는 처음 한 번만)
let resultKey = '';
const resultOpen = () => !$('#sheet').hidden && !!$('#sheetCard .result');
function showResults(quiet) {
  const rows = standings();
  if (!rows.length) return;
  const waits = pendings().length;
  resultKey = JSON.stringify(rows) + waits;
  const medal = r => (r.rank <= 3 ? ic('medal' + r.rank) : `<b class="rk">${r.rank}</b>`);
  const top = rows.filter(r => r.rank <= 3).slice(0, 3);
  // 시상대: 2등 · 1등 · 3등 자리
  const podium = [top[1], top[0], top[2]].filter(Boolean).map(r => `<div class="pod r${r.rank}"><div class="pm">${ic('medal' + r.rank)}</div><b>${esc(r.name)}</b><small>${r.pts}점</small><i style="background:${esc(r.color)}"></i></div>`).join('');
  const mine = rows.find(r => r.mine);
  const colors = ['#ff6b9a', '#ffd34e', '#4cc3f0', '#5fd38a', '#9b6bff', '#ffa24c'];
  const confetti = Array.from({ length: 28 }, (_, i) => `<span style="left:${(i * 37) % 100}%;background:${colors[i % 6]};animation-delay:${(i % 7) * 0.18}s;animation-duration:${2.2 + (i % 5) * 0.3}s"></span>`).join('');
  openSheet(`${quiet ? '' : `<div class="confetti">${confetti}</div>`}<div class="result"><div class="rhead">${ic('trophy')}<h3>게임 결과</h3><p class="fine">${esc(G.meta.name || '')}</p></div>
    <div class="podium">${podium}</div>
    ${mine ? `<div class="box mineres">${solo() ? '나는' : '우리 팀은'} <b>${mine.rank}등</b>! · ${mine.pts}점</div>` : ''}
    ${waits ? `<p class="fine" style="text-align:center">${ic('wait')} 진행자가 확인 중인 미션 ${waits}개 — 확인되면 순위가 바뀔 수 있어요</p>` : ''}
    <div class="stack">${rows.map(r => `<div class="item ${r.mine ? 'on' : ''}"><div class="ic">${medal(r)}</div><div class="tx"><b><span class="dot" style="background:${esc(r.color)}"></span> ${esc(r.name)}</b><small>미션 ${r.n}개</small></div><div class="rt"><b>${r.pts}</b>점</div></div>`).join('')}</div></div>`);
}

/* ---------- 끝나는 시간 ---------- */
const hhmm = t => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const left = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
// 위쪽에 남은 시간을 1초마다. 5분·1분 전에 알리고, 시간이 다 되면 진행자 화면이 게임을 끝낸다
let warned = {};
function tickTimer() {
  const now = Date.now();
  document.querySelectorAll('.cd[data-until]').forEach(s => { const u = +s.dataset.until; s.textContent = u <= now ? '시간 끝' : left(u - now); });
  if (G.code) {
    const timed = Object.values(G.missions).filter(m => m.until && m.open !== false);
    if (timed.some(m => m.until <= now && m.until > now - 1000)) refresh(); // 방금 끝난 깜짝 미션
    else if (timed.length && now % 15000 < 1000) syncMissions();
  }
  const el = $('#gTimer'), end = G.meta.endAt;
  el.hidden = !end || !G.code || G.meta.status === 'ended';
  if (el.hidden) return;
  const ms = end - Date.now();
  el.className = 'timer' + (ms <= 0 ? ' over' : ms <= 5 * 60e3 ? ' warn' : '');
  el.innerHTML = ic('clock') + (ms <= 0 ? '시간 끝' : G.meta.status === 'live' ? left(ms) : hhmm(end) + ' 끝');
  if (G.meta.status !== 'live') return;
  [[5 * 60e3, '5분'], [60e3, '1분']].forEach(([w, label]) => { if (ms <= w && ms > w - 3000 && !warned[w]) { warned[w] = 1; toast(`끝나기 ${label} 전이에요!`, 'clock'); navigator.vibrate?.(300); } });
  if (ms <= 0 && !warned.end) {
    warned.end = 1;
    refresh();
    checkResults();
    // 게임을 만든 진행자가 끝낸다 (그가 없으면 다른 진행자가 15초 뒤에)
    if (isHost()) setTimeout(async () => { if (G.meta.status === 'live') { await net.setStatus(G.code, 'ended'); net.say(G.code, '', '시간이 다 됐어요. 게임 끝! 수고하셨어요'); } }, isOwner() ? 0 : 15000);
  }
}
setInterval(tickTimer, 1000);
function endEditor() {
  const end = G.meta.endAt, base = Math.max(Date.now(), end || 0);
  const def = new Date(end || Date.now() + 60 * 60e3);
  openSheet(`<h3>${ic('clock')} 끝나는 시간</h3><p class="fine">${end ? `지금: ${hhmm(end)}에 끝나요${end > Date.now() ? ` (남은 ${left(end - Date.now())})` : ''}` : '아직 정하지 않았어요.'} 정하면 바로 모두에게 알려요.</p>
    <form class="stack" id="ef"><label>시각<input type="time" id="eT" value="${hhmm(def)}" required></label><button class="btn primary">이 시각으로 정하기</button></form>
    <div class="group-h">${end ? '지금 끝나는 시간에서' : '지금부터'}</div>
    <div class="quick">${[10, 30, 60].map(n => `<button class="btn small" data-add="${n}">+${n < 60 ? n + '분' : '1시간'}</button>`).join('')}${end ? '<button class="btn small" data-add="-10">-10분</button><button class="btn small danger" id="eClear">시간 없애기</button>' : ''}</div><p class="msg" id="eMsg"></p>`, el => {
    const save = async t => {
      if (t <= Date.now()) { el.querySelector('#eMsg').className = 'msg err'; el.querySelector('#eMsg').textContent = '지금보다 뒤의 시각으로 정해 주세요.'; return; }
      await net.saveMeta(G.code, { endAt: t });
      reTime(t);
      net.say(G.code, '', `끝나는 시간: ${hhmm(t)} (남은 ${left(t - Date.now())})`);
      closeSheet();
    };
    el.querySelector('#ef').onsubmit = e => {
      e.preventDefault();
      const [h, m] = el.querySelector('#eT').value.split(':').map(Number), d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now() - 60e3) d.setDate(d.getDate() + 1); // 지난 시각을 고르면 다음 날로
      save(d.getTime());
    };
    el.querySelectorAll('[data-add]').forEach(b => (b.onclick = () => save(base + +b.dataset.add * 60e3)));
    el.querySelector('#eClear')?.addEventListener('click', async () => { await net.saveMeta(G.code, { endAt: null }); net.say(G.code, '', '끝나는 시간을 없앴어요'); closeSheet(); });
  });
}
// 게임 지역: 중심과 반경을 바꾸면 모두의 화면에서 지형을 새로 만든다 (예: 대전에서 시험하다가 행사 날 전주로)
function areaEditor() {
  const c = G.meta.center || JEONJU, r = G.meta.radius || 600;
  const far = Object.values(G.missions).filter(m => dist(m, c) > r).length;
  openSheet(`<h3>게임 지역 바꾸기</h3><p class="fine">지금: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} · 반경 ${fmtDist(r)}</p>
    <form class="stack" id="af">
      <label>중심<select id="aC"><option value="here">지금 내 위치 (GPS)</option><option value="jeonju">전주 한옥마을</option><option value="custom">직접 입력 (위도, 경도)</option><option value="keep">그대로 두고 반경만</option></select></label>
      <input id="aLL" placeholder="36.3504, 127.3845" hidden>
      <label>반경 — 작을수록 위성사진이 선명해요<select id="aR">${[200, 300, 500, 800, 1000].map(v => `<option value="${v}" ${v === r ? 'selected' : ''}>${fmtDist(v)}</option>`).join('')}</select></label>
      <p class="fine">이미 만든 미션은 자리를 옮기지 않아요. 새 지역 밖에 남은 미션은 진행 탭에서 지우거나 고쳐 주세요.${far ? ` (지금도 지역 밖 미션 ${far}개)` : ''}</p>
      <button class="btn primary">바꾸기</button><p class="msg" id="aMsg"></p></form>`, el => {
    const sel = el.querySelector('#aC');
    sel.onchange = () => (el.querySelector('#aLL').hidden = sel.value !== 'custom');
    el.querySelector('#af').onsubmit = async e => {
      e.preventDefault();
      const msg = el.querySelector('#aMsg');
      try {
        let center = c;
        if (sel.value === 'here') { msg.textContent = '위치를 찾는 중…'; center = await here(); }
        if (sel.value === 'jeonju') center = JEONJU;
        if (sel.value === 'custom') {
          const [lat, lng] = el.querySelector('#aLL').value.split(',').map(Number);
          if (!isFinite(lat) || !isFinite(lng)) throw new Error('위도, 경도를 "36.3504, 127.3845"처럼 적어 주세요.');
          center = { lat, lng };
        }
        await net.saveMeta(G.code, { center, radius: +el.querySelector('#aR').value });
        net.say(G.code, '', '게임 지역이 바뀌었어요');
        closeSheet();
        // 테스트 중이면 내 인형도 새 지역 가운데로
        if (sim) setMyPos({ lat: center.lat, lng: center.lng, acc: 3 });
        W.resetView();
      } catch (er) { msg.className = 'msg err'; msg.textContent = er.code === 1 ? '위치 권한이 꺼져 있어요.' : er.message || '바꾸지 못했어요.'; }
    };
  });
}
// 진행자 더하기: 게임을 만든 진행자가 회원 중에서 고른다. 더해진 진행자는 미션·팀·판정·알림을 똑같이 하되, 진행자를 더하거나 빼지는 못한다
function hostEditor() {
  const draw = () => Object.entries(G.members).filter(([u]) => u !== G.meta.host).sort(([a, x], [b, y]) => isHostUid(b) - isHostUid(a) || x.name.localeCompare(y.name))
    .map(([uid, m]) => `<div class="item"><img class="mini" src="${thumb(m.avatar, uid)}" alt=""><div class="tx"><b>${esc(m.name)}</b><small>${esc(teamOf(m.team).name)}${isHostUid(uid) ? ' · 진행자' : ''}</small></div>
      <button class="btn small ${isHostUid(uid) ? '' : 'primary'}" data-host="${uid}">${isHostUid(uid) ? '빼기' : '진행자로'}</button></div>`).join('') || '<p class="empty">아직 들어온 회원이 없어요.</p>';
  openSheet(`<h3>진행자 더하기</h3><p class="fine">회원 중에서 골라 함께 진행해요. 더해진 진행자는 미션·팀·판정·알림을 똑같이 할 수 있어요.</p><div id="hl">${draw()}</div>`, el => {
    const bind = () => el.querySelectorAll('[data-host]').forEach(b => (b.onclick = async () => {
      const uid = b.dataset.host, on = !isHostUid(uid);
      try {
        await net.setCohost(G.code, uid, on);
        net.say(G.code, '', `${G.members[uid]?.name} 님이 진행자${on ? '가 됐어요' : '에서 빠졌어요'}`);
        el.querySelector('#hl').innerHTML = draw(); bind();
      } catch { toast('바꾸지 못했어요.'); }
    }));
    bind();
  });
}
// 방식·팀: 팀전/개인전을 바꾸고, 팀을 더하거나 빼고, 이름·색과 사람마다 팀을 정한다
function teamEditor() {
  const teamOpts = cur => Object.entries(G.teams).map(([tid, t]) => `<option value="${tid}" ${cur === tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const rows = Object.entries(G.members).filter(([u]) => u !== G.meta.host || G.members[u].team).map(([uid, m]) => `<label>${esc(m.name)}<select data-mem="${uid}"><option value="">팀 없음</option>${teamOpts(m.team)}</select></label>`).join('');
  const names = Object.entries(G.teams).map(([tid, t]) => `<div class="row"><input type="color" value="${esc(t.color)}" data-tc="${tid}" style="width:52px;padding:4px"><input value="${esc(t.name)}" data-tn="${tid}"><button class="btn small danger" data-tdel="${tid}" title="팀 빼기">×</button></div>`).join('');
  const body = solo()
    ? `<p class="fine">개인전 — 각자 미션을 해서 개인 점수로 겨뤄요. 점수판에 사람마다 점수가 보이고, 팀은 쓰지 않아요.</p>`
    : `<div class="stack">${names}<div class="grid2"><button class="btn small" id="tAdd">${ic('plus')} 팀 더하기</button><button class="btn small primary" id="tSave">이름·색 저장</button></div></div>
      <div class="group-h">사람마다 팀</div><div class="stack">${rows}</div>
      <label style="margin-top:12px">진행자인 나도 팀에 들어가기<select data-mem="${G.meta.host}"><option value="">들어가지 않음</option>${teamOpts(G.members[G.meta.host]?.team)}</select></label>`;
  openSheet(`<h3>방식·팀</h3><div class="seg"><button data-mode="team" class="${solo() ? '' : 'on'}">팀전</button><button data-mode="solo" class="${solo() ? 'on' : ''}">개인전</button></div>${body}`, el => {
    el.querySelectorAll('[data-mode]').forEach(b => (b.onclick = async () => {
      if ((b.dataset.mode === 'solo') === solo()) return;
      await net.saveMeta(G.code, { mode: b.dataset.mode });
      // 팀전으로 돌아왔는데 팀이 없으면 두 팀을 만들어 둔다
      if (b.dataset.mode === 'team' && !Object.keys(G.teams).length) await net.saveTeams(G.code, { t1: { name: TEAM_PRESET[0][0], color: TEAM_PRESET[0][1] }, t2: { name: TEAM_PRESET[1][0], color: TEAM_PRESET[1][1] } });
      net.say(G.code, '', `${b.dataset.mode === 'solo' ? '개인전' : '팀전'}으로 바뀌었어요`);
      teamEditor();
    }));
    el.querySelectorAll('[data-mem]').forEach(s => (s.onchange = () => net.setTeam(G.code, s.dataset.mem, s.value)));
    const read = () => {
      const teams = {};
      Object.keys(G.teams).forEach(tid => (teams[tid] = { name: el.querySelector(`[data-tn="${tid}"]`).value.trim() || G.teams[tid].name, color: el.querySelector(`[data-tc="${tid}"]`).value }));
      return teams;
    };
    el.querySelector('#tSave')?.addEventListener('click', async () => { await net.saveTeams(G.code, read()); toast('팀을 저장했어요.'); });
    // 팀 더하기: 아직 안 쓴 이름·색으로, 쓰던 번호 다음 id
    el.querySelector('#tAdd')?.addEventListener('click', async () => {
      const teams = read(), used = new Set(Object.values(teams).map(t => t.name));
      const [name, color] = TEAM_PRESET.find(([n]) => !used.has(n)) || [`${Object.keys(teams).length + 1}팀`, PERSON_COLORS[Object.keys(teams).length % PERSON_COLORS.length]];
      const n = Math.max(0, ...Object.keys(teams).map(k => +k.slice(1) || 0)) + 1;
      await net.saveTeams(G.code, { ...teams, ['t' + n]: { name, color } });
      teamEditor();
    });
    // 팀 빼기: 두 번 눌러야. 그 팀 사람들은 '팀 없음'이 되어 다시 고른다 (이미 얻은 점수 기록은 남지만 점수판에서 빠진다)
    el.querySelectorAll('[data-tdel]').forEach(b => (b.onclick = async () => {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '빼기?'; return; }
      const tid = b.dataset.tdel, teams = read();
      delete teams[tid];
      await net.saveTeams(G.code, teams);
      await Promise.all(Object.entries(G.members).filter(([, m]) => m.team === tid).map(([u]) => net.setTeam(G.code, u, '')));
      teamEditor();
    }));
  });
}
function missionForm(id, draftM, back) {
  const m = draftM || (id ? { ...G.missions[id] } : { type: 'arrive', r: 25, pts: 10, open: true, order: Object.keys(G.missions).length });
  openSheet(`${back ? `<button class="link" id="mfBack">‹ 미션 목록</button>` : ''}<h3>${id ? '미션 고치기' : '새 미션'}</h3><form class="stack" id="mf">
    <input name="title" placeholder="미션 이름 (예: 경기전 홍살문)" value="${esc(m.title || '')}" required>
    <label>종류<select name="type">${Object.entries(TYPES).filter(([k]) => k !== 'tag' || !solo() || m.type === 'tag').map(([k, [, n]]) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="tagset stack"><p class="fine">누가 술래인가요?</p>
      <div class="seg" id="itSeg"><button type="button" data-v="">팀마다 한 명</button><button type="button" data-v="host">진행자</button></div><input type="hidden" name="itMode" value="${m.itHost ? 'host' : ''}">
      <div class="ithost stack"><p class="fine">진행자 한 명이 모든 팀의 술래예요. 팀마다 진행자를 찾아 사진을 찍어 인정받으면 그 팀이 점수를 받아요(팀마다 한 번).</p>
        <label>술래가 될 진행자<select name="itHost">${Object.keys(G.members).filter(isHostUid).map(u => `<option value="${u}" ${(m.itHost || net.me()) === u ? 'selected' : ''}>${esc(G.members[u].name)}${u === net.me() ? ' (나)' : ''}</option>`).join('')}</select></label></div>
      <div class="itteam stack"><p class="fine">팀마다 술래를 한 명씩 정해요. 다른 팀 술래를 찾아 게임 지역(연두색 띠) 안에서 사진을 찍어 올리면, 진행자가 확인해서 먼저 인정받은 팀이 이겨요.</p>
      ${Object.entries(G.teams).map(([tid, t]) => `<label><span><span class="dot" style="background:${esc(t.color)}"></span> ${esc(t.name)} 술래</span><select name="it_${tid}"><option value="">정하지 않음</option>${Object.entries(G.members).filter(([, mm]) => mm.team === tid).map(([u, mm]) => `<option value="${u}" ${m.it?.[tid] === u ? 'selected' : ''}>${esc(mm.name)}</option>`).join('')}</select></label>`).join('')}</div></div>
    ${solo() ? '' : `<div class="eachset"><p class="fine">누가 하나요?</p><div class="seg" id="eachSeg"><button type="button" data-v="">팀 미션 (한 명만)</button><button type="button" data-v="1">개인 미션 (각자)</button></div><input type="hidden" name="each" value="${m.each ? '1' : ''}"></div>`}
    <textarea name="desc" placeholder="설명 (무엇을 하면 되는지 — 음성 미션이면 무엇을 녹음할지: 노래 한 소절, 팀 구호, 시 낭송 등)">${esc(m.desc || '')}</textarea>
    <div class="qa stack"><input name="q" placeholder="문제" value="${esc(m.q || '')}"><input name="ans" placeholder="${m.ah ? '정답 (바꿀 때만 적기)' : '정답 — 띄어쓰기·대소문자는 무시해요'}"></div>
    <div class="grid2"><label class="rset">반경(m)<input name="r" type="number" min="0" value="${m.r ?? 25}"></label><label>점수<input name="pts" type="number" min="0" value="${m.pts ?? 10}"></label></div>
    <label>제한 시간 (깜짝 미션)<select name="limit">${[0, 5, 10, 15, 20, 30, 45, 60].map(n => `<option value="${n}" ${(m.limit || 0) === n ? 'selected' : ''}>${n ? n + '분 — 열리는 순간부터' : '없음'}</option>`).join('')}</select></label>
    <p class="fine" id="limitNote" hidden>저장(열기)하는 순간부터 시간이 가고, 모두에게 깜짝 미션 소식이 가요. 게임 끝나는 시간을 넘으면 그때까지만이에요.</p>
    <div class="box" id="where">${m.lat ? `${ic('pin')} ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : '위치를 정해 주세요'}</div>
    <div class="grid2 placeset"><button type="button" class="btn" id="pickMap">지도에서 고르기</button><button type="button" class="btn" id="pickMe">내 자리로</button></div>
    <p class="fine tagzone">술래잡기 구역은 게임 지역 전체(지도의 연두색 띠)예요. 진행 탭 '지역 바꾸기'로 바꾸면 함께 바뀌어요.</p>
    <button class="btn primary">저장</button><p class="msg" id="mfMsg"></p></form>`, el => {
    const f = el.querySelector('#mf');
    el.querySelector('#mfBack')?.addEventListener('click', back);
    const qa = () => {
      const tag = f.type.value === 'tag';
      el.querySelector('.qa').hidden = f.type.value !== 'quiz'; el.querySelector('.tagset').hidden = !tag; if (f.each) f.each.closest('.eachset').hidden = tag;
      ['.rset', '#where', '.placeset'].forEach(q => (el.querySelector(q).hidden = tag)); el.querySelector('.tagzone').hidden = !tag; // 술래잡기는 게임 지역 전체
    };
    f.type.onchange = qa; qa();
    // 술래: 팀마다 / 진행자
    const itSeg = el.querySelector('#itSeg');
    const itPaint = () => { itSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === f.itMode.value)); el.querySelector('.ithost').hidden = f.itMode.value !== 'host'; el.querySelector('.itteam').hidden = f.itMode.value === 'host'; };
    itSeg.querySelectorAll('button').forEach(b => (b.onclick = () => { f.itMode.value = b.dataset.v; itPaint(); }));
    itPaint();
    const ln = () => (el.querySelector('#limitNote').hidden = !+f.limit.value);
    f.limit.onchange = ln; ln();
    // 팀 / 개인: 두 칸 중 하나를 고른다 (체크 하나로는 놓치기 쉬웠다)
    const seg = el.querySelector('#eachSeg');
    const paint = () => seg?.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === f.each.value));
    seg?.querySelectorAll('button').forEach(b => (b.onclick = () => { f.each.value = b.dataset.v; paint(); }));
    paint();
    // 개인전에선 개인 미션 칸이 없으니 원래 값을 둔다
    const read = () => ({ ...m, each: solo() ? m.each : f.each?.value === '1', title: f.title.value.trim(), type: f.type.value, desc: f.desc.value.trim(), q: f.q.value.trim(), r: +f.r.value || 0, pts: +f.pts.value || 0, limit: +f.limit.value || 0, _ans: f.ans.value,
      it: Object.fromEntries(Object.keys(G.teams).map(tid => [tid, f['it_' + tid]?.value]).filter(([, u]) => u)), _itMode: f.itMode.value, _itHost: f.itHost?.value });
    el.querySelector('#pickMap').onclick = () => {
      const cur = read();
      $('#sheet').hidden = true; $('#placing').hidden = false;
      placing = ll => missionForm(id, { ...cur, lat: ll.lat, lng: ll.lng }, back);
    };
    el.querySelector('#pickMe').onclick = () => { if (!myLL) { el.querySelector('#mfMsg').textContent = '위치 공유를 먼저 켜 주세요.'; return; } missionForm(id, { ...read(), lat: myLL.lat, lng: myLL.lng }, back); };
    f.onsubmit = async e => {
      e.preventDefault();
      const v = read();
      if (v.type === 'tag') Object.assign(v, zone(v)); // 술래잡기는 게임 지역 전체로 적어 둔다 (안내 페이지·표에도 맞게)
      if (!v.lat) { el.querySelector('#mfMsg').textContent = '위치를 정해 주세요.'; return; }
      if (v.type === 'quiz' && !v.ah && !v._ans.trim()) { el.querySelector('#mfMsg').textContent = '정답을 적어 주세요.'; return; }
      const ans = v._ans; delete v._ans; delete v.ans;
      if (v.type !== 'quiz') { delete v.q; delete v.ah; }
      const itMode = v._itMode, itHost = v._itHost; delete v._itMode; delete v._itHost;
      if (v.type === 'tag') {
        delete v.each;
        if (itMode === 'host') { if (!itHost) { el.querySelector('#mfMsg').textContent = '술래가 될 진행자를 골라 주세요.'; return; } v.itHost = itHost; v.it = {}; }
        else { delete v.itHost; if (Object.keys(v.it).length < 2) { el.querySelector('#mfMsg').textContent = '술래를 두 팀 넘게 정해 주세요.'; return; } }
      } else { delete v.it; delete v.itHost; }
      delete v.catchR; // 예전 GPS 잡기 거리는 이제 쓰지 않는다
      if (!v.each) delete v.each;
      // 제한 시간: 새로 정했거나 바꿨거나 이미 끝났으면 지금부터 다시 건다 (글자만 고칠 땐 시계를 그대로)
      // 비교는 저장된 미션과 (위치 고르기를 거치면 m은 고치던 초안이다). 시계는 게임 중일 때만 — 시작 전이면 시작할 때 건다(armTimed)
      const was = (id && G.missions[id]) || {};
      const isNew = !id, restart = !!v.limit && v.open !== false && isLive() && (isNew || v.limit !== was.limit || !was.until || expired(was));
      if (restart && G.meta.endAt && G.meta.endAt <= Date.now()) { el.querySelector('#mfMsg').textContent = '게임 끝나는 시간이 지났어요. 끝나는 시간을 먼저 늘려 주세요.'; return; }
      if (!v.limit) { delete v.limit; delete v.until; delete v.openAt; }
      else if (restart) { v.openAt = Date.now(); v.until = startUntil(v); }
      else if (!isLive()) { delete v.until; delete v.openAt; }
      // 새 미션은 id를 먼저 받아야 정답 해시를 만들 수 있다
      if (!id) { const r = await net.addMission(G.code, { ...v, open: true }); id = r?.key || Object.keys(G.missions).find(k => G.missions[k].title === v.title); }
      if (v.type === 'quiz' && ans.trim()) v.ah = await answerHash(id, ans);
      await net.saveMission(G.code, id, v);
      if (isLive() && restart) net.say(G.code, '', `깜짝 미션! '${v.title}' — ${Math.round((v.until - Date.now()) / 60e3)}분 안에 해내세요`);
      else if (isLive() && isNew) net.say(G.code, '', `새 미션 — '${v.title}'`);
      if (back) back(); else closeSheet();
    };
  });
}

/* ---------- 알림 ---------- */
function toast(text, icon) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  if (icon) t.insertAdjacentHTML('afterbegin', ic(icon) + ' ');
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4300);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
// 오래된 좌표 표시(n분 전)를 30초마다 다시 계산한다
setInterval(() => G.code && syncPlayers(), 30e3);

/* ---------- 시작 ---------- */
net.onUser(async u => {
  user = u;
  if (!u) { G.off?.(); G.code = null; show('auth'); return; }
  profile = await net.getProfile().catch(() => null);
  if (!profile?.name || !profile?.avatar) editProfile();
  else toLobby();
  if (DEMO && !profile) { profile = { name: '데모', gender: 'm', avatar: 'disciple' }; await net.saveProfile(profile); toLobby(); }
});
// 서비스 워커가 받은 지도 타일을 기기에 보관한다. 저장 공간이 모자랄 때 브라우저가 지우지 않게 '오래 보관'을 청한다
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
