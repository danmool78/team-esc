/* 비전현장미션 — 팀 미션 앱.
   흐름: 로그인(구글·이메일) → 별칭·인형(처음 한 번) → 게임 코드로 들어가기 / 진행자는 새 게임 만들기 → 팀 고르기 → 3D 지도
   지도: 실제 GPS 좌표를 몇 초마다 올리고, 모두의 좌표를 받아 미니미 인형이 그 자리까지 걸어가게 한다.
   점수판: 팀마다 해낸 미션 수와 점수를 위에 늘 보이고, 바뀌는 순간 반짝인다 */
import { JEONJU, dist, fmtDist } from './geo.js';
import * as W from './world.js';

const DEMO = new URLSearchParams(location.search).has('demo');
// 시험용 가짜 GPS: ?fakegps=36.3504,127.3845 — 그 좌표를 GPS가 준 것처럼 쓴다 (클라우드 컴퓨터·데스크톱에서 확인할 때)
const FAKE = (() => { const v = new URLSearchParams(location.search).get('fakegps')?.split(',').map(Number); return v?.length === 2 && v.every(isFinite) ? { lat: v[0], lng: v[1], acc: 5 } : null; })();
const net = await import(DEMO ? './demo.js' : './net.js');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

// 그 길의 미니미 중에서 성별에 맞는 평범한 옷차림만 (예수·마리아·천사·실루엣 전용 인물은 뺀다)
const OUTFITS = {
  m: ['man', 'disciple', 'peter', 'thomas', 'shepherd', 'traveler', 'levi', 'official', 'rich', 'steward', 'servant', 'john', 'elder', 'guard'],
  f: ['woman', 'woman2', 'martha', 'samaritan', 'phoenician', 'mother', 'anna'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const TEAM_PRESET = [['청팀', '#3d7be0'], ['홍팀', '#e0503d'], ['녹팀', '#3dae6a'], ['황팀', '#d9a520']];
const TYPES = { arrive: ['📍', '도착'], quiz: ['❓', '퀴즈'], photo: ['📷', '사진'], task: ['🙌', '현장 미션'] };
const STATUS = { ready: '시작 전', live: '진행 중', ended: '끝남' };
const STALE = 90e3; // 이만큼 좌표가 안 오면 흐리게

const screens = ['auth', 'profile', 'lobby', 'game'];
const show = id => screens.forEach(s => ($('#' + s).hidden = s !== id));
let user = null, profile = null;

/* ---------- 로그인 ---------- */
let signing = false;
$('#toggleSign').onclick = () => {
  signing = !signing;
  $('#emailBtn').textContent = signing ? '가입하기' : '로그인';
  $('#toggleSign').textContent = signing ? '이미 가입했어요 — 로그인' : '처음이에요 — 가입하기';
  $('#pw').autocomplete = signing ? 'new-password' : 'current-password';
};
const authErr = e => {
  const m = { 'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.', 'auth/email-already-in-use': '이미 가입한 이메일이에요. 로그인해 주세요.', 'auth/weak-password': '비밀번호는 6자 이상으로 해 주세요.', 'auth/invalid-email': '이메일 주소를 확인해 주세요.', 'auth/popup-closed-by-user': '구글 로그인 창이 닫혔어요.', 'auth/operation-not-allowed': '아직 이 로그인 방식이 켜져 있지 않아요 (Firebase 콘솔에서 켜야 해요).', 'auth/configuration-not-found': '아직 로그인 설정이 되어 있지 않아요 (Firebase 콘솔 → Authentication 시작).' }[e.code];
  $('#authMsg').className = 'msg err';
  $('#authMsg').textContent = m || e.message;
};
$('#emailForm').onsubmit = async e => {
  e.preventDefault();
  $('#authMsg').textContent = '';
  try { await (signing ? net.signUp : net.signIn)($('#email').value.trim(), $('#pw').value); } catch (er) { authErr(er); }
};
$('#googleBtn').onclick = () => net.google().catch(authErr);
$('#resetBtn').onclick = async () => {
  const em = $('#email').value.trim();
  if (!em) { $('#authMsg').textContent = '이메일을 먼저 적어 주세요.'; return; }
  try { await net.resetPw(em); $('#authMsg').className = 'msg'; $('#authMsg').textContent = '비밀번호를 다시 정하는 메일을 보냈어요.'; } catch (er) { authErr(er); }
};

/* ---------- 별칭·인형 ---------- */
let draft = { gender: 'm', avatar: pick(OUTFITS.m) };
function drawDraft() {
  $('#avatarImg').src = W.avatarThumb(draft.avatar);
  document.querySelectorAll('#genderSeg button').forEach(b => b.classList.toggle('on', b.dataset.g === draft.gender));
}
document.querySelectorAll('#genderSeg button').forEach(b => (b.onclick = () => { draft.gender = b.dataset.g; draft.avatar = pick(OUTFITS[draft.gender]); drawDraft(); }));
$('#reroll').onclick = () => {
  const list = OUTFITS[draft.gender].filter(t => t !== draft.avatar);
  draft.avatar = pick(list);
  drawDraft();
};
function editProfile() {
  draft = profile ? { gender: profile.gender || 'm', avatar: profile.avatar } : { gender: 'm', avatar: pick(OUTFITS.m) };
  $('#profName').value = profile?.name || (user.name || '').slice(0, 12);
  drawDraft();
  show('profile');
}
$('#profSave').onclick = async () => {
  const name = $('#profName').value.trim();
  if (name.length < 2) { $('#profName').focus(); $('#profName').placeholder = '별칭을 2자 이상 적어 주세요'; return; }
  profile = { name, gender: draft.gender, avatar: draft.avatar };
  await net.saveProfile(profile);
  // 이미 들어가 있던 게임의 이름표·인형도 바꾼다
  if (G.code) net.joinGame(G.code, profile);
  toLobby();
};

/* ---------- 게임 고르기 ---------- */
function toLobby() {
  $('#lobbyAvatar').src = W.avatarThumb(profile.avatar);
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
    const teams = {};
    TEAM_PRESET.slice(0, +$('#cTeams').value).forEach(([name, color], i) => (teams['t' + (i + 1)] = { name, color }));
    const code = await net.createGame({ name: $('#cName').value.trim(), center, radius: +$('#cRadius').value, layer: 'sat' }, teams, profile);
    msg.textContent = '';
    enter(code);
  } catch (er) { msg.className = 'msg err'; msg.textContent = er.message || '만들지 못했어요.'; }
};

/* ---------- 게임 ---------- */
const G = { code: null, meta: {}, teams: {}, members: {}, pos: {}, missions: {}, done: {}, feed: [], off: null, areaKey: '' };
const myTeam = () => G.members[net.me()]?.team || '';
const isHost = () => G.meta.host === net.me();
const teamOf = tid => G.teams[tid] || { name: '팀 없음', color: '#8a8070' };
let myLL = null, tab = 'missions', unseen = 0;

async function enter(code) {
  if (!code) return;
  const msg = $('#lobbyMsg');
  const meta = await net.gameMeta(code).catch(() => null);
  if (!meta) { msg.className = 'msg err'; msg.textContent = `'${code}' 게임을 찾지 못했어요.`; return; }
  msg.className = 'msg'; msg.textContent = '들어가는 중…';
  try { await net.joinGame(code, profile); }
  catch (er) { msg.className = 'msg err'; msg.textContent = `들어가지 못했어요 (${er.code || er.message}). 진행자에게 알려 주세요.`; return; }
  msg.textContent = '';
  net.presence(code);
  store.set('lastGame', code);
  history.replaceState(null, '', `?${DEMO ? 'demo&' : ''}${FAKE ? `fakegps=${FAKE.lat},${FAKE.lng}&` : ''}g=${code}`);
  G.code = code;
  G.feed = [];
  show('game');
  $('#nogl').hidden = W.hasGL;
  W.start();
  G.off?.();
  G.off = net.watch(code, {
    meta: v => { G.meta = v; onMeta(); },
    teams: v => { G.teams = v; refresh(); },
    members: v => { G.members = v; refresh(); },
    pos: v => { G.pos = v; syncPlayers(); if (tab === 'people') renderPanel(); },
    missions: v => { G.missions = v; refresh(); checkArrive(); },
    done: v => { bumpScores(v); G.done = v; refresh(); },
    feed: (f, isNew) => {
      G.feed.unshift(f);
      if (G.feed.length > 60) G.feed.pop();
      if (isNew) { toast(f.text); if (tab !== 'feed') unseen++; }
      if (tab === 'feed') renderPanel(); else renderTabs();
    },
  });
  W.follow(net.me());
  // 지난번 방식을 이어 가고, 처음이면 GPS를 바로 켠다 (끄기를 골랐던 사람만 꺼진 채로). 데모는 늘 테스트
  setMode(FAKE ? 'gps' : DEMO ? 'sim' : store.get('posMode') || 'gps');
}

function onMeta() {
  $('#gName').textContent = G.meta.name || '';
  $('#gStatus').textContent = `${STATUS[G.meta.status] || ''} · 코드 ${G.code}`;
  $('#hostTab').hidden = !isHost();
  simHome();
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
  renderScores();
  syncPlayers();
  syncMissions();
  renderTabs();
  renderPanel();
  // 팀이 아직 없으면 고르게 한다 (진행자는 팀 없이도 된다)
  if (G.members[net.me()] && !myTeam() && !isHost() && Object.keys(G.teams).length && $('#sheet').hidden) teamPicker();
}

/* ---------- 점수판 ---------- */
const teamScore = tid => {
  const d = Object.values(G.done[tid] || {}).filter(x => x.status === 'ok');
  return { n: d.length, pts: d.reduce((s, x) => s + (+x.pts || 0), 0) };
};
let lastCounts = {};
function bumpScores(next) {
  Object.keys(next).forEach(tid => {
    const n = Object.values(next[tid] || {}).filter(x => x.status === 'ok').length;
    if (lastCounts[tid] != null && n > lastCounts[tid]) setTimeout(() => document.querySelector(`.score[data-t="${tid}"]`)?.classList.add('bump'), 30);
    lastCounts[tid] = n;
  });
}
function renderScores() {
  const total = Object.values(G.missions).filter(m => m.open !== false).length;
  const ranked = Object.entries(G.teams).map(([tid, t]) => ({ tid, t, ...teamScore(tid) })).sort((a, b) => b.pts - a.pts || b.n - a.n);
  $('#scores').innerHTML = ranked.map(({ tid, t, n, pts }) => `
    <div class="score ${tid === myTeam() ? 'mine' : ''}" data-t="${tid}">
      <i style="background:${esc(t.color)}"></i><div><b>${esc(t.name)}</b><small>${pts}점</small></div><em>${n}</em><small>/${total}</small>
    </div>`).join('');
  document.querySelectorAll('.score').forEach(el => {
    el.onclick = () => focusTeam(el.dataset.t);
    el.addEventListener('animationend', () => el.classList.remove('bump'));
  });
}

/* ---------- 3D에 반영 ---------- */
function syncPlayers() {
  if (!W.frame()) return;
  const now = Date.now();
  Object.entries(G.members).forEach(([uid, m]) => {
    const p = G.pos[uid];
    if (!p) { W.removePlayer(uid); return; }
    const stale = !m.online || now - (p.t || 0) > STALE;
    W.upsertPlayer({ uid, name: m.name, avatar: m.avatar, color: teamOf(m.team).color, team: m.team, me: uid === net.me(), sub: stale ? ago(p.t) : '' });
    W.movePlayer(uid, p, stale);
  });
}
function syncMissions() {
  if (!W.frame()) return;
  const mine = myTeam();
  const seen = new Set();
  Object.entries(G.missions).forEach(([id, m]) => {
    if (m.open === false && !isHost()) { W.removeMission(id); return; }
    seen.add(id);
    const st = G.done[mine]?.[id]?.status;
    const by = Object.keys(G.teams).filter(t => G.done[t]?.[id]?.status === 'ok').map(t => G.teams[t].name).join('·');
    W.upsertMission({ id, title: `${TYPES[m.type]?.[0] || '📍'} ${m.title}`, lat: m.lat, lng: m.lng, r: m.r, dim: st === 'ok' || m.open === false,
      color: st === 'ok' ? '#7fdc8f' : st === 'wait' ? '#f0d79a' : '#ffcf6a', sub: `${m.pts || 0}점${by ? ' · ✓ ' + by : ''}` });
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
document.querySelectorAll('.tabs button[data-tab]').forEach(b => (b.onclick = () => { tab = b.dataset.tab; if (tab === 'feed') unseen = 0; $('#dock').classList.remove('min'); renderTabs(); renderPanel(); }));
$('#grip').onclick = () => { $('#dock').classList.toggle('min'); $('#grip').textContent = $('#dock').classList.contains('min') ? '▴' : '▾'; };
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
  if (tab === 'feed') el.innerHTML = G.feed.length ? G.feed.map(f => `<div class="feed"><time>${clock(f.t)}</time><span><span class="dot" style="background:${esc(teamOf(f.team).color)}"></span> ${esc(f.text)}</span></div>`).join('') : '<p class="empty">아직 소식이 없어요.</p>';
  if (tab === 'host') el.innerHTML = hostPanel();
  el.querySelectorAll('[data-m]').forEach(n => (n.onclick = () => openMission(n.dataset.m)));
  el.querySelectorAll('[data-u]').forEach(n => (n.onclick = () => focusPlayer(n.dataset.u)));
  el.querySelectorAll('[data-t]').forEach(n => (n.onclick = () => focusTeam(n.dataset.t)));
  if (tab === 'host') bindHost(el);
}
const clock = t => (t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '');
const sortedMissions = () => Object.entries(G.missions).filter(([, m]) => m.open !== false || isHost()).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
function missionList() {
  const list = sortedMissions();
  if (!list.length) return `<p class="empty">아직 미션이 없어요.${isHost() ? '<br>진행 탭에서 미션을 더해 주세요.' : ''}</p>`;
  const mine = myTeam();
  return list.map(([id, m]) => {
    const st = G.done[mine]?.[id]?.status;
    const d = myLL ? fmtDist(dist(myLL, m)) : '';
    const dots = Object.entries(G.teams).filter(([t]) => G.done[t]?.[id]?.status === 'ok').map(([, t]) => `<i style="background:${esc(t.color)}"></i>`).join('');
    return `<div class="item" data-m="${id}">
      <div class="ic ${st || ''}">${st === 'ok' ? '✓' : st === 'wait' ? '⏳' : TYPES[m.type]?.[0] || '📍'}</div>
      <div class="tx"><b>${esc(m.title)}</b><small>${TYPES[m.type]?.[1] || ''} · ${m.pts || 0}점${m.open === false ? ' · 닫힘' : ''}<span class="dots">${dots}</span></small></div>
      <div class="rt">${d}</div></div>`;
  }).join('');
}
function peopleList() {
  const groups = {};
  Object.entries(G.members).forEach(([uid, m]) => (groups[m.team || ''] ||= []).push([uid, m]));
  const order = [...Object.keys(G.teams), ''];
  return order.filter(t => groups[t]).map(t => {
    const team = teamOf(t), s = t ? teamScore(t) : null;
    return `<div class="group-h" data-t="${t}"><span class="dot" style="background:${esc(team.color)}"></span><b>${esc(team.name)}</b>${s ? ` · 미션 ${s.n} · ${s.pts}점` : ''}</div>` +
      groups[t].map(([uid, m]) => {
        const p = G.pos[uid], live = m.online && p && Date.now() - (p.t || 0) < STALE;
        return `<div class="item" data-u="${uid}"><img class="mini" src="${thumb(m.avatar)}" alt="">
          <div class="tx"><b>${esc(m.name)}${uid === net.me() ? ' (나)' : ''}${uid === G.meta.host ? ' · 진행자' : ''}</b>
          <small><span class="dot ${live ? 'on-dot' : 'off-dot'}"></span> ${p ? (live ? '위치 공유 중' : ago(p.t) + ' 위치') : '위치 없음'}</small></div>
          <div class="rt">${myLL && p && uid !== net.me() ? fmtDist(dist(myLL, p)) : ''}</div></div>`;
      }).join('');
  }).join('');
}
const thumbs = {};
const thumb = t => (thumbs[t] ||= W.avatarThumb(t || 'man'));

/* ---------- 찾기: 별칭이나 팀 이름 → 그 미니미에게로 ---------- */
const findEl = $('#find'), findsEl = $('#finds');
function finds(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const teams = Object.entries(G.teams).filter(([, t]) => t.name.toLowerCase().includes(q)).map(([tid, t]) => ({ kind: 't', id: tid, label: t.name, color: t.color, sub: `팀 · ${Object.values(G.members).filter(m => m.team === tid).length}명` }));
  const people = Object.entries(G.members).filter(([, m]) => (m.name || '').toLowerCase().includes(q)).map(([uid, m]) => ({ kind: 'u', id: uid, label: m.name, color: teamOf(m.team).color, sub: teamOf(m.team).name + (G.pos[uid] ? '' : ' · 위치 없음'), avatar: m.avatar }));
  return [...people, ...teams].slice(0, 12);
}
findEl.oninput = () => {
  const r = finds(findEl.value);
  findsEl.hidden = !findEl.value.trim();
  findsEl.innerHTML = r.length ? r.map(x => `<button data-k="${x.kind}" data-id="${x.id}">${x.avatar ? `<img class="mini" src="${thumb(x.avatar)}" alt="">` : `<span class="dot" style="background:${esc(x.color)};width:14px;height:14px"></span>`}<span><b>${esc(x.label)}</b><br><small class="fine">${esc(x.sub)}</small></span></button>`).join('') : '<div class="none">찾는 사람이나 팀이 없어요.</div>';
  findsEl.querySelectorAll('button').forEach(b => (b.onclick = () => { closeFind(); b.dataset.k === 'u' ? focusPlayer(b.dataset.id) : focusTeam(b.dataset.id); }));
};
findEl.onkeydown = e => { if (e.key === 'Enter') { const r = finds(findEl.value)[0]; if (r) { closeFind(); r.kind === 'u' ? focusPlayer(r.id) : focusTeam(r.id); } } if (e.key === 'Escape') closeFind(); };
const closeFind = () => { findsEl.hidden = true; findEl.value = ''; findEl.blur(); };
document.addEventListener('pointerdown', e => { if (!e.target.closest('.finder')) findsEl.hidden = true; });

function focusPlayer(uid) {
  const p = G.pos[uid], m = G.members[uid];
  if (!p) { toast(`${m?.name || ''} 님은 아직 위치를 공유하지 않았어요.`); return; }
  W.flyTo(p, 110);
  W.follow(uid);
  setFab();
  toast(`${m.name} · ${teamOf(m.team).name}${myLL && uid !== net.me() ? ' · ' + fmtDist(dist(myLL, p)) : ''} — 따라가는 중`);
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
const setFab = () => $('#fabMe').classList.toggle('on', W.following() === net.me());
$('#fabMe').onclick = () => { if (G.pos[net.me()]) { W.follow(net.me()); W.flyTo(G.pos[net.me()], 140); } else toast('먼저 위치 공유를 켜 주세요.'); setFab(); };
$('#fabAll').onclick = () => { W.resetView(); setFab(); };
$('#fabLayer').onclick = () => {
  const layer = G.meta.layer === 'map' ? 'sat' : 'map';
  if (isHost()) net.saveMeta(G.code, { layer });
  else { G.meta.layer = layer; onMeta(); } // 참가자는 내 화면에서만 바꾼다
};
W.on('tapPlayer', focusPlayer);
W.on('tapMission', openMission);
W.on('tapGround', ll => {
  if (placing) { const f = placing; placing = null; $('#placing').hidden = true; f(ll); return; }
  if (sim) setMyPos({ lat: ll.lat, lng: ll.lng, acc: 3 });
});

/* ---------- 내 위치: 끔 · GPS · 지도로 테스트 ---------- */
// 지도로 테스트: 게임 지역 밖(예: 대전에서 전주 게임)에서 시험할 때 GPS 대신 지도를 눌러 내 자리를 정한다.
// 다음에 들어올 때도 같은 방식으로 이어지게 기기에 기억한다
let watchId = null, lastSent = null, wake = null, sim = false;
$('#gpsBtn').onclick = () => setMode('gps');
$('#simBtn').onclick = () => setMode('sim');
$('#offBtn').onclick = () => setMode('off');
function setMode(mode) {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  wake?.release?.().catch(() => {}); wake = null;
  sim = mode === 'sim';
  W.setGroundFirst(sim);
  $('#gpsBtn').hidden = mode === 'gps';
  $('#simBtn').hidden = mode === 'sim';
  $('#offBtn').hidden = mode === 'off';
  if (!DEMO && !FAKE) store.set('posMode', mode);
  if (mode === 'off') {
    // 끄면 내 좌표를 지워 다른 사람 지도에서도 내 인형이 사라진다
    myLL = null; lastSent = null;
    if (G.code) net.clearPos(G.code);
    gpsText('위치 공유가 꺼져 있어요');
    return;
  }
  if (mode === 'sim') {
    gpsText('테스트: 지도를 누르면 내 인형이 그리로 걸어가요');
    // 아직 자리가 없으면 게임 지역 가운데에 세운다 (GPS로 받은 먼 좌표도 버린다)
    simHome();
    return;
  }
  if (FAKE) { setMyPos(FAKE); return; }
  if (!navigator.geolocation) { gpsText('이 기기는 위치를 알 수 없어요.'); setMode('off'); return; }
  gpsText('위치를 찾는 중…');
  watchId = navigator.geolocation.watchPosition(
    p => { const f = cleanFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); if (f) setMyPos(f); },
    e => { gpsText(e.code === 1 ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.' : '위치를 찾지 못했어요.'); $('#gpsBtn').hidden = false; },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  // 화면이 꺼지면 브라우저가 위치를 멈추므로 켜 둔다
  navigator.wakeLock?.request('screen').then(w => (wake = w)).catch(() => {});
}
// 다른 앱에 다녀오면 화면 켜 두기가 풀리므로 다시 건다
document.addEventListener('visibilitychange', () => { if (!document.hidden && watchId != null) navigator.wakeLock?.request('screen').then(w => (wake = w)).catch(() => {}); });
const gpsText = t => ($('#gpsText').textContent = t);
// 게임 정보(meta)가 아직 안 왔으면 onMeta에서 다시 부른다
function simHome() {
  const c = G.meta.center;
  if (sim && c && (!myLL || dist(myLL, c) > (G.meta.radius || 600) * 1.5)) setMyPos({ lat: c.lat, lng: c.lng, acc: 3 });
}
// 게임 지역에서 이만큼 넘게 떨어진 위치는 기기가 잘못 알려 준 것으로 본다 (PC 브라우저의 와이파이 위치가 베이징으로 잡힌 일이 있었다)
const WILD = 100e3;
function setMyPos(p) {
  if (!sim && G.meta.center && dist(p, G.meta.center) > WILD) {
    gpsText(`기기가 알려 준 위치가 이상해요 (게임 지역에서 ${fmtDist(dist(p, G.meta.center))}) — 폰에서 '정확한 위치'를 켜거나 🧪 지도로 테스트를 써 주세요`);
    return;
  }
  myLL = p;
  W.setAccuracy(net.me(), sim ? 0 : p.acc);
  const first = !lastSent;
  const away = !sim && G.meta.center ? dist(p, G.meta.center) - (G.meta.radius || 600) : 0;
  gpsText(sim ? '테스트: 지도를 누르면 내 인형이 그리로 걸어가요'
    // 수백 m 오차는 대개 '대략적 위치'만 허용된 것 (안드로이드 12+, iOS '정확한 위치' 끔)
    : p.acc > 300 ? `위치가 대략적으로만 잡혀요 (오차 ${fmtDist(p.acc)}) — 폰 설정에서 이 사이트의 '정확한 위치'를 켜 주세요`
    : away > 0 ? `게임 지역에서 ${fmtDist(away)} 밖 · 오차 ${p.acc}m` : `위치 공유 중 · 오차 ${p.acc}m${p.acc > 40 ? ' (실내면 커요)' : ''}`);
  // 3m 넘게 움직였거나 8초가 지났을 때만 올린다 (배터리·데이터 아끼기)
  const moved = !lastSent || dist(lastSent, p) > 3 || Date.now() - lastSent.at > 8000;
  if (moved) { lastSent = { ...p, at: Date.now() }; net.writePos(G.code, p); }
  if (first) { W.follow(net.me()); W.flyTo(p, 140); setFab(); }
  checkArrive();
  if (tab === 'missions') renderPanel();
}

/* ---------- 미션 수행 ---------- */
const near = m => myLL && (!m.r || dist(myLL, m) <= m.r + Math.min(myLL.acc || 0, 15)); // GPS 오차를 15m까지는 봐준다
const busy = new Set();
function checkArrive() {
  if (G.meta.status !== 'live' || !myTeam() || !myLL) return;
  Object.entries(G.missions).forEach(([id, m]) => {
    if (m.type !== 'arrive' || m.open === false || G.done[myTeam()]?.[id] || busy.has(id) || !near(m)) return;
    busy.add(id);
    finish(id, m, 'ok').finally(() => busy.delete(id));
  });
}
async function finish(id, m, status) {
  const t = myTeam();
  try {
    await net.complete(G.code, t, id, { name: profile.name, pts: m.pts || 0, status });
    await net.say(G.code, t, `${teamOf(t).name} ${profile.name} — '${m.title}' ${status === 'ok' ? '완료!' : '확인 요청'}`);
  } catch { /* 다른 팀원이 먼저 해냈으면 규칙이 막는다 */ }
}
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
  const t = myTeam(), d = G.done[t]?.[id], live = G.meta.status === 'live';
  const others = Object.entries(G.teams).map(([tid, tm]) => {
    const x = G.done[tid]?.[id];
    return `<span class="pill ${x?.status || ''}"><span class="dot" style="background:${esc(tm.color)}"></span> ${esc(tm.name)} ${x?.status === 'ok' ? '✓' : x ? '⏳' : '—'}</span>`;
  }).join('');
  let act = '';
  if (d?.status === 'ok') act = `<div class="box">✓ 우리 팀이 해냈어요 (${esc(d.name)}, ${clock(d.t)})</div>`;
  else if (d?.status === 'wait') act = `<div class="box">⏳ 진행자가 확인하고 있어요.</div>`;
  else if (!t) act = `<div class="box">팀에 들어가야 미션을 할 수 있어요.</div>`;
  else if (!live) act = `<div class="box">${G.meta.status === 'ended' ? '게임이 끝났어요.' : '진행자가 게임을 시작하면 열려요.'}</div>`;
  else if (!near(m)) act = `<div class="box">${myLL ? `${fmtDist(dist(myLL, m))} 남았어요. ` : '위치 공유를 켜 주세요. '}반경 ${m.r}m 안으로 가면 ${m.type === 'arrive' ? '저절로 완료돼요' : '열려요'}.</div>`;
  else if (m.type === 'quiz') act = `<div class="box">${esc(m.q)}</div><form class="row" id="qForm"><input id="qAns" placeholder="정답" autocomplete="off"><button class="btn primary">제출</button></form><p class="msg" id="qMsg"></p>`;
  else if (m.type === 'photo') act = `<label class="btn wide primary" style="text-align:center">📷 사진 찍어 올리기<input type="file" accept="image/*" capture="environment" id="photoIn" hidden></label><p class="msg" id="qMsg"></p>`;
  else if (m.type === 'task') act = `<button class="btn wide primary" id="taskBtn">🙌 해냈어요 — 진행자에게 확인 요청</button>`;
  else act = `<div class="box">도착! 곧 완료돼요.</div>`;
  // 지도로 테스트 중: 미션 자리로 바로 옮겨 가 본다
  if (sim && !d) act += `<button class="btn wide" id="simGo">🧪 여기로 이동 (테스트)</button>`;
  const host = isHost() ? `<div class="hostgrid"><button class="btn small" id="mEdit">수정</button><button class="btn small" id="mToggle">${m.open === false ? '열기' : '닫기'}</button><button class="btn small danger" id="mDel">삭제</button></div>` : '';
  openSheet(`<p class="eyebrow">${TYPES[m.type]?.[0]} ${TYPES[m.type]?.[1]} · ${m.pts || 0}점</p><h3>${esc(m.title)}</h3>
    ${m.desc ? `<p class="fine">${esc(m.desc)}</p>` : ''}<div class="teamrow">${others}</div>${act}${host}`, el => {
    el.querySelector('#qForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const a = el.querySelector('#qAns').value;
      const ok = m.ah ? (await answerHash(id, a)) === m.ah : norm(a) === norm(m.ans || '');
      if (ok) { await finish(id, m, 'ok'); closeSheet(); toast('정답이에요! 🎉'); }
      else { const q = el.querySelector('#qMsg'); q.className = 'msg err'; q.textContent = '아니에요. 다시 생각해 보세요.'; }
    });
    el.querySelector('#photoIn')?.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      el.querySelector('#qMsg').textContent = '올리는 중…';
      await net.savePhoto(G.code, t, id, await shrink(f));
      await finish(id, m, 'wait');
      closeSheet(); toast('사진을 올렸어요. 진행자가 확인하면 점수가 올라가요.');
    });
    el.querySelector('#simGo')?.addEventListener('click', () => { closeSheet(); setMyPos({ lat: m.lat, lng: m.lng, acc: 3 }); setTimeout(() => openMission(id), 300); });
    el.querySelector('#taskBtn')?.addEventListener('click', async () => { await finish(id, m, 'wait'); closeSheet(); toast('확인을 요청했어요.'); });
    el.querySelector('#mEdit')?.addEventListener('click', () => missionForm(id));
    el.querySelector('#mToggle')?.addEventListener('click', async () => { await net.saveMission(G.code, id, { ...m, open: m.open === false }); closeSheet(); });
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
const pendings = () => Object.entries(G.done).flatMap(([tid, ms]) => Object.entries(ms || {}).filter(([, d]) => d.status === 'wait').map(([mid, d]) => ({ tid, mid, d })));
function hostPanel() {
  const st = G.meta.status;
  const link = `${location.origin}${location.pathname}?g=${G.code}`;
  const waits = pendings();
  return `<div class="code">${G.code}</div><p class="fine" style="text-align:center">참가자에게 이 코드를 알려 주세요 · <button class="link" id="hCopy" data-link="${esc(link)}">초대 링크 복사</button></p>
    <div class="hostgrid">
      ${st !== 'live' ? `<button class="btn primary small" id="hStart">▶ ${st === 'ended' ? '다시 시작' : '게임 시작'}</button>` : `<button class="btn small" id="hEnd">■ 게임 끝내기</button>`}
      <button class="btn small" id="hAdd">＋ 미션 더하기</button>
      <button class="btn small" id="hTeams">팀 정하기</button>
      <button class="btn small" id="hNotice">📣 알림 보내기</button>
      <button class="btn small" id="hArea">🗺 지역 바꾸기</button>
    </div>
    <div class="group-h">확인을 기다리는 미션 ${waits.length}</div>
    ${waits.length ? waits.map(({ tid, mid, d }) => `<div class="item" data-judge="${tid}|${mid}"><div class="ic wait">${TYPES[G.missions[mid]?.type]?.[0] || '⏳'}</div>
      <div class="tx"><b>${esc(G.missions[mid]?.title || mid)}</b><small><span class="dot" style="background:${esc(teamOf(tid).color)}"></span> ${esc(teamOf(tid).name)} · ${esc(d.name)} · ${clock(d.t)}</small></div><div class="rt">보기 ›</div></div>`).join('') : '<p class="empty">없어요.</p>'}`;
}
function bindHost(el) {
  el.querySelector('#hCopy')?.addEventListener('click', e => { navigator.clipboard?.writeText(e.target.dataset.link); toast('초대 링크를 복사했어요.'); });
  el.querySelector('#hStart')?.addEventListener('click', async () => { await net.setStatus(G.code, 'live'); net.say(G.code, '', '📣 게임이 시작됐어요!'); });
  el.querySelector('#hEnd')?.addEventListener('click', async e => { if (!confirmIn(e.target)) return; await net.setStatus(G.code, 'ended'); net.say(G.code, '', '📣 게임이 끝났어요. 수고하셨어요!'); });
  el.querySelector('#hAdd')?.addEventListener('click', () => missionForm());
  el.querySelector('#hTeams')?.addEventListener('click', teamEditor);
  el.querySelector('#hArea')?.addEventListener('click', areaEditor);
  el.querySelector('#hNotice')?.addEventListener('click', () => openSheet(`<h3>모두에게 알림</h3><form class="stack" id="nf"><input id="nt" placeholder="예: 10분 뒤 광장에 모여요" required><button class="btn primary">보내기</button></form>`,
    s => (s.querySelector('#nf').onsubmit = async e => { e.preventDefault(); await net.say(G.code, '', '📣 ' + s.querySelector('#nt').value.trim()); closeSheet(); })));
  el.querySelectorAll('[data-judge]').forEach(n => (n.onclick = () => judgeSheet(...n.dataset.judge.split('|'))));
}
async function judgeSheet(tid, mid) {
  const m = G.missions[mid] || {}, d = G.done[tid]?.[mid];
  openSheet(`<p class="eyebrow">확인 요청 · ${esc(teamOf(tid).name)}</p><h3>${esc(m.title)}</h3><p class="fine">${esc(d?.name)} · ${clock(d?.t)}</p>
    <div id="ph">${m.type === 'photo' ? '<p class="fine">사진을 불러오는 중…</p>' : ''}</div>
    <div class="grid2"><button class="btn danger" id="jNo">다시 하게 하기</button><button class="btn primary" id="jOk">인정 (+${m.pts || 0}점)</button></div>`, async el => {
    el.querySelector('#jOk').onclick = async () => { await net.judge(G.code, tid, mid, true); net.say(G.code, tid, `${teamOf(tid).name} — '${m.title}' 완료!`); closeSheet(); };
    el.querySelector('#jNo').onclick = async () => { await net.judge(G.code, tid, mid, false); await net.delPhoto(G.code, tid, mid); net.say(G.code, tid, `${teamOf(tid).name} — '${m.title}' 다시 해 주세요`); closeSheet(); };
    if (m.type === 'photo') { const url = await net.getPhoto(G.code, tid, mid); el.querySelector('#ph').innerHTML = url ? `<img class="photo" src="${url}" alt="">` : '<p class="fine">사진이 없어요.</p>'; }
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
        net.say(G.code, '', '📣 게임 지역이 바뀌었어요');
        closeSheet();
        // 테스트 중이면 내 인형도 새 지역 가운데로
        if (sim) setMyPos({ lat: center.lat, lng: center.lng, acc: 3 });
        W.resetView();
      } catch (er) { msg.className = 'msg err'; msg.textContent = er.code === 1 ? '위치 권한이 꺼져 있어요.' : er.message || '바꾸지 못했어요.'; }
    };
  });
}
function teamEditor() {
  const rows = Object.entries(G.members).filter(([u]) => u !== G.meta.host || G.members[u].team).map(([uid, m]) => `<label>${esc(m.name)}<select data-mem="${uid}"><option value="">팀 없음</option>${Object.entries(G.teams).map(([tid, t]) => `<option value="${tid}" ${m.team === tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`).join('');
  const names = Object.entries(G.teams).map(([tid, t]) => `<div class="row"><input type="color" value="${esc(t.color)}" data-tc="${tid}" style="width:52px;padding:4px"><input value="${esc(t.name)}" data-tn="${tid}"></div>`).join('');
  openSheet(`<h3>팀 정하기</h3><div class="stack">${names}<button class="btn small" id="tSave">팀 이름·색 저장</button></div><div class="group-h">사람마다 팀</div><div class="stack">${rows}</div>
    <label style="margin-top:12px">진행자인 나도 팀에 들어가기<select data-mem="${G.meta.host}"><option value="">들어가지 않음</option>${Object.entries(G.teams).map(([tid, t]) => `<option value="${tid}" ${G.members[G.meta.host]?.team === tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`, el => {
    el.querySelectorAll('[data-mem]').forEach(s => (s.onchange = () => net.setTeam(G.code, s.dataset.mem, s.value)));
    el.querySelector('#tSave').onclick = async () => {
      const teams = {};
      Object.keys(G.teams).forEach(tid => (teams[tid] = { name: el.querySelector(`[data-tn="${tid}"]`).value.trim() || G.teams[tid].name, color: el.querySelector(`[data-tc="${tid}"]`).value }));
      await net.saveTeams(G.code, teams); toast('팀을 저장했어요.');
    };
  });
}
function missionForm(id, draftM) {
  const m = draftM || (id ? { ...G.missions[id] } : { type: 'arrive', r: 25, pts: 10, open: true, order: Object.keys(G.missions).length });
  openSheet(`<h3>${id ? '미션 고치기' : '새 미션'}</h3><form class="stack" id="mf">
    <input name="title" placeholder="미션 이름 (예: 경기전 홍살문)" value="${esc(m.title || '')}" required>
    <label>종류<select name="type">${Object.entries(TYPES).map(([k, [ic, n]]) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${ic} ${n}</option>`).join('')}</select></label>
    <textarea name="desc" placeholder="설명 (무엇을 하면 되는지)">${esc(m.desc || '')}</textarea>
    <div class="qa stack"><input name="q" placeholder="문제" value="${esc(m.q || '')}"><input name="ans" placeholder="${m.ah ? '정답 (바꿀 때만 적기)' : '정답 — 띄어쓰기·대소문자는 무시해요'}"></div>
    <div class="grid2"><label>반경(m)<input name="r" type="number" min="0" value="${m.r ?? 25}"></label><label>점수<input name="pts" type="number" min="0" value="${m.pts ?? 10}"></label></div>
    <div class="box" id="where">${m.lat ? `📍 ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : '위치를 정해 주세요'}</div>
    <div class="grid2"><button type="button" class="btn" id="pickMap">지도에서 고르기</button><button type="button" class="btn" id="pickMe">내 자리로</button></div>
    <button class="btn primary">저장</button><p class="msg" id="mfMsg"></p></form>`, el => {
    const f = el.querySelector('#mf');
    const qa = () => (el.querySelector('.qa').hidden = f.type.value !== 'quiz');
    f.type.onchange = qa; qa();
    const read = () => ({ ...m, title: f.title.value.trim(), type: f.type.value, desc: f.desc.value.trim(), q: f.q.value.trim(), r: +f.r.value || 0, pts: +f.pts.value || 0, _ans: f.ans.value });
    el.querySelector('#pickMap').onclick = () => {
      const cur = read();
      $('#sheet').hidden = true; $('#placing').hidden = false;
      placing = ll => missionForm(id, { ...cur, lat: ll.lat, lng: ll.lng });
    };
    el.querySelector('#pickMe').onclick = () => { if (!myLL) { el.querySelector('#mfMsg').textContent = '위치 공유를 먼저 켜 주세요.'; return; } missionForm(id, { ...read(), lat: myLL.lat, lng: myLL.lng }); };
    f.onsubmit = async e => {
      e.preventDefault();
      const v = read();
      if (!v.lat) { el.querySelector('#mfMsg').textContent = '위치를 정해 주세요.'; return; }
      if (v.type === 'quiz' && !v.ah && !v._ans.trim()) { el.querySelector('#mfMsg').textContent = '정답을 적어 주세요.'; return; }
      const ans = v._ans; delete v._ans; delete v.ans;
      if (v.type !== 'quiz') { delete v.q; delete v.ah; }
      // 새 미션은 id를 먼저 받아야 정답 해시를 만들 수 있다
      const isNew = !id;
      if (!id) { const r = await net.addMission(G.code, { ...v, open: true }); id = r?.key || Object.keys(G.missions).find(k => G.missions[k].title === v.title); }
      if (v.type === 'quiz' && ans.trim()) v.ah = await answerHash(id, ans);
      await net.saveMission(G.code, id, v);
      if (G.meta.status === 'live' && isNew) net.say(G.code, '', `📣 새 미션 — '${v.title}'`);
      closeSheet();
    };
  });
}

/* ---------- 알림 ---------- */
function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
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
