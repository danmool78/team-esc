/* 3D 세계: 지형 위에 참가자 인형과 미션 표지를 세우고, 비스듬히 내려다보는 카메라로 그린다.
   조작은 그 길(the-way-jesus)의 3D 지형 모드와 같게 — 마우스: 끌면 옮기고, 오른쪽 버튼(또는 Shift)으로 끌면 돌리고 기울이고, 바퀴로 당긴다.
   손가락: 하나로 옮기고, 둘로 벌려 당기고 비틀어 돌리고 함께 위아래로 밀어 기울인다 — 지도를 손으로 잡은 듯 손가락 방향 그대로 (마우스와 반대).
   내 위치 따라가기(◎): 나는 늘 화면 가운데, 진행 방향이 화면 위로 오게 지도가 돌고 움직인다.
   지형은 카메라가 보는 곳 둘레를 조각조각 이어 받아 그린다 (terrain.js) — 지도를 끌어 옮기면 그쪽 땅이 따라 생긴다.
   인형은 실제 크기로는 점처럼 작아 보여서, 카메라가 멀어질수록 함께 키운다 (자리는 그대로, 크기만) */
import { THREE, damp, glowTexture } from './stage/kit.js';
import { Actor } from './stage/people.js';
import { buildTerrain } from './terrain.js';

const wrap = document.getElementById('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch { /* WebGL이 없으면 app.js가 목록 화면만 보여 준다 */ }
export const hasGL = !!renderer;

const scene = new THREE.Scene();
const SKY = new THREE.Color('#c9d6dc');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 800, 2600);
const camera = new THREE.PerspectiveCamera(40, 1, 1, 8000);
scene.add(new THREE.HemisphereLight(0xfff4dc, 0x6b6250, 1.7));
const sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
sun.position.set(-400, 700, -300);
scene.add(sun);

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);
}

let T = null; // 지형 {group, heightAt, frame, want, radius}
const players = new Map(), missions = new Map();
const cam = { tx: 0, tz: 0, dist: 520, pitch: 0.85, yaw: 0, follow: null, headUp: false };
const goal = { ...cam };
const hooks = { tapPlayer: null, tapMission: null, tapGround: null, unfollow: null };
let compass = null; // 폰 나침반이 알려 준 내 방위 (북에서 시계 방향, 라디안). 없으면 걸어간 방향을 쓴다
export const on = (k, f) => (hooks[k] = f);

/* ---------- 지형 ---------- */
let loadSeq = 0;
export async function loadArea(area) {
  // 지역을 연달아 바꾸면 늦게 끝난 옛 지역이 새 지역을 덮어쓰지 않게, 마지막 요청만 받아들인다
  const seq = ++loadSeq;
  const t = await buildTerrain(area);
  await t.prime(300); // 가운데만 받으면 바로 띄우고, 나머지는 가까운 순서로 채워 넣는다
  if (seq !== loadSeq) { t.dispose(); return null; }
  if (T) { scene.remove(T.group); T.dispose(); if (T.edge) { scene.remove(T.edge); T.edge.geometry.dispose(); } }
  T = t;
  T.radius = area.radius;
  T.edgeR = area.radius;
  T.edgeVer = -1;
  scene.add(T.group);
  Object.assign(goal, { tx: 0, tz: 0, dist: area.radius * 1.5 });
  Object.assign(cam, { tx: 0, tz: 0, dist: area.radius * 1.5 });
  // 이미 들어와 있던 사람·미션을 새 지형 좌표로 다시 놓는다
  players.forEach(p => p.ll && placePlayer(p, p.ll, true));
  missions.forEach(m => placeMission(m));
  return T;
}
export const frame = () => T && T.frame;
// 게임 반경: 땅 위에 깔린 금색 띠(폭 EDGE m). 지도는 반경과 상관없이 어디로든 옮겨 볼 수 있고, 이 띠만 게임 지역을 알려 준다.
// 조각이 새로 생길 때마다 띠를 땅 높이에 다시 맞춘다
const EDGE = 5, edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
let edgeAt = 0;
function drawEdge(now) {
  if (!T.edgeR || T.edgeVer === T.version || now - edgeAt < 500) return;
  edgeAt = now; T.edgeVer = T.version;
  if (T.edge) { scene.remove(T.edge); T.edge.geometry.dispose(); }
  const S = 256, pos = new Float32Array((S + 1) * 6), idx = [];
  for (let a = 0; a <= S; a++) {
    const sx = Math.sin(a / S * Math.PI * 2), cz = Math.cos(a / S * Math.PI * 2);
    [T.edgeR - EDGE / 2, T.edgeR + EDGE / 2].forEach((r, k) => {
      const x = sx * r, z = cz * r;
      pos.set([x, T.heightAt(x, z) + 1.5, z], (a * 2 + k) * 3);
    });
    if (a < S) idx.push(a * 2, a * 2 + 1, a * 2 + 2, a * 2 + 1, a * 2 + 3, a * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  T.edge = new THREE.Mesh(geo, edgeMat);
  T.edge.renderOrder = 2;
  scene.add(T.edge);
}

/* ---------- 이름표: 캔버스 글씨를 스프라이트로 ---------- */
function label(text, color = '#1d1813', sub = '') {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const f = '700 30px "Noto Sans KR", sans-serif', fs = '500 22px "Noto Sans KR", sans-serif';
  g.font = f;
  const w = Math.ceil(Math.max(g.measureText(text).width, sub ? (g.font = fs, g.measureText(sub).width) : 0)) + 34;
  c.width = w; c.height = sub ? 86 : 54;
  g.fillStyle = color; g.globalAlpha = 0.9;
  g.beginPath(); g.roundRect(0, 0, w, c.height, 20); g.fill();
  g.globalAlpha = 1; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = f; g.fillText(text, w / 2, 28);
  if (sub) { g.font = fs; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(sub, w / 2, 62); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.userData.aspect = w / c.height;
  s.userData.h = c.height / 54;
  s.renderOrder = 10;
  return s;
}
function relabel(holder, key, ...args) {
  const old = holder[key];
  const s = label(...args);
  if (old) { s.position.copy(old.position); old.parent.add(s); old.parent.remove(old); old.material.map.dispose(); old.material.dispose(); }
  holder[key] = s;
  return s;
}

/* ---------- 참가자 ---------- */
// p: { uid, name, avatar, color, me }
export function upsertPlayer(info) {
  let p = players.get(info.uid);
  if (!p || p.avatar !== info.avatar) {
    if (p) scene.remove(p.g);
    const g = new THREE.Group();
    const actor = new Actor(info.avatar || 'disciple', 0, 0, 0);
    actor.settle();
    g.add(actor.p.root);
    // 발밑 고리: 팀 색. 멀리서도 누가 어느 팀인지 보이게
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 40), new THREE.MeshBasicMaterial({ color: info.color || '#fff', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    actor.p.root.add(ring);
    // 누르기 쉬운 보이지 않는 몸통
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.55; hit.userData.uid = info.uid;
    actor.p.root.add(hit);
    // 진행 방향: 발밑에서 앞으로 퍼지는 빛살(구글 지도처럼) + 그 끝의 화살촉. 나에게만 보인다.
    // 카메라가 내 뒤에 있어 인형과 이름표에 가리지 않을 만큼 길게 뻗고, 땅 굴곡에 묻히지 않게 늘 위에 그린다
    const arrow = new THREE.Group();
    const blue = { color: 0x3d8bff, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide };
    const fan = [0, 0, 0], col = [0.24, 0.55, 1, 0.5], N = 16, R = 3, A = 0.6;
    for (let i = 0; i <= N; i++) { const t = -A + (2 * A * i) / N; fan.push(Math.sin(t) * R, 0, -Math.cos(t) * R); col.push(0.24, 0.55, 1, 0); }
    const beamG = new THREE.BufferGeometry();
    beamG.setAttribute('position', new THREE.Float32BufferAttribute(fan, 3));
    beamG.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    beamG.setIndex([...Array(N)].flatMap((_, i) => [0, i + 1, i + 2]));
    const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ ...blue, color: 0xffffff, vertexColors: true, depthTest: true, polygonOffset: true, polygonOffsetFactor: -4 })); // 빛살은 인형 뒤로
    beam.position.y = 0.05; beam.renderOrder = 2;
    arrow.add(beam);
    const tri = new THREE.Shape([new THREE.Vector2(0, 2.75), new THREE.Vector2(0.36, 2.1), new THREE.Vector2(0, 2.26), new THREE.Vector2(-0.36, 2.1)]);
    const head = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ ...blue, opacity: 0.95 }));
    head.renderOrder = 3;
    head.rotation.x = -Math.PI / 2; head.position.y = 0.05; // 도형의 +y가 땅 위 -z(북)를 가리킨다
    arrow.add(head); arrow.visible = false;
    g.add(arrow);
    p = { ...(p || {}), uid: info.uid, actor, g, ring, hit, arrow, acc: null, cur: p?.cur || null, face: 0, hd: p?.hd ?? null }; // 오차 원은 새 묶음에 다시 단다
    scene.add(g);
    players.set(info.uid, p);
    p.tag = null;
  }
  Object.assign(p, { name: info.name, avatar: info.avatar, color: info.color, me: !!info.me, team: info.team });
  p.ring.material.color.set(info.color || '#ffffff');
  const sub = info.sub || '';
  if (!p.tag || p.tagKey !== p.name + p.color + sub) {
    p.tagKey = p.name + p.color + sub;
    relabel(p, 'tag', (p.me ? '나 · ' : '') + p.name, p.color || '#333', sub);
    if (!p.tag.parent) p.g.add(p.tag);
  }
  return p;
}
export function removePlayer(uid) {
  const p = players.get(uid);
  if (!p) return;
  scene.remove(p.g);
  players.delete(uid);
}
function placePlayer(p, ll, snap) {
  p.ll = ll;
  if (!T) return;
  const [x, z] = T.frame.toXZ(ll.lat, ll.lng);
  p.to = new THREE.Vector2(x, z);
  if (snap || !p.cur) p.cur = p.to.clone();
  // 진행 방향: 받은 좌표가 3m 넘게 옮겨 갈 때마다 그 방향 (북에서 시계 방향). 제자리 GPS 흔들림은 무시
  if (snap || !p.hdFrom) p.hdFrom = p.to.clone();
  else if (p.to.distanceTo(p.hdFrom) > 3) { p.hd = Math.atan2(p.to.x - p.hdFrom.x, -(p.to.y - p.hdFrom.y)); p.hdFrom = p.to.clone(); }
}
// 새 좌표가 오면 그 자리까지 걸어간다. stale: 오래 소식이 없으면 흐리게
export function movePlayer(uid, ll, stale = false) {
  const p = players.get(uid);
  if (!p) return;
  placePlayer(p, ll);
  p.actor.showT = stale ? 0.45 : 1;
}

// 내 위치의 오차 원: 실제 크기(m)로 땅 위에 흐리게. 0이면 숨긴다
export function setAccuracy(uid, m) {
  const p = players.get(uid);
  if (!p) return;
  if (!p.acc) {
    p.acc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.18, depthWrite: false }));
    p.acc.rotation.x = -Math.PI / 2; p.acc.position.y = 0.6;
    p.g.add(p.acc);
  }
  p.acc.visible = m > 3;
  p.acc.scale.setScalar(Math.max(m, 1));
}

/* ---------- 미션 표지: 빛기둥 + 도착 반경 고리 + 이름표 ---------- */
const beamTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();
// m: { id, title, lat, lng, r, color, sub }
export function upsertMission(m) {
  let o = missions.get(m.id);
  if (!o) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 0.5;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.5; hit.userData.mid = m.id;
    const pillar = new THREE.Group();
    pillar.add(beam, hit);
    g.add(pillar, glow, ring, disc);
    scene.add(g);
    o = { g, beam, glow, ring, disc, pillar, hit };
    missions.set(m.id, o);
  }
  Object.assign(o, m);
  const col = new THREE.Color(m.color || '#f0d79a');
  o.beam.material.color.copy(col); o.ring.material.color.copy(col); o.disc.material.color.copy(col); o.glow.material.color.copy(col);
  o.beam.material.opacity = m.dim ? 0.25 : 0.75;
  const key = m.title + m.color + (m.sub || '');
  if (o.tagKey !== key) { o.tagKey = key; relabel(o, 'tag', m.title, m.dim ? '#3a4a3a' : '#5a3d10', m.sub || ''); if (!o.tag.parent) o.g.add(o.tag); }
  placeMission(o);
  return o;
}
function placeMission(o) {
  if (!T) return;
  const [x, z] = T.frame.toXZ(o.lat, o.lng);
  const y = T.heightAt(x, z);
  o.g.position.set(x, y, z);
  const r = Math.max(o.r || 0, 4);
  o.ring.scale.setScalar(r); o.disc.scale.setScalar(r);
  o.ring.position.y = o.disc.position.y = 1.2;
}
export function removeMission(id) {
  const o = missions.get(id);
  if (o) { scene.remove(o.g); missions.delete(id); }
}

/* ---------- 카메라 ---------- */
// headUp: 그 사람의 진행 방향이 화면 위로 오게 지도를 돌린다 (내 위치 따라가기)
export function follow(uid, headUp = false) { cam.follow = uid; cam.headUp = !!uid && headUp; }
export const following = () => cam.follow;
// 폰 나침반 방위(도, 북에서 시계 방향). null이면 걸어간 방향으로 돌아간다
export function setCompass(deg) { compass = deg == null || !isFinite(deg) ? null : deg * Math.PI / 180; }
// 진행 방향(북에서 시계 방향, 라디안): 내 것은 나침반 우선, 아니면 마지막으로 걸어간 방향
const headingOf = p => (p.me && compass != null ? compass : p.hd);
// 각도를 기준 각도 가까이로 옮긴다 (359°→1°로 돌 때 한 바퀴 거꾸로 돌지 않게)
const near = (a, ref) => ref + Math.atan2(Math.sin(a - ref), Math.cos(a - ref));
export function flyTo(ll, dist) {
  if (!T) return;
  const [x, z] = T.frame.toXZ(ll.lat, ll.lng);
  Object.assign(goal, { tx: x, tz: z });
  if (dist) goal.dist = dist;
}
export function resetView() { cam.follow = null; cam.headUp = false; Object.assign(goal, { tx: 0, tz: 0, yaw: 0, pitch: 0.85, dist: T ? T.radius * 1.5 : 520 }); }
export const viewDist = () => cam.dist;

function clampGoal() {
  // 어디로든 옮길 수 있다 (가는 곳마다 지형을 받아 그린다). 게임 지역 둘레 150km까지 — 그 밖은 기기 위치 오류로 본다(app.js WILD)
  const lim = 150000;
  goal.tx = Math.max(-lim, Math.min(lim, goal.tx));
  goal.tz = Math.max(-lim, Math.min(lim, goal.tz));
  goal.dist = Math.max(25, Math.min(2500, goal.dist));
  goal.pitch = Math.max(0.3, Math.min(1.5, goal.pitch));
}
// 화면에서 끈 만큼 땅 위에서 옮긴다 (카메라 방위 기준)
function pan(dx, dy) {
  const k = cam.dist / wrap.clientHeight * 0.85;
  const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  goal.tx -= (dx * c + dy * s) * k;
  goal.tz -= (-dx * s + dy * c) * k;
  unfollow();
  clampGoal();
}
// 손으로 지도를 옮기면 따라가기를 멈추고 app.js에 알린다 (◎ 단추 불 끄기)
function unfollow() {
  if (!cam.follow) return;
  cam.follow = null; cam.headUp = false;
  hooks.unfollow?.();
}

/* ---------- 손가락·마우스 ---------- */
const ptrs = new Map();
let gesture = null, downAt = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
if (renderer) {
  const el = renderer.domElement;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    gesture = null;
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (ptrs.size === 1) {
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) downAt = null;
      if (e.buttons & 2 || e.shiftKey) { goal.yaw -= dx * 0.006; goal.pitch += dy * 0.005; clampGoal(); }
      else pan(dx, dy);
      p.x = e.clientX; p.y = e.clientY;
      return;
    }
    // 두 손가락: 벌리기 = 당기기, 비틀기 = 돌리기, 함께 위아래 = 기울이기.
    // 마우스는 '고개를 돌리는' 방향이지만 손가락은 지도를 잡은 듯 — 시계 방향으로 비틀면 지도도 시계 방향, 위로 밀면 위에서 내려다보게
    const [a, b] = [...ptrs.values()];
    const before = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 };
    p.x = e.clientX; p.y = e.clientY;
    const after = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 };
    goal.dist *= before.d / Math.max(after.d, 1);
    let da = after.ang - before.ang;
    if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > 0.004 && cam.headUp) cam.headUp = false; // 손으로 돌리면 진행 방향 맞추기를 멈춘다 (가운데 따라가기는 그대로)
    goal.yaw += da;
    goal.pitch -= (after.my - before.my) * 0.004;
    clampGoal();
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (downAt && performance.now() - downAt.t < 450) tap(e.clientX, e.clientY);
    downAt = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); downAt = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); goal.dist *= Math.exp(e.deltaY * 0.0012); clampGoal(); }, { passive: false });
}

let groundFirst = false;
export const setGroundFirst = v => (groundFirst = v);
function tap(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...[...players.values()].map(p => p.hit), ...[...missions.values()].map(m => m.hit)], false);
  // 지도로 테스트 중에는 사람 위를 눌러도 땅으로 친다 (사람이 서 있는 곳으로도 옮겨 가야 하니까)
  if (hits[0] && !(groundFirst && hits[0].object.userData.uid)) {
    const u = hits[0].object.userData;
    if (u.uid && hooks.tapPlayer) return hooks.tapPlayer(u.uid);
    if (u.mid && hooks.tapMission) return hooks.tapMission(u.mid);
  }
  if (T && hooks.tapGround) {
    const g = ray.intersectObject(T.group, true)[0];
    if (g) hooks.tapGround(T.frame.toLL(g.point.x, g.point.z));
  }
}

/* ---------- 그리기 ---------- */
let last = performance.now(), running = false;
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function frameLoop(now) {
  if (!running) return;
  requestAnimationFrame(frameLoop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!T) return;
  resize();

  const fp = cam.follow && players.get(cam.follow);
  goal.yaw = near(goal.yaw, cam.yaw);
  for (const k of ['tx', 'tz', 'dist', 'pitch', 'yaw']) cam[k] = damp(cam[k], goal[k], 6, dt);
  if (fp && fp.cur) {
    // 따라가는 사람은 늘 화면 한가운데 — 뒤늦게 쫓지 않고 바로 붙인다 (처음 날아가는 동안만 부드럽게)
    goal.tx = fp.cur.x; goal.tz = fp.cur.y;
    if (Math.hypot(cam.tx - goal.tx, cam.tz - goal.tz) < 8) { cam.tx = goal.tx; cam.tz = goal.tz; }
    // 진행 방향이 화면 위로: 카메라를 그 사람 뒤에 둔다 (yaw 0 = 북쪽을 봄, 방위 h면 yaw = -h)
    const h = cam.headUp ? headingOf(fp) : null;
    if (h != null) goal.yaw = near(-h, cam.yaw);
  }
  const ty = T.heightAt(cam.tx, cam.tz);
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, ty + Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
  camera.lookAt(cam.tx, ty, cam.tz);
  // 보는 곳 둘레의 지형 조각을 요청한다. 받아 둔 범위 바깥은 안개로 가린다
  const loadR = Math.max(450, Math.min(1600, cam.dist * 1.4));
  T.want(cam.tx, cam.tz, loadR);
  scene.fog.near = cam.dist * 0.8;
  scene.fog.far = cam.dist + loadR * 1.1;
  drawEdge(now);

  // 인형 크기: 가까이선 사람 크기(1.7m 남짓)로, 멀어지면 화면에서 알아볼 만큼 키운다
  const big = Math.max(2.5, cam.dist * 0.05);
  const t = now / 1000;
  players.forEach(p => {
    if (!p.cur) { p.g.visible = false; return; }
    p.g.visible = true;
    const d = p.to.clone().sub(p.cur), len = d.length();
    // 받은 좌표까지 사람 걸음보다 조금 빠르게 따라간다 (멀리 튀면 바로 옮긴다)
    if (len > 400) p.cur.copy(p.to);
    else if (len > 0.05) p.cur.addScaledVector(d.normalize(), Math.min(len, Math.max(1.6, len * 1.5) * dt));
    const moving = len > 0.6;
    if (moving) p.face = Math.atan2(d.x, d.y);
    const h = p.me ? headingOf(p) : null;
    p.arrow.visible = h != null;
    if (h != null) { p.arrow.rotation.y = damp(p.arrow.rotation.y, near(-h, p.arrow.rotation.y), 10, dt); p.arrow.scale.setScalar(big); }
    const a = p.actor;
    a.pos.set(0, 0); a.goal.set(0, 0);
    a.faceT = p.face;
    a.set(moving ? 'walk' : 'idle');
    a.big = big;
    a.update(t, dt);
    p.g.position.set(p.cur.x, T.heightAt(p.cur.x, p.cur.y), p.cur.y);
    const s = cam.dist * 0.019 * p.tag.userData.h;
    p.tag.scale.set(s * p.tag.userData.aspect, s, 1);
    p.tag.position.y = big * 1.05 + s * 0.7;
  });
  const beamH = Math.max(20, cam.dist * 0.16);
  missions.forEach(m => {
    const r = Math.max(1, cam.dist * 0.0022);
    m.pillar.scale.set(r, beamH, r);
    m.glow.scale.setScalar(r * 7);
    m.glow.position.y = 2;
    m.g.position.y = T.heightAt(m.g.position.x, m.g.position.z); // 조각이 늦게 생기면 그 높이로
    m.glow.material.opacity = (m.dim ? 0.35 : 0.8) + Math.sin(t * 2.5) * 0.15;
    const s = cam.dist * 0.018 * m.tag.userData.h;
    m.tag.scale.set(s * m.tag.userData.aspect, s, 1);
    m.tag.position.y = beamH + s * 0.6;
  });
  renderer.render(scene, camera);
}
export function start() { if (renderer && !running) { running = true; last = performance.now(); requestAnimationFrame(frameLoop); } }
export function stop() { running = false; }

/* ---------- 인형 고르기용 그림 ---------- */
// 고르는 화면에서 쓸 작은 그림을 한 번만 그려 둔다
let thumbR;
export function avatarThumb(type) {
  if (!renderer) return '';
  if (!thumbR) {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(120, 150, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xfff4dc, 0x6b6250, 2));
    const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(-1, 2, 2); s.add(l);
    const c = new THREE.PerspectiveCamera(26, 120 / 150, 0.1, 20);
    c.position.set(0, 0.75, 3.1); c.lookAt(0, 0.5, 0);
    thumbR = { r, s, c };
  }
  const a = new Actor(type, 0, 0, 0.35);
  a.settle();
  thumbR.s.add(a.p.root);
  thumbR.r.render(thumbR.s, thumbR.c);
  const url = thumbR.r.domElement.toDataURL('image/png');
  thumbR.s.remove(a.p.root);
  return url;
}
