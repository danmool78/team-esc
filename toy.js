/* 가벼운 3D 인형 (시험판, ?toy): 둥근 머리 · 통 몸통 · 원기둥 팔다리 · 스카프만으로 만든 로우폴리 인형.
   그 길 인형(stage/people.js — 조각 50여 개)과 같은 자리에 끼워 쓰도록 Actor와 같은 얼개(p.root, pos·goal, faceT, set, big, showT, update, settle)를 갖는다.
   움직이지 않는 몸통·머리·얼굴·목 장식(스카프·나비넥타이·넥타이·없음)은 한 덩어리(색은 꼭짓점 색)로 합치고, 걷기에 필요한 팔다리만 따로 둬 한 사람에 그리기 5번.
   같은 옷차림·옷 색이면 도형을 함께 쓰고(userData.shared — 지울 때 버리지 않는다), 재질은 사람마다 하나(흐리게 할 때 따로) */
import { THREE, damp } from './stage/kit.js';
import { TYPES } from './stage/people.js';

const SKINS = ['#f3d2b3', '#e2b48e', '#c99470'];
const col = c => new THREE.Color(c);
// 도형 여러 개를 색을 칠해 한 덩어리로 (three의 합치기 도우미를 들이지 않으려고 직접)
function merge(parts) {
  const pos = [], nor = [], clr = [];
  for (const [g0, color, m] of parts) {
    const g = (g0.index ? g0.toNonIndexed() : g0.clone());
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position, n = g.attributes.normal, c = col(color);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); clr.push(c.r, c.g, c.b); }
    g.dispose(); g0.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.userData.shared = true;
  return g;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// 옷차림(TYPES의 색)마다 몸통·팔·다리 도형을 한 번만 만든다. 키는 1 남짓(그 길 인형과 같게 — 이름표 높이·탈것 자리가 맞게)
const kits = new Map();
function kit(type) {
  if (kits.has(type)) return kits.get(type);
  const t = TYPES[type] || TYPES.disciple;
  const female = !!(t.soft || t.slim || t.veil);
  const skin = SKINS[t.skin || 0] || SKINS[0], robe = t.robe || '#8a7350', hair = t.hair || '#2e1d12';
  const scarf = t.mantle || t.hood || t.trim || '#e0503d', pants = '#2f3448';
  const S = 14; // 둘레 조각 수 — 둥글게 보일 만큼만
  // 목에 두르는 것: 사람(옷차림 키)마다 정해진 하나 — 스카프 · 나비넥타이 · 넥타이 · 없음
  let h = 0; for (const ch of String(type)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h = (h ^ (h >>> 16)) >>> 0; // 끝 글자만 달라도 고루 섞이게
  const NECK = ['scarf', 'bow', 'tie', 'none'][h % 4];
  // 머리 모양: 사람마다 정해진 하나 (목 장식과 다른 자리의 수로 골라 서로 엇갈리게)
  const HAIR = female ? ['long', 'pony', 'bob', 'buns', 'braid'][(h >>> 4) % 5] : ['short', 'fringe', 'spiky', 'curly', 'topknot'][(h >>> 4) % 5];
  const cap = (tilt = -0.25, len = 0.42) => [new THREE.SphereGeometry(0.163, S, 8, 0, Math.PI * 2, 0, Math.PI * len), hair, at(0, 0.85, -0.012, tilt)];
  // 뒤통수 덮개(뒤쪽 반구) — len이 클수록 아래까지
  const back = len => [new THREE.SphereGeometry(0.164, S, 8, Math.PI, Math.PI, 0, Math.PI * len), hair, at(0, 0.845, -0.006)];
  const ball = (r, x, y, z, sy = 1) => [new THREE.SphereGeometry(r, 8, 6), hair, at(x, y, z, 0, 0, 0, 1, sy, 1)];
  const hairdo = {
    short: [cap(), back(0.62)],
    // 앞머리를 한쪽으로 넘긴 머리
    fringe: [cap(-0.15, 0.45), back(0.62), [new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hair, at(-0.045, 0.94, 0.07, 0.5, 0, 0.35, 1.1, 0.5, 0.8)]],
    // 삐죽삐죽 선 머리
    spiky: [cap(-0.2, 0.36), back(0.6), ...[[-0.07, 0.07], [0, 0.1], [0.07, 0.07], [-0.08, -0.03], [0, 0], [0.08, -0.03], [-0.04, -0.1], [0.04, -0.1]].map(([x, z]) =>
      [new THREE.ConeGeometry(0.04, 0.1, 5), hair, at(x, 0.84 + Math.sqrt(0.0256 - x * x - z * z) + 0.025, z, z * 4, 0, -x * 4)])], // 머리 겉에서 솟게
    // 곱슬: 작은 공을 머리 둘레에
    curly: [cap(-0.2, 0.4), back(0.6), ...Array.from({ length: 11 }, (_, i) => { const a = i / 11 * Math.PI * 2, ring = i % 2 ? 0.13 : 0.1; return ball(0.05, Math.cos(a) * ring, 0.94 + (i % 2 ? -0.02 : 0.03), Math.sin(a) * ring - 0.015); }), ball(0.055, 0, 0.99, -0.01)],
    // 상투처럼 정수리에 묶은 머리
    topknot: [cap(), back(0.62), ball(0.055, 0, 1.01, -0.02, 0.9), [new THREE.CylinderGeometry(0.03, 0.035, 0.03, 8), scarf, at(0, 0.975, -0.015)]],
    // 긴 생머리: 뒤로 길게
    long: [cap(), back(0.72), [new THREE.CylinderGeometry(0.15, 0.135, 0.22, S, 1, true, Math.PI * 0.55, Math.PI * 0.9), hair, at(0, 0.7, -0.012)]],
    // 하나로 묶은 머리: 뒤통수에 매듭 + 늘어진 꼬리
    pony: [cap(), back(0.62), ball(0.05, 0, 0.9, -0.165), [new THREE.CylinderGeometry(0.045, 0.02, 0.2, 8), hair, at(0, 0.8, -0.2, 0.25)], [new THREE.TorusGeometry(0.035, 0.012, 4, 8), scarf, at(0, 0.885, -0.17, 0.3)]],
    // 단발: 옆과 뒤를 턱 높이까지 둥글게
    bob: [cap(-0.15, 0.45), [new THREE.SphereGeometry(0.175, S, 8, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.68), hair, at(0, 0.845, -0.01)]],
    // 양쪽 똥머리
    buns: [cap(), back(0.64), ball(0.065, -0.12, 0.96, -0.03), ball(0.065, 0.12, 0.96, -0.03)],
    // 땋은 머리: 뒤로 공을 줄줄이
    braid: [cap(), back(0.64), ...[0, 1, 2, 3].map(i => ball(0.042 - i * 0.004, 0, 0.78 - i * 0.065, -0.165 - i * 0.01, 1.2)), [new THREE.TorusGeometry(0.025, 0.01, 4, 8), scarf, at(0, 0.56, -0.2, Math.PI / 2)]],
  }[HAIR];
  // 안경: 넷 중 하나는 안경, 여섯 중 하나쯤은 선글라스
  const g = (h >>> 9) % 12, EYE = g < 3 ? 'glasses' : g < 5 ? 'sun' : 'none';
  const temples = c => [-1, 1].map(sx => [new THREE.BoxGeometry(0.008, 0.008, 0.12), c, at(sx * 0.14, 0.857, 0.07, 0, -sx * 0.35, 0)]);
  const eyewear = EYE === 'glasses' ? [
    ...[-1, 1].map(sx => [new THREE.TorusGeometry(0.034, 0.007, 4, 12), '#2b2b33', at(sx * 0.056, 0.852, 0.152)]),
    [new THREE.BoxGeometry(0.03, 0.007, 0.007), '#2b2b33', at(0, 0.858, 0.157)], ...temples('#2b2b33'),
  ] : EYE === 'sun' ? [
    ...[-1, 1].map(sx => [new THREE.CylinderGeometry(0.042, 0.038, 0.012, 12), '#15181f', at(sx * 0.057, 0.852, 0.153, Math.PI / 2, 0, 0, 1.1, 1, 0.9)]),
    [new THREE.BoxGeometry(0.035, 0.01, 0.01), '#15181f', at(0, 0.86, 0.158)], ...temples('#15181f'),
  ] : [];
  const neck = NECK === 'scarf' ? [
    [new THREE.TorusGeometry(0.115, 0.045, 6, S), scarf, at(0, 0.705, 0, Math.PI / 2)],
    [new THREE.BoxGeometry(0.07, 0.2, 0.03), scarf, at(0.05, 0.6, 0.15, -0.12, 0, 0.12)], // 앞으로 늘어진 끝
  ] : NECK === 'bow' ? [
    // 나비넥타이: 가운데 매듭 + 양쪽 세모 날개
    [new THREE.SphereGeometry(0.022, 6, 4), scarf, at(0, 0.7, 0.122)],
    [new THREE.ConeGeometry(0.04, 0.07, 4), scarf, at(-0.04, 0.7, 0.118, 0, 0, Math.PI / 2, 1, 1, 0.5)],
    [new THREE.ConeGeometry(0.04, 0.07, 4), scarf, at(0.04, 0.7, 0.118, 0, 0, -Math.PI / 2, 1, 1, 0.5)],
  ] : NECK === 'tie' ? [
    // 넥타이: 흰 깃 + 매듭 + 길게 내려오는 띠(끝은 뾰족)
    [new THREE.TorusGeometry(0.1, 0.022, 4, S), '#f4f1ea', at(0, 0.705, 0.005, Math.PI / 2)],
    [new THREE.BoxGeometry(0.04, 0.035, 0.03), scarf, at(0, 0.69, 0.122)],
    // 몸통이 아래로 퍼지니 띠를 몸통 겉에 붙게 앞으로 뺀다 (여자 옷은 더 퍼진다)
    [new THREE.BoxGeometry(0.045, 0.17, 0.02), scarf, at(0, 0.59, female ? 0.168 : 0.152, -0.12)],
    [new THREE.ConeGeometry(0.032, 0.04, 4), scarf, at(0, 0.49, female ? 0.18 : 0.164, Math.PI - 0.12, Math.PI / 4, 0, 1, 1, 0.45)],
  ] : [];
  const body = merge([
    // 몸통: 아래가 조금 넓은 통 (여자는 치마처럼 더 퍼지게)
    [new THREE.CylinderGeometry(0.13, female ? 0.21 : 0.16, female ? 0.42 : 0.34, S), robe, at(0, female ? 0.45 : 0.49, 0)],
    [new THREE.SphereGeometry(0.13, S, 6, 0, Math.PI * 2, 0, Math.PI / 2), robe, at(0, 0.66, 0, 0, 0, 0, 1, 0.45, 1)], // 둥근 어깨
    ...neck,
    // 머리·머리카락 (여자는 뒤로 내린 머리)
    [new THREE.SphereGeometry(0.155, S, 10), skin, at(0, 0.84, 0)],
    ...hairdo,
    // 얼굴: 눈 두 점 + 볼 (앞이 +z)
    [new THREE.SphereGeometry(0.019, 6, 4), '#2a2018', at(-0.055, 0.85, 0.142)],
    [new THREE.SphereGeometry(0.019, 6, 4), '#2a2018', at(0.055, 0.85, 0.142)],
    [new THREE.SphereGeometry(0.026, 6, 4), '#f29a8e', at(-0.09, 0.8, 0.125, 0, 0, 0, 1, 0.6, 0.4)],
    [new THREE.SphereGeometry(0.026, 6, 4), '#f29a8e', at(0.09, 0.8, 0.125, 0, 0, 0, 1, 0.6, 0.4)],
    [new THREE.TorusGeometry(0.03, 0.007, 4, 8, Math.PI), '#7a3a2a', at(0, 0.79, 0.148, 0, 0, Math.PI)], // 웃는 입
    ...eyewear,
  ]);
  // 팔: 어깨를 축으로 흔든다 (소매 + 손)
  const arm = merge([
    [new THREE.CylinderGeometry(0.042, 0.038, 0.26, 8), robe, at(0, -0.13, 0)],
    [new THREE.SphereGeometry(0.045, 8, 6), skin, at(0, -0.28, 0)],
  ]);
  // 다리: 엉덩이를 축으로 (바지 + 신발)
  const leg = merge([
    [new THREE.CylinderGeometry(0.055, 0.05, 0.26, 8), female ? skin : pants, at(0, -0.13, 0)],
    [new THREE.SphereGeometry(0.06, 8, 5), '#2a2420', at(0, -0.27, 0.02, 0, 0, 0, 1, 0.6, 1.4)],
  ]);
  const k = { body, arm, leg, female, neck: NECK, hairdo: HAIR, eye: EYE, height: t.height || 1 };
  kits.set(type, k);
  return k;
}

export class ToyActor {
  constructor(type) {
    const k = kit(type);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mat.userData.own = true; // 사람을 지울 때 world.js freeObj가 버린다
    const root = new THREE.Group(), body = new THREE.Group();
    const torso = new THREE.Mesh(k.body, this.mat);
    const mk = (g, x, y) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); pivot.add(new THREE.Mesh(g, this.mat)); body.add(pivot); return pivot; };
    body.add(torso);
    this.armL = mk(k.arm, -0.17, 0.64); this.armR = mk(k.arm, 0.17, 0.64);
    this.armL.rotation.z = -0.12; this.armR.rotation.z = 0.12;
    this.legL = mk(k.leg, -0.065, 0.3); this.legR = mk(k.leg, 0.065, 0.3);
    body.scale.y = k.height;
    this.look = { neck: k.neck, hair: k.hairdo, eye: k.eye };
    root.add(body);
    this.p = { root, body, t: TYPES[type] || {} };
    this.pos = new THREE.Vector2(); this.goal = new THREE.Vector2();
    this.face = 0; this.faceT = 0; this.pose = 'idle';
    this.show = 1; this.showT = 1; this.big = 1; this.op = -1;
    this.walkPhase = Math.random() * 6; this.seed = Math.random() * 10;
  }
  fadeTo(op) {
    if (Math.abs(op - this.op) < 0.004) return;
    const solid = op > 0.995;
    if (this.mat.alphaHash !== !solid) { this.mat.alphaHash = !solid; this.mat.needsUpdate = true; }
    this.mat.opacity = solid ? 1 : op;
    this.op = op;
  }
  set(pose) { this.pose = pose; }
  settle() { for (let i = 0; i < 40; i++) this.update(i * 0.05, 0.05); }
  update(time, dt) {
    const p = this.p, t = time + this.seed, walk = this.pose === 'walk';
    this.face = damp(this.face, this.faceT, 6, dt);
    this.show = damp(this.show, this.showT, 4, dt);
    p.root.position.set(this.pos.x, 0, this.pos.y);
    p.root.rotation.y = this.face;
    p.root.scale.setScalar((0.94 + 0.06 * this.show) * this.big);
    p.root.visible = this.show > 0.01;
    this.fadeTo(Math.min(1, this.show));
    let swing = 0, bob = 0;
    if (walk) { this.walkPhase += dt * 7.5; swing = Math.sin(this.walkPhase); bob = Math.abs(Math.cos(this.walkPhase)) * 0.02; }
    const k = 10;
    this.legL.rotation.x = damp(this.legL.rotation.x, swing * 0.55, k, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, -swing * 0.55, k, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, -swing * 0.6, k, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, swing * 0.6, k, dt);
    p.body.position.y = walk ? bob : Math.sin(t * 1.8) * 0.004; // 서 있을 땐 숨 쉬듯 살짝
  }
}
