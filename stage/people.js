/* 3D 무대 인물: 미니어처 피규어 생성과 자세·동작 */
import { THREE, mat, DS, lathe, folds, mesh, BACK, SBACK, sphere, glowTexture, damp } from './kit.js';

const SKIN = ['#c99a74', '#b9845d', '#d6ad89', '#a87451'];
// 예수님만 밝은 흰 속옷에 붉은 겉옷을 입는다. 다른 사람(특히 제자들)은 이 짝을 쓰지 않는다
const TYPES = {
  jesus:    { robe: '#efe7d6', trim: '#a8843f', mantle: '#9b3b2a', hair: '#4a2e1c', beard: true, long: true, sash: '#b08a4e' },
  mary:     { robe: '#a3554a', trim: '#c9a24a', mantle: '#3c5d96', veil: true, inner: '#f3ece0', skin: 2, soft: true, slim: true, sash: '#c9a24a' },
  joseph:   { robe: '#7b5b3a', trim: '#5a4128', mantle: '#b89b6c', hair: '#3b2616', beard: true, hood: '#d8c9a6', band: '#6e5131', sash: '#5a4128' },
  angel:    { robe: '#fbf7ee', trim: '#d9b46a', hair: '#d8b56a', curls: true, wings: true, glow: true, halo: true, sash: '#d9b46a', skin: 2, soft: true },
  baptist:  { robe: '#7a5a32', trim: '#5a4024', hair: '#2b1b10', beard: true, long: true, sash: '#3e2a18', skin: 1 }, // 낙타털 옷, 가죽 띠
  tempter:  { robe: '#2c2533', mantle: '#1e1824', hood: '#1e1824', hair: '#120c10' }, // 시험하는 자 (실루엣으로만)
  steward:  { robe: '#c9b48c', trim: '#3e5a3a', mantle: '#3e5a3a', hair: '#4a3a2a', beard: true, sash: '#8a3c1c' }, // 잔치를 맡은 이
  groom:    { robe: '#f1e7cf', trim: '#d6a93a', mantle: '#3c5d96', hair: '#2b1b10', beard: true, sash: '#d6a93a' },
  servant:  { robe: '#b9a07a', trim: '#8b6f50', hair: '#2e1d12', sash: '#6b5438' },
  anna:     { robe: '#4f4a5e', trim: '#3a3646', mantle: '#8a8172', hair: '#cfc8bb', veil: true, inner: '#ddd6c8', skin: 1, soft: true, slim: true, sash: '#3a3646', height: 0.93 }, // 여든 넷의 과부 예언자
  magus2:   { robe: '#1f5a5a', trim: '#d6a93a', mantle: '#b0402e', hair: '#e2ddd2', beard: true, turban: '#d8b45a', skin: 1, sash: '#d6a93a' },
  magus3:   { robe: '#8a3c1c', trim: '#d6a93a', mantle: '#2f4f8a', hair: '#1d140c', beard: true, crown: true, skin: 3, sash: '#d6a93a' },
  boyJesus: { robe: '#d8c49c', trim: '#8a6a44', hair: '#4a2e1c', sash: '#7a5a38', height: 0.78, kid: true }, // 열두 살 소년: 어른 예수의 흰 옷·붉은 망토 대신 거친 무명 속옷에 끈 띠만
  mother:   { robe: '#7a5a48', trim: '#5a3e30', mantle: '#4a4a52', veil: true, inner: '#e7dfd0', skin: 1, soft: true, slim: true, sash: '#5a3e30' },
  crossed:  { robe: '#efe7d6', hair: '#4a2e1c', beard: true, long: true, bare: true }, // 십자가 위의 예수 (실루엣 전용)
  john:     { robe: '#76855e', trim: '#4f5a3c', mantle: '#c9a86a', hair: '#5a3a22', sash: '#4f5a3c' }, // 젊은 제자: 수염 없음. 밝은 속옷에 붉은 겉옷이던 것을 올리브 옷에 황토 겉옷으로 — 예수님과 헷갈리지 않게
  woman2:   { robe: '#6e5a7a', trim: '#4d3f57', mantle: '#d8c9a6', veil: true, inner: '#f1e9da', skin: 3, soft: true, slim: true, sash: '#4d3f57' },
  woman:    { robe: '#8e6d4e', trim: '#6e5232', mantle: '#c8b48c', veil: true, inner: '#efe6d4', skin: 1, soft: true, slim: true, sash: '#6e5232' },
  disciple: { robe: '#8a7350', trim: '#6b5638', mantle: '#5d6b4a', hair: '#2e1d12', beard: true, sash: '#5b4630' },
  peter:    { robe: '#6e5a40', trim: '#54442f', mantle: '#4f6a7d', hair: '#8c8378', beard: true, skin: 1, sash: '#3f3324' },
  elder:    { robe: '#e3dccb', trim: '#6c6a8f', mantle: '#6c6a8f', hair: '#d9d4c8', beard: true, hood: '#e8e1d0', band: '#6c6a8f', height: 0.96 },
  shepherd: { robe: '#7d6446', trim: '#5e4a33', mantle: '#a58a5c', hair: '#2e1d12', beard: true, hood: '#cdbb94', band: '#5e4a33', staff: true, skin: 1 },
  magus:    { robe: '#5b3a78', trim: '#d6a93a', mantle: '#c99a3a', hair: '#1d140c', beard: true, turban: '#e9dcc0', skin: 3, sash: '#d6a93a' },
  king:     { robe: '#6b2a5e', trim: '#d6a93a', mantle: '#b8892f', hair: '#2b1b10', beard: true, crown: true, sash: '#d6a93a' },
  soldier:  { robe: '#9d3328', trim: '#7a2a20', mantle: '#7a2a20', hair: '#2b1b10', helmet: true, spear: true, sash: '#5a3d22' },
  thief:    { robe: '#cbb79a', hair: '#2b1b10', beard: true, bare: true, height: 0.96 }, // 십자가의 두 죄수 (실루엣 전용)
  // 프롤로그의 아담과 하와: 범죄 전에는 벌거벗었으나 부끄럽지 않았다(창 2:25) — 빛 속의 윤곽으로만.
  // 범죄 뒤에는 무화과 잎을 엮어 허리에 두른다(창 3:7). 가죽옷은 man·woman (실루엣 전용)
  adam:     { robe: '#d8b48a', hair: '#3b2616', beard: true, bare: true, nude: true, skin: 1 },
  eve:      { robe: '#d8b48a', hair: '#3b2616', long: true, soft: true, slim: true, bare: true, nude: true, skin: 1 },
  adamFig:  { robe: '#d8b48a', hair: '#3b2616', beard: true, bare: true, cloth: '#5d7a3a', skin: 1 },
  eveFig:   { robe: '#d8b48a', hair: '#3b2616', long: true, soft: true, slim: true, bare: true, cloth: '#5d7a3a', skin: 1 },
  pharisee: { robe: '#d9cfb6', trim: '#3e5470', mantle: '#3e5470', hair: '#2b1b10', beard: true, hood: '#efe8d8', band: '#3e5470', skin: 2 },
  man:      { robe: '#8b6f50', trim: '#6b5438', mantle: '#a99069', hair: '#2e1d12', beard: true, sash: '#5b4630' },
  child:    { robe: '#e6dcc4', trim: '#8f6d4b', mantle: '#8f6d4b', hair: '#4a2e1c', height: 0.66, kid: true },
  samaritan: { robe: '#9c5b3a', trim: '#6e3a22', mantle: '#d8b878', veil: true, inner: '#f1e6d0', skin: 1, soft: true, slim: true, sash: '#6e3a22' }, // 수가의 여인
  centurion: { robe: '#9d3328', trim: '#d6a93a', mantle: '#6b2a20', hair: '#2b1b10', helmet: true, sash: '#5a3d22' }, // 백부장 (창 없이)
  youth:    { robe: '#efe9dc', trim: '#cdbf9e', hair: '#3b2616', sash: '#cdbf9e' }, // 나인의 청년 (흰 수의)
  wild:     { robe: '#6e6254', trim: '#5a4e40', hair: '#3a2a1c', beard: true, long: true, skin: 1 }, // 무덤 사이의 사람 (헝클어진 머리, 해진 옷)
  healed:   { robe: '#e3d6b8', trim: '#8b6f50', mantle: '#8b6f50', hair: '#3a2a1c', beard: true, sash: '#6b5438', skin: 1 }, // 옷을 입고 정신이 돌아온 그 사람
  girl:     { robe: '#f1e7cf', trim: '#c0607a', hair: '#3b2616', long: true, soft: true, slim: true, sash: '#c0607a', height: 0.72, kid: true }, // 열두 살 소녀
  phoenician: { robe: '#6b2a5e', trim: '#d6a93a', mantle: '#c99a5a', veil: true, inner: '#efe6d4', skin: 2, soft: true, slim: true, sash: '#d6a93a' }, // 두로의 어머니 (자주색 옷)
  moses:    { robe: '#e8e0cc', trim: '#7a5a32', mantle: '#8a5a32', hair: '#ece6da', beard: true, long: true, sash: '#7a5a32', skin: 1, glow: true }, // 변화산의 모세
  elijah:   { robe: '#7a5a32', trim: '#4a3620', mantle: '#c9b48c', hair: '#d9d2c4', beard: true, long: true, sash: '#4a3620', skin: 1, glow: true }, // 변화산의 엘리야 (털옷)
  guard:    { robe: '#5a6b7d', trim: '#3a4656', mantle: '#3a4656', hair: '#2b1b10', beard: true, hood: '#c9c0a8', band: '#3a4656', staff: true, sash: '#3a4656' }, // 성전 경비병
  traveler: { robe: '#6b7d5a', trim: '#4a5a3c', mantle: '#c9a26a', hair: '#2b1b10', beard: true, hood: '#e0d2b0', band: '#4a5a3c', sash: '#4a5a3c', skin: 1 }, // 선한 사마리아 사람
  martha:   { robe: '#7a5a3a', trim: '#c9a24a', mantle: '#b9a07a', veil: true, inner: '#f1e9da', skin: 2, soft: true, slim: true, sash: '#c9a24a' }, // 베다니의 마르다
  prodigal: { robe: '#a0927c', trim: '#7a6a54', hair: '#3a2a1c', beard: true, skin: 1 }, // 돌아온 둘째 아들 (해진 옷)
  thomas:   { robe: '#5d6b7a', trim: '#3e4a56', mantle: '#a89a7c', hair: '#2b1b10', beard: true, sash: '#3e4a56' },
  lazarus:  { robe: '#f2ede2', trim: '#d8d0c0', hood: '#f2ede2', hair: '#3b2616', skin: 2, height: 0.97 }, // 수의에 감긴 나사로
  rich:     { robe: '#2f6a5a', trim: '#d6a93a', mantle: '#d8c49a', hair: '#2b1b10', sash: '#d6a93a', skin: 2 }, // 부자 청년 (수염 없는 젊은이, 값진 옷)
  beggar:   { robe: '#8a7c66', trim: '#6a5c48', mantle: '#6a5c48', hair: '#3a2a1c', beard: true, skin: 1 }, // 눈먼 바디매오
  zacchaeus: { robe: '#7a3b2e', trim: '#d6a93a', mantle: '#c9a26a', hair: '#2b1b10', beard: true, sash: '#d6a93a', skin: 2, height: 0.8 }, // 키 작은 세리장
  judas:    { robe: '#8a7a3a', trim: '#5a4a24', mantle: '#4a3e2a', hair: '#1d140c', beard: true, sash: '#5a4a24', skin: 1 }, // 가룟 유다
  sadducee: { robe: '#e9dfc8', trim: '#7a2a5e', mantle: '#7a2a5e', hair: '#2b1b10', beard: true, sash: '#7a2a5e', skin: 2 }, // 사두개인 (부유한 제사장 가문)
  highpriest: { robe: '#f1ece0', trim: '#d6a93a', mantle: '#3c5d96', hair: '#d9d4c8', beard: true, turban: '#efe8d8', sash: '#a3554a', skin: 2, height: 0.98 }, // 대제사장 가야바
  pilate:   { robe: '#f2ede2', trim: '#9d3328', mantle: '#9d3328', hair: '#3a2a1c', sash: '#9d3328', skin: 2 }, // 총독 빌라도 (로마 옷, 수염 없음)
  risen:    { robe: '#fbf8f0', trim: '#d9b46a', mantle: '#efe4cc', hair: '#4a2e1c', beard: true, long: true, sash: '#d9b46a', glow: true }, // 부활하신 예수 (밝은 흰옷, 은은한 빛)
  whiteman: { robe: '#fffdf8', trim: '#e8dcc0', hair: '#c9a86a', sash: '#e8dcc0', glow: true, skin: 2 }, // 흰옷 입은 사람 (날개 없는 하늘의 전령)
  levi:     { robe: '#5a3e6e', trim: '#c9a24a', mantle: '#b9935a', hair: '#2b1b10', beard: true, sash: '#c9a24a', skin: 2 }, // 세리 마태 (값진 옷)
  official: { robe: '#2f4f6a', trim: '#d6a93a', mantle: '#c8b48c', hair: '#2b1b10', beard: true, sash: '#d6a93a', skin: 2 }, // 왕의 신하
};

// 깃털 한 장: 길이 방향 +y
const featherGeo = (len, wid) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.5, wid * 0.15, len);
  s.quadraticCurveTo(-wid * 0.55, len * 0.55, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
};
// 날개: 어깨에서 위·바깥으로 솟는 앞가장자리(활 모양)에 깃털을 달아 아래로 늘어뜨린다.
// 겹친 세 층 — 긴 깃털(끝으로 갈수록 길게), 중간 깃털, 덮깃. 로컬 +x가 바깥쪽
function makeWing(side, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.035, 0.62, -0.09);
  parent.add(pivot);
  const w = new THREE.Group();
  w.scale.x = side;
  pivot.add(w);
  const edge = f => [0.02 + 0.36 * Math.sin(f * Math.PI / 2), 0.03 + 0.3 * Math.sin(f * Math.PI * 0.8)]; // 앞가장자리
  const layers = [
    { n: 12, len: [0.26, 0.56], wid: 0.085, col: '#f1ebdf', z: 0, rot: [-3.05, -2.35], drop: 0 },
    { n: 10, len: [0.17, 0.3], wid: 0.075, col: '#f8f4ea', z: 0.01, rot: [-3.0, -2.5], drop: 0.02 },
    { n: 8, len: [0.09, 0.14], wid: 0.06, col: '#fffdf7', z: 0.02, rot: [-2.95, -2.6], drop: 0.01 },
  ];
  layers.forEach(L => {
    const m = mat(L.col, { ...DS, emissive: '#8a7448', emissiveIntensity: 0.35, roughness: 0.55 });
    for (let i = 0; i < L.n; i++) {
      const f = i / (L.n - 1);
      const [bx, by] = edge(f);
      const o = mesh(featherGeo(L.len[0] + (L.len[1] - L.len[0]) * f ** 1.4, L.wid), m, w, [bx, by - L.drop, L.z + f * 0.006]);
      o.rotation.z = L.rot[0] + (L.rot[1] - L.rot[0]) * f;
    }
  });
  // 앞가장자리를 덮는 둥근 어깨깃
  const curve = new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.75, 1].map(f => new THREE.Vector3(...edge(f), 0.03)));
  mesh(new THREE.TubeGeometry(curve, 20, 0.022, 8), mat('#fffdf7', { emissive: '#8a7448', emissiveIntensity: 0.35 }), w);
  return pivot;
}

// 공 모양 머리를 사람 머리로: 얼굴은 길고 턱으로 좁아지며, 뒤통수는 나오고, 앞얼굴은 평평하게.
// 머리 공간(반지름 0.08 기준)에서 꼭짓점을 옮긴다. off는 그 도형이 머리 안에서 놓이는 위치,
// face면 눈두덩·눈자리·광대까지 새긴다 (머리카락·수염 껍질은 윤곽만 따른다)
function headShape(geo, off = [0, 0, 0], face = false) {
  const p = geo.attributes.position, R = 0.08, g = (a, b, w) => Math.exp(-(a * a + b * b) / (w * w));
  for (let i = 0; i < p.count; i++) {
    let X = (p.getX(i) + off[0]) / R, Y = (p.getY(i) + off[1]) / R, Z = (p.getZ(i) + off[2]) / R;
    if (Y < 0) Y *= 1.18;                                   // 얼굴 아래쪽을 길게
    const t = Math.min(1, Math.max(0, (-Y - 0.12) / 0.9));  // 0: 광대 위 … 1: 턱 끝
    X *= 0.9 * (1 - 0.36 * t * t);                          // 턱으로 갈수록 좁게
    if (Z < 0) Z *= (Y > -0.1 ? 1.08 : 1) * (1 - 0.4 * t);  // 뒤통수는 나오고, 아래턱 뒤(목 쪽)는 들어가게
    else {
      Z = Z * 0.92 + 0.1 * t;                               // 앞얼굴은 평평하게, 턱끝은 앞으로
      if (face && Z > 0.4) {
        const ax = Math.abs(X);
        Z += 0.05 * Math.exp(-(((Y - 0.37) / 0.1) ** 2)) * Math.exp(-((X / 0.55) ** 2)); // 눈두덩
        Z -= 0.07 * g(ax - 0.34, Y - 0.15, 0.15);                                         // 눈자리
        Z += 0.05 * g(ax - 0.52, Y + 0.08, 0.17);                                         // 광대
        Z += 0.03 * g(X, Y + 0.62, 0.22);                                                 // 턱끝 둥글게
      }
    }
    p.setXYZ(i, X * R - off[0], Y * R - off[1], Z * R - off[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

// 코: 공을 이어 붙이지 않고 한 덩어리로 빚는다. 위(미간)는 가늘고 얼굴에 묻히며, 아래로 갈수록 앞으로 솟고
// 코끝에서 콧방울 너비로 매끄럽게 퍼진다 (높이는 1.45배로 오똑하게). 뒷면은 얼굴 안에 들어가 보이지 않는다
function noseGeo(style) {
  const g = sphere(0.01, 28, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.01, y = p.getY(i) / 0.01, z = p.getZ(i) / 0.01, u = (1 - y) / 2; // u: 0 미간 … 1 코밑
    let hw, f;
    if (style === 'A') { hw = 0.003 + 0.0025 * u + 0.0035 * Math.exp(-(((u - 0.86) / 0.12) ** 2)); f = 0.003 + 0.0105 * u ** 1.3; }
    if (style === 'B') { hw = 0.0028 + 0.0016 * u + 0.0028 * Math.exp(-(((u - 0.88) / 0.1) ** 2)); f = 0.006 + 0.0095 * u ** 1.1; }
    if (style === 'C') { hw = 0.0032 + 0.0022 * u + 0.0034 * Math.exp(-(((u - 0.86) / 0.12) ** 2)); f = 0.004 + 0.009 * u + 0.0025 * Math.exp(-(((u - 0.45) / 0.18) ** 2)); }
    const Y = y * 0.0185 - (style === 'C' ? 0.0015 * u * u : 0);
    p.setXYZ(i, x * hw, Y, z > 0 ? z * f * 1.45 : z * 0.004);
  }
  g.computeVertexNormals();
  return g;
}

// 눈알 무늬: 흰자 위에 홍채(바깥 테두리·결·안쪽 밝은 고리)와 동공, 빛 맺힘을 그린 그림을 눈알 공에 입힌다.
// 공의 +z(앞)가 그림의 가로 1/4, 세로 가운데에 온다. 홍채 색마다 한 장씩 만들어 같이 쓴다
const IRIS = ['#4a2c17', '#5c3a1e', '#3b2414', '#6b4a2a', '#2e1c10', '#7a5a30', '#5a5a34']; // 짙은 갈색이 대부분, 드물게 담갈색·올리브
const eyeTex = new Map();
function eyeTexture(iris) {
  if (eyeTex.has(iris)) return eyeTex.get(iris);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'), X = 128, Y = 128, R = 60;
  // 흰자: 가운데는 따뜻한 흰색, 가장자리로 갈수록 살짝 붉고 어둡게
  const w = g.createRadialGradient(X, Y, R, X, Y, 200);
  w.addColorStop(0, '#f7f2ea'); w.addColorStop(0.6, '#eee2d6'); w.addColorStop(1, '#d9b9a8');
  g.fillStyle = w; g.fillRect(0, 0, 512, 256);
  // 홍채: 가장자리는 짙은 고리, 동공 둘레는 밝게
  const col = new THREE.Color(iris), hex = k => '#' + col.clone().multiplyScalar(k).getHexString();
  const ir = g.createRadialGradient(X, Y, 0, X, Y, R);
  ir.addColorStop(0, hex(1.5)); ir.addColorStop(0.45, hex(1.25)); ir.addColorStop(0.8, hex(1)); ir.addColorStop(1, hex(0.45));
  g.fillStyle = ir; g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.fill();
  // 홍채 결: 동공에서 바깥으로 뻗는 가는 선
  for (let i = 0; i < 90; i++) {
    const a = i / 90 * Math.PI * 2 + Math.sin(i * 7.3) * 0.03, r0 = R * 0.3, r1 = R * (0.75 + 0.2 * Math.abs(Math.sin(i * 3.7)));
    g.strokeStyle = i % 2 ? hex(1.7) + '55' : hex(0.6) + '66'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0); g.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1); g.stroke();
  }
  // 동공
  g.fillStyle = '#0d0806'; g.beginPath(); g.arc(X, Y, R * 0.36, 0, Math.PI * 2); g.fill();
  // 빛 맺힘 (왼쪽 위의 큰 점 + 오른쪽 아래의 작은 점)
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(X - R * 0.32, Y - R * 0.34, R * 0.16, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(X + R * 0.3, Y + R * 0.3, R * 0.07, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25 });
  eyeTex.set(iris, m);
  return m;
}
let personNo = 0;

// 얼굴 피부 그림: 머리 공에 입히는 한 장. 공의 +z(앞)가 그림 가로 1/4, 위에서 아래로 그림 위→아래.
// 덧붙인 볼터치 대신 피부 안에서 은은하게 — 볼·코끝·입술 둘레는 따뜻하게, 눈두덩과 관자놀이는 살짝 그늘지게,
// 수염 없는 남자는 턱에 옅은 면도 자국, 고르지 않은 피부 톤
const skinTex = new Map();
function skinMaterial(color, soft, shave) {
  const key = color + soft + shave;
  if (skinTex.has(key)) return skinTex.get(key);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'), base = new THREE.Color(color);
  const css = (col, a) => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 512, 256);
  const blob = (x, y, rx, ry, col, a) => {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, css(col, a)); gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const X = 128, warm = base.clone().lerp(new THREE.Color('#d0645a'), 0.55), shade = base.clone().multiplyScalar(0.72);
  // 피부 톤의 고르지 않음: 크고 옅은 얼룩 몇 개 (작은 점은 주근깨처럼 보여 쓰지 않는다)
  for (let i = 0; i < 14; i++) blob(Math.random() * 512, 40 + Math.random() * 180, 30 + Math.random() * 40, 20 + Math.random() * 30,
    Math.random() < 0.5 ? base.clone().multiplyScalar(0.92) : base.clone().lerp(new THREE.Color('#ffffff'), 0.08), 0.25);
  [-1, 1].forEach(s => {
    blob(X + s * 46, 148, 30, 22, warm, soft ? 0.38 : 0.2);    // 볼
    blob(X + s * 26, 112, 16, 9, shade, 0.35);                  // 눈두덩 아래 그늘
    blob(X + s * 70, 110, 22, 30, shade, 0.25);                 // 관자놀이
  });
  blob(X, 140, 10, 8, warm, 0.25);                               // 코끝
  blob(X, 166, 20, 10, warm, soft ? 0.3 : 0.18);                 // 입술 둘레
  if (shave) blob(X, 186, 58, 22, base.clone().lerp(new THREE.Color('#3a3a44'), 0.5), 0.22); // 면도 자국
  blob(X, 60, 60, 26, base.clone().lerp(new THREE.Color('#ffffff'), 0.25), 0.25); // 이마 윗부분 빛
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  skinTex.set(key, m);
  return m;
}

function makePerson(type) {
  const t = TYPES[type] || TYPES.man;
  const skin = mat(SKIN[t.skin || 0], { roughness: 0.7 });
  const root = new THREE.Group();           // 위치·방향
  const body = new THREE.Group();           // 기울기·낮춤·눕기
  root.add(body);
  body.scale.setScalar(t.height || 1);
  const robe = mat(t.robe), trim = mat(t.trim || t.robe, { roughness: 0.55, metalness: /c9a24a|d9b46a|d6a93a|a8843f/.test(t.trim) ? 0.35 : 0 });

  // 겉옷: 어깨가 둥근 종 모양 + 아래로 깊어지는 주름. 여인은 좁은 어깨·잘록한 허리·가슴선·퍼지는 치맛단
  const slim = !!t.slim;
  const B = slim
    ? { robe: [[0.001, 0], [0.152, 0], [0.15, 0.03], [0.132, 0.15], [0.112, 0.29], [0.096, 0.39], [0.084, 0.465], [0.09, 0.52], [0.101, 0.57], [0.098, 0.625], [0.08, 0.665], [0.05, 0.692], [0.033, 0.705], [0.001, 0.71]],
        hem: 0.15, waist: [0.086, 0.465], shoulder: 0.1, sleeve: 0.054, fold: 0.009,
        mantle: [[0.05, 0.7], [0.1, 0.672], [0.116, 0.635], [0.112, 0.6], [0.112, 0.45], [0.128, 0.25], [0.154, 0.05]], mantleLen: Math.PI * 1.05 }
    : { robe: [[0.001, 0], [0.148, 0], [0.146, 0.03], [0.132, 0.16], [0.118, 0.3], [0.104, 0.44], [0.104, 0.52], [0.114, 0.6], [0.106, 0.65], [0.078, 0.685], [0.042, 0.705], [0.001, 0.71]],
        hem: 0.145, waist: [0.106, 0.45], shoulder: 0.108, sleeve: 0.06, fold: 0.011,
        mantle: [[0.055, 0.705], [0.11, 0.674], [0.128, 0.635], [0.126, 0.6], [0.13, 0.45], [0.142, 0.25], [0.156, 0.06]], mantleLen: Math.PI * 1.25 };
  // 옷을 허리에서 나눈다: 무릎 꿇으면 치마(skirt)가 낮아지며 바닥에 퍼지고, 상체(upper)는 그만큼 내려앉는다
  const wy = B.waist[1], i = B.robe.findIndex(([, y]) => y > wy);
  const [r0, y0] = B.robe[i - 1], [r1, y1] = B.robe[i], rw = r0 + (r1 - r0) * (wy - y0) / (y1 - y0);
  // torso: 허리 높이에 둔 회전축. 숙이거나 젖힐 때 허리에서 접힌다 (upper는 그 안에서 원래 높이로 되돌려 놓은 상체)
  const skirt = new THREE.Group(), torso = new THREE.Group(), upper = new THREE.Group();
  torso.position.y = wy;
  upper.position.y = -wy;
  torso.add(upper);
  body.add(skirt, torso);
  // 허리 이음매: 숙이거나 꿇어도 틈이 보이지 않게 상체를 따라다니는 옷 색의 둥근 연결부
  if (!t.bare) mesh(sphere(rw * 1.03, 24, 12), robe, torso, [0, 0, 0], [1, 0.55, 1]);
  let skirtMesh = null, hemTrim = null;
  if (t.bare) {
    // 겉옷 없이 허리에 두른 천만 (십자가 위의 예수 — 윤곽으로만 보인다). nude: 천 없이 맨몸 (에덴의 아담과 하와, 빛의 윤곽으로만)
    // 여인(slim)은 좁은 어깨·잘록한 허리·넓은 골반으로
    const lr = slim ? 0.86 : 1;
    [-1, 1].forEach(s => mesh(new THREE.CylinderGeometry(0.032 * lr, 0.026 * lr, 0.4, 12), skin, skirt, [s * (slim ? 0.038 : 0.042), 0.21, 0]));
    if (t.nude) mesh(lathe(slim ? [[0.001, 0.33], [0.084, 0.34], [0.094, 0.39], [0.08, 0.45], [0.066, 0.47], [0.001, 0.47]] : [[0.001, 0.33], [0.082, 0.34], [0.088, 0.4], [0.084, 0.47], [0.001, 0.47]], 28), skin, skirt);
    else mesh(folds(lathe([[0.001, 0.33], [0.098, 0.33], [0.094, 0.4], [0.09, 0.47], [0.001, 0.47]], 28), 7, 0.008, 0.47), mat(t.cloth || '#e9e1cf', DS), skirt);
    mesh(lathe(slim ? [[0.001, 0.46], [0.066, 0.46], [0.07, 0.52], [0.084, 0.58], [0.082, 0.63], [0.052, 0.68], [0.028, 0.705], [0.001, 0.71]]
      : [[0.001, 0.46], [0.082, 0.46], [0.086, 0.52], [0.098, 0.59], [0.094, 0.64], [0.06, 0.685], [0.03, 0.705], [0.001, 0.71]], 28), skin, upper);
  } else {
    // 치마: 서 있는 모양 + 무릎 꿇은 모양(허리에서 바닥으로 매끈하게 퍼지는 낮은 둔덕, 접은 다리가 놓이는 뒤쪽은 더 길게).
    // 두 모양의 점 수를 같게 만들어 모핑으로 사이를 부드럽게 바꾼다 — 눌러서 생기던 각진 턱이 없다
    const sk = [...B.robe.slice(0, i), [rw, wy], [0.001, wy]], KH = wy * 0.42;
    const kp = sk.map(([r, y], j) => {
      if (j === 0) return [0.001, 0];
      if (j === sk.length - 1) return [0.001, KH];
      const u = Math.min(1, y / wy);
      return [rw + (B.hem * 1.22 - rw) * Math.pow(1 - u, 1.5), KH * (1 - Math.pow(1 - u, 1.6))];
    });
    const stand = folds(lathe(sk, 40), 9, B.fold, 0.5), knelt = folds(lathe(kp, 40), 9, B.fold * 1.3, KH);
    const kpos = knelt.attributes.position;
    for (let v = 0; v < kpos.count; v++) if (kpos.getZ(v) < 0) kpos.setZ(v, kpos.getZ(v) * 1.45);
    knelt.computeVertexNormals();
    stand.morphAttributes.position = [kpos];
    stand.morphAttributes.normal = [knelt.attributes.normal];
    skirtMesh = mesh(stand, robe, skirt);
    hemTrim = mesh(new THREE.TorusGeometry(B.hem, 0.008, 6, 40), trim, skirt, [0, 0.028, 0]);
    hemTrim.rotation.x = Math.PI / 2;
    mesh(lathe([[0.001, wy - 0.01], [rw, wy - 0.01], ...B.robe.slice(i)], 40), robe, upper);
    mesh(new THREE.TorusGeometry(slim ? 0.04 : 0.048, 0.006, 6, 24), trim, upper, [0, 0.7, 0.004]).rotation.x = Math.PI / 2;
  }
  if (t.sash && !t.bare) {
    const s = mat(t.sash), [wr, wy] = B.waist;
    mesh(new THREE.TorusGeometry(wr, slim ? 0.007 : 0.011, 6, 32), s, upper, [0, wy, 0]).rotation.x = Math.PI / 2;
    mesh(sphere(slim ? 0.011 : 0.017, 10, 8), s, upper, [0.02, wy, wr - 0.003]);
    [-1, 1].forEach(k => { const e = mesh(new THREE.BoxGeometry(slim ? 0.01 : 0.016, slim ? 0.14 : 0.11, 0.006), s, upper, [0.02 + k * 0.01, wy - (slim ? 0.075 : 0.06), wr]); e.rotation.z = k * 0.1; });
  }
  // 망토: 등과 어깨를 감싸며 늘어진다 (여인은 몸에 붙게 좁게). 팔은 망토 밖으로 나온다
  // (어깨에 매단 묶음이라, 무릎 꿇을 때 위에서부터 줄여 끝자락이 땅에 묻히지 않게 한다)
  const mantleG = new THREE.Group();
  mantleG.position.y = B.mantle[0][1];
  upper.add(mantleG);
  if (t.mantle && !t.wings && !t.bare) mesh(folds(lathe(B.mantle, 32, ...BACK(B.mantleLen)), 11, slim ? 0.006 : 0.01, 0.62), mat(t.mantle, DS), mantleG, [0, -B.mantle[0][1], 0]);
  mesh(new THREE.CylinderGeometry(0.029, 0.033, 0.07, 14), skin, upper, [0, 0.72, 0]);

  // 머리
  const head = new THREE.Group();
  head.position.set(0, 0.8, 0);
  head.scale.setScalar((t.slim ? 0.9 : 0.93) * (t.kid ? 1.14 : 1)); // 머리를 조금 작게 해서 늘씬한 비율로 (아이는 머리가 몸에 비해 크게)
  upper.add(head);
  mesh(headShape(sphere(0.08, 48, 36), [0, 0, 0], true), skinMaterial(SKIN[t.skin || 0], !!t.soft, !t.beard && !t.soft && !t.bare && (t.height || 1) > 0.8), head);
  [-1, 1].forEach(s => mesh(sphere(0.017, 10, 8), skin, head, [s * 0.068, -0.004, -0.004], [0.45, 1, 0.75])); // 귀
  mesh(noseGeo(globalThis.NOSE || 'B'), skin, head, [0, -0.001, 0.0695]); // A 곧은 코 · B 오똑한 코 · C 매부리 코 (faces.html?nose=로 비교)
  const eyeM = eyeTexture(t.eye || IRIS[(personNo++ * 5 + type.length) % IRIS.length]); // 사람마다 눈 색이 조금씩 다르게
  const eyes = [-1, 1].map(s => {
    const g = new THREE.Group();
    g.position.set(s * 0.027, 0.013, 0.062);
    head.add(g);
    mesh(sphere(0.014, 24, 16), eyeM, g, [0, 0, 0], [1.1, 0.85, 0.5]);
    // 눈꺼풀: 눈알보다 조금 큰 살색 껍질. 윗꺼풀은 눈알 위쪽을 덮고 앞으로 돌아 내려오며 감기고(깜빡임),
    // 아랫꺼풀은 아래쪽에 가만히 있다. 윗꺼풀 가장자리에 짙은 속눈썹 선
    const lids = new THREE.Group();
    lids.scale.set(1.1, 0.85, 0.5);
    g.add(lids);
    const R = 0.0152, UP = 1.15, LO = 0.75;
    const lid = new THREE.Group();
    lids.add(lid);
    mesh(sphere(R, 24, 10, 0, Math.PI * 2, 0, UP), skin, lid);
    // 속눈썹 선은 앞쪽 반원만 (감았을 때 둥근 테두리가 보이지 않게)
    const lashG = new THREE.Group(), A = 1.2;
    lashG.position.y = R * Math.cos(UP); lashG.rotation.x = Math.PI / 2;
    lid.add(lashG);
    const lash = mesh(new THREE.TorusGeometry(R * Math.sin(UP), 0.0011, 4, 24, A * 2), mat('#2a1a10'), lashG);
    lash.rotation.z = Math.PI / 2 - A;
    lash.castShadow = false;
    mesh(sphere(R * 0.99, 24, 8, 0, Math.PI * 2, Math.PI - LO, LO), skin, lids);
    lid.rotation.x = -0.4;
    g.userData.lid = lid;
    const brow = mesh(new THREE.CapsuleGeometry(0.0035, 0.018, 3, 6), mat(t.hair || '#3b2616'), head, [s * 0.028, 0.032, 0.071]);
    brow.rotation.z = Math.PI / 2 - s * 0.1; // 바깥쪽으로 살짝 처진 부드러운 눈썹
    return g;
  });
  const mouth = mesh(sphere(0.011, 12, 8), mat('#7a3a2e', { roughness: 0.6 }), head, [0, -0.045, 0.068], [1.5, 0.35, 0.45]);

  // 머리카락
  if (t.hair) {
    const hair = mat(t.hair, { roughness: 0.75 });
    // 정수리 덮개는 뒤로 젖혀 이마의 머리선을 올린다 (앞머리가 바가지처럼 일자로 내려오지 않게)
    const cap = mesh(headShape(sphere(0.0835, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), [0, 0.004, -0.004]), hair, head, [0, 0.004, -0.004]);
    cap.rotation.x = t.curls ? -0.08 : -0.22; // 곱슬머리(천사)는 덜 젖힌다 — 이마가 반 대머리처럼 넓어 보이지 않게
    mesh(headShape(sphere(0.085, 32, 18, ...SBACK(Math.PI * 1.3), 0, Math.PI * 0.66), [0, 0.002, -0.006]), mat(t.hair, { ...DS, roughness: 0.75 }), head, [0, 0.002, -0.006]);
    if (t.long) {
      mesh(lathe([[0.083, 0.0], [0.088, -0.05], [0.09, -0.12], [0.082, -0.18]], 24, ...BACK(Math.PI * 1.3)), mat(t.hair, { ...DS, roughness: 0.75 }), head);
      [-1, 1].forEach(s => mesh(new THREE.CapsuleGeometry(0.018, 0.09, 4, 10), hair, head, [s * 0.062, -0.075, -0.004]).rotation.z = s * -0.08);
    }
    if (t.curls) for (let i = 0; i < 11; i++) {
      const a = (i / 10) * Math.PI * 1.25 - Math.PI * 0.125;
      mesh(sphere(0.026, 10, 8), hair, head, [Math.cos(a) * 0.072, 0.03 + Math.sin(a) * 0.05, -0.02 - Math.sin(a) * 0.02]);
    }
    // 앞머리 곱슬: 이마 위를 따라 작은 곱슬을 한 줄 — 가운데는 조금 높게, 관자놀이 쪽은 낮게
    if (t.curls) for (let i = 0; i < 7; i++) {
      const b = (i / 6 - 0.5) * 2.0;
      mesh(sphere(0.019, 10, 8), hair, head, [Math.sin(b) * 0.066, 0.058 - Math.abs(b) * 0.012, Math.cos(b) * 0.05]);
    }
  }
  if (t.beard) {
    const b = mat(t.hair || '#3b2616', { roughness: 0.8 });
    mesh(headShape(sphere(0.085, 32, 18, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.6, Math.PI * 0.34), [0, 0, 0.004]), mat(t.hair || '#3b2616', { ...DS, roughness: 0.8 }), head, [0, 0, 0.004]);
    mesh(sphere(0.028, 16, 12), b, head, [0, -0.084, 0.05], [1.15, 1, 0.75]); // 턱수염
    const mus = mesh(new THREE.TorusGeometry(0.017, 0.006, 6, 14, Math.PI), b, head, [0, -0.037, 0.073]);
    mus.rotation.z = Math.PI;
    mouth.position.z = 0.076;
  }
  // 베일(여인): 흰 속두건 + 겉 베일 + 어깨로 흘러내림
  if (t.veil) {
    // 앞머리: 베일 아래로 보이는 이마 위 머리. 가운데 가르마에서 양옆 관자놀이로 갈수록 길게 쓸어 내린 두 갈래
    const fh = mat(t.hair || '#3b2616', { ...DS, roughness: 0.75 });
    [-1, 1].forEach(k => {
      const g = sphere(0.0838, 20, 10, Math.PI / 2 + (k > 0 ? 0.012 : -0.8), 0.788, 0, Math.PI * 0.3), q = g.attributes.position;
      for (let i = 0; i < q.count; i++) {
        const x = q.getX(i), y = q.getY(i), z = q.getZ(i), r = Math.hypot(x, y, z), h = Math.hypot(x, z);
        const th = Math.acos(y / r), dp = Math.abs(Math.atan2(z, -x) - Math.PI / 2) / 0.8;
        const nt = th * (0.62 + 0.55 * dp); // 가르마 쪽은 짧게, 바깥은 길게
        const f = h > 1e-6 ? r * Math.sin(nt) / h : 0;
        q.setXYZ(i, x * f, r * Math.cos(nt), z * f);
      }
      mesh(headShape(g, [0, 0.004, -0.002]), fh, head, [0, 0.004, -0.002]);
    });
    mesh(sphere(0.087, 28, 16, ...SBACK(Math.PI * 1.55), 0, Math.PI * 0.8), mat(t.inner, DS), head, [0, 0.004, -0.002], [0.97, 1.06, 1.02]);
    const v = mat(t.mantle, DS);
    mesh(sphere(0.096, 28, 16, ...SBACK(Math.PI * 1.38), 0, Math.PI * 0.82), v, head, [0, 0.008, -0.006], [0.97, 1.05, 1.02]);
    mesh(folds(lathe([[0.093, -0.03], [0.104, -0.1], [0.116, -0.16], [0.126, -0.22]], 32, ...BACK(Math.PI * 1.3)), 9, 0.005, 0), v, head);
  }
  // 머릿수건(남자): 천 + 이마 끈
  if (t.hood) {
    const h = mat(t.hood, DS);
    mesh(sphere(0.094, 28, 16, ...SBACK(Math.PI * 1.4), 0, Math.PI * 0.78), h, head, [0, 0.008, -0.004], [0.97, 1.05, 1.02]);
    mesh(folds(lathe([[0.092, -0.03], [0.108, -0.1], [0.128, -0.16]], 28, ...BACK(Math.PI * 1.3)), 8, 0.006, 0), h, head);
    if (t.band) mesh(new THREE.TorusGeometry(0.088, 0.008, 6, 32), mat(t.band), head, [0, 0.045, -0.004], [0.97, 1.02, 1]).rotation.x = Math.PI / 2 - 0.15;
  }
  if (t.turban) mesh(sphere(0.1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(t.turban), head, [0, 0.025, 0], [1, 1.25, 1]);
  if (t.crown) mesh(new THREE.CylinderGeometry(0.088, 0.082, 0.05, 20, 1, true), mat('#d6a93a', { metalness: 0.6, roughness: 0.35, ...DS }), head, [0, 0.075, 0]);
  if (t.helmet) {
    mesh(sphere(0.094, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('#a88a4a', { metalness: 0.5, roughness: 0.4 }), head, [0, 0.01, 0]);
    mesh(new THREE.BoxGeometry(0.02, 0.06, 0.15), mat('#9d3328'), head, [0, 0.11, -0.01]);
  }
  if (t.halo) {
    const h = mesh(new THREE.TorusGeometry(0.075, 0.0055, 8, 40), mat('#f3d27a', { emissive: '#d9a940', emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 }), head, [0, 0.105, -0.035]);
    h.rotation.x = Math.PI / 2 - 0.35;
    h.castShadow = false;
  }

  // 팔: 어깨 축에서 매달림. rotation.x 음수 = 앞으로, rotation.z(바깥쪽 부호) = 옆으로, 팔꿈치 x 음수 = 굽힘
  const arm = side => {
    const p = new THREE.Group();
    p.position.set(side * B.shoulder, 0.635, 0);
    upper.add(p);
    const a = slim ? 0.78 : 0.88; // 팔도 가늘게 (여인은 더)
    const sleeveM = t.bare ? skin : robe; // 옷이 없으면 맨팔
    mesh(sphere(0.044 * a * (t.bare ? 0.8 : 1), 16, 12), sleeveM, p, [-side * 0.012, -0.005, 0], [0.5, 1, 1]); // 어깨 구슬은 옆으로 납작하게 — 팔을 앞으로 내밀면 망토를 뚫고 혹처럼 드러났다
    mesh(new THREE.CylinderGeometry(0.037 * a * (t.bare ? 0.8 : 1), 0.042 * a * (t.bare ? 0.75 : 1), 0.16, 16), sleeveM, p, [0, -0.075, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.15;
    p.add(elbow);
    if (t.bare) mesh(new THREE.CylinderGeometry(0.026, 0.021, 0.15, 14), skin, elbow, [0, -0.07, 0]);
    else {
      mesh(new THREE.CylinderGeometry(0.043 * a, B.sleeve, 0.15, 18, 1, true), mat(t.robe, DS), elbow, [0, -0.07, 0]);
      mesh(new THREE.TorusGeometry(B.sleeve - 0.001, 0.004, 6, 24), trim, elbow, [0, -0.146, 0]).rotation.x = Math.PI / 2;
    }
    mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.05, 12), skin, elbow, [0, -0.135, 0]);
    mesh(sphere(0.025, 14, 10), skin, elbow, [0, -0.172, 0.004], [0.8, 1.15, 0.58]);
    mesh(new THREE.CapsuleGeometry(0.0075, 0.018, 3, 8), skin, elbow, [-side * 0.017, -0.162, 0.012]).rotation.z = -side * 0.5;
    // 손에 든 빵 한 덩이 (빵 떼는 자세에서만)
    const loaf = mesh(new THREE.CapsuleGeometry(0.022, 0.03, 4, 10), mat('#c99a5a', { roughness: 0.9 }), elbow, [0, -0.19, 0.02]);
    loaf.rotation.z = Math.PI / 2;
    loaf.visible = false;
    p.userData.side = side;
    p.userData.elbow = elbow;
    p.userData.loaf = loaf;
    return p;
  };
  const armL = arm(1), armR = arm(-1);
  // 품에 안은 바구니 (빵과 물고기)
  const basket = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.06, 16, 1, true), mat('#9a7442', { ...DS, roughness: 0.95 }), basket);
  mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20), mat('#7d5a30'), basket, [0, 0.03, 0]).rotation.x = Math.PI / 2;
  mesh(sphere(0.066, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d0a462', { roughness: 0.9 }), basket, [0, 0.005, 0], [1, 0.45, 1]);
  basket.position.set(0, 0.47, 0.15);
  basket.visible = false;
  upper.add(basket);
  // 손에 드는 물건들: 비둘기 한 쌍(성전 제물), 예물 상자(박사들) — item 이름으로 하나만 보인다
  const doves = new THREE.Group();
  [-1, 1].forEach(s => {
    const b = new THREE.Group();
    mesh(sphere(0.026, 12, 10), mat('#f4f1ea'), b, [0, 0, 0], [1.3, 0.9, 0.9]);
    mesh(sphere(0.016, 10, 8), mat('#f4f1ea'), b, [0.03, 0.018, 0]);
    mesh(new THREE.ConeGeometry(0.006, 0.014, 6), mat('#d08a5a'), b, [0.046, 0.017, 0]).rotation.z = -Math.PI / 2;
    b.position.set(s * 0.03, 0, 0); b.rotation.y = s * 0.4;
    doves.add(b);
  });
  doves.position.set(0, 0.47, 0.15);
  const gift = new THREE.Group();
  const gold = mat('#d6a93a', { metalness: 0.6, roughness: 0.35 });
  mesh(new THREE.BoxGeometry(0.08, 0.055, 0.06), gold, gift);
  mesh(new THREE.BoxGeometry(0.086, 0.018, 0.066), mat('#7a2a5e', { roughness: 0.5 }), gift, [0, 0.035, 0]);
  mesh(sphere(0.012, 8, 6), gold, gift, [0, 0.05, 0]);
  gift.position.set(0, 0.47, 0.15);
  // 물동이 (우물가의 여인): 배가 불룩한 질그릇
  const jar = new THREE.Group();
  mesh(lathe([[0.001, 0], [0.035, 0], [0.058, 0.05], [0.055, 0.1], [0.03, 0.13], [0.034, 0.15], [0.001, 0.15]], 18), mat('#b5653e', { roughness: 0.9 }), jar, [0, -0.06, 0]);
  jar.position.set(0, 0.47, 0.15);
  // 두루마리 (회당에서 읽는 이사야서): 양 끝의 막대에 감긴 양피지
  const scroll = new THREE.Group();
  [-1, 1].forEach(s => mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 12), mat('#e8dcbf', { roughness: 0.8 }), scroll, [s * 0.04, 0, 0]));
  mesh(new THREE.BoxGeometry(0.08, 0.1, 0.004), mat('#f1e7cf', { ...DS, roughness: 0.8 }), scroll, [0, 0, 0.012]);
  scroll.position.set(0, 0.5, 0.16); scroll.rotation.x = -0.5;
  // 향유 옥합: 흰 돌의 작은 병
  const alabaster = new THREE.Group();
  mesh(lathe([[0.001, 0], [0.022, 0], [0.03, 0.04], [0.02, 0.08], [0.012, 0.09], [0.016, 0.1], [0.001, 0.1]], 16), mat('#f1ece0', { roughness: 0.4 }), alabaster, [0, -0.04, 0]);
  alabaster.position.set(0, 0.47, 0.15);
  // 종려나무 가지: 들어 올려 흔든다 (손에 쥔 채 위로 솟은 잎)
  const palm = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.3, 5), mat('#6b7a3a'), palm, [0, 0.13, 0]);
  for (let i = 0; i < 8; i++) { const l = mesh(new THREE.BoxGeometry(0.11, 0.004, 0.018), mat('#5f8a3a', DS), palm, [0, 0.12 + i * 0.022, 0]); l.rotation.z = (i % 2 ? 1 : -1) * 0.5; l.position.x = (i % 2 ? 1 : -1) * 0.04; }
  palm.position.set(0.02, 0.5, 0.15);
  // 잔 (마지막 만찬)
  const cup = new THREE.Group();
  mesh(lathe([[0.001, 0], [0.022, 0], [0.006, 0.01], [0.006, 0.04], [0.03, 0.06], [0.032, 0.09], [0.001, 0.08]], 16), mat('#b98a4a', { metalness: 0.4, roughness: 0.5 }), cup, [0, -0.03, 0]);
  cup.position.set(0, 0.5, 0.16);
  // 횃불: 손에 든 막대 끝의 불꽃과 빛 (겟세마네의 밤)
  const torch = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.3, 6), mat('#5a3d22'), torch, [0, 0.1, 0]);
  const fl = mesh(new THREE.ConeGeometry(0.025, 0.07, 8), mat('#ffc060', { emissive: '#ff9a30', emissiveIntensity: 2.5 }), torch, [0, 0.28, 0]);
  fl.castShadow = false;
  const tl = new THREE.PointLight('#ffa850', 1.2, 1.3, 1.5); tl.position.y = 0.32; torch.add(tl);
  torch.position.set(0.05, 0.5, 0.16);
  // 말아 든 깔개 (베데스다: 자리를 들고 걸어가라)
  const mat_ = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 14), mat('#b89a6a', { roughness: 0.95 }), mat_).rotation.z = Math.PI / 2;
  [-1, 1].forEach(s => mesh(new THREE.TorusGeometry(0.036, 0.004, 6, 16), mat('#6b4a2a'), mat_, [s * 0.06, 0, 0]).rotation.y = Math.PI / 2);
  mat_.position.set(0, 0.47, 0.15);
  [doves, gift, jar, scroll, alabaster, palm, cup, torch, mat_].forEach(g => { g.visible = false; upper.add(g); });
  const items = { basket, doves, gift, jar, scroll, alabaster, palm, cup, torch, mat: mat_ };

  // 발: 샌들 위의 맨발이 옷자락 아래로
  const feet = [1, -1].map(s => {
    const f = new THREE.Group();
    f.position.set(s * 0.055, 0, 0.085);
    root.add(f);
    mesh(new THREE.BoxGeometry(0.052, 0.01, 0.105), mat('#6b4a2a'), f, [0, 0.005, 0.005]);
    mesh(sphere(0.026, 12, 8), skin, f, [0, 0.018, 0.012], [1, 0.55, 1.7]);
    mesh(new THREE.TorusGeometry(0.024, 0.004, 4, 12, Math.PI), mat('#5a3d22'), f, [0, 0.012, 0.03]);
    return f;
  });

  let wings, glow, staff;
  if (t.wings) wings = [1, -1].map(s => makeWing(s, upper));
  if (t.glow) {
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.set(1.5, 1.5, 1);
    glow.position.set(0, 0.55, -0.1);
    upper.add(glow);
  }
  if (t.staff) {
    staff = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 8), mat('#6b4a2a'), staff, [0, 0.475, 0]);
    mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), mat('#6b4a2a'), staff, [-0.05, 0.95, 0]);
    staff.position.set(-0.2, 0, 0.06);
    root.add(staff);
  }
  if (t.spear) { // 로마 병사의 창: 곧게 세워 든다
    staff = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.01, 0.012, 1.12, 8), mat('#5e4128'), staff, [0, 0.56, 0]);
    mesh(new THREE.ConeGeometry(0.022, 0.09, 8), mat('#9a9a92', { metalness: 0.6, roughness: 0.4 }), staff, [0, 1.16, 0]);
    staff.position.set(-0.17, 0, 0.07);
    root.add(staff);
  }
  // 아기 (안는 자세에서만 보임)
  const baby = new THREE.Group();
  mesh(new THREE.CapsuleGeometry(0.045, 0.1, 6, 12), mat('#f2ead8'), baby).rotation.z = Math.PI / 2;
  mesh(sphere(0.04, 14, 10), mat(SKIN[2]), baby, [0.08, 0.01, 0]);
  baby.position.set(0, 0.47, 0.12);
  baby.visible = false;
  upper.add(baby);
  // 잠자리 깔개 (누운 자세에서만)
  const bed = mesh(new THREE.BoxGeometry(0.95, 0.025, 0.36), mat('#a2875c'), root, [0, 0.012, 0]);
  bed.visible = false;
  bed.receiveShadow = true;

  return { type, t, root, body, skirt, skirtMesh, hemTrim, upper, torso, waist: wy, mantleG, mantleSpan: B.mantle[0][1] - B.mantle[B.mantle.length - 1][1], head, armL, armR, feet, wings, glow, staff, baby, bed, eyes, mouth, basket, items };
}

// 실루엣: 모든 재질을 어두운 단색으로 바꿔 얼굴·무늬가 보이지 않게 한다 (골고다)
const SIL = new THREE.MeshStandardMaterial({ color: '#241b14', roughness: 1 });
// 빛 속의 실루엣: 타락 전의 아담과 하와 (프롤로그) — 얼굴·몸의 세부 없이 따뜻한 빛의 윤곽만
const SIL_LIGHT = new THREE.MeshStandardMaterial({ color: '#f4dfae', emissive: '#e9c47c', emissiveIntensity: 0.6, roughness: 1 });
function silhouette(p, light) {
  p.root.traverse(o => { if (o.isMesh) o.material = light ? SIL_LIGHT : SIL; });
  if (p.glow) p.glow.visible = false;
}

/* ---------- 배우: 자세 목표값을 향해 부드럽게 움직인다 ---------- */
class Actor {
  // o: { silhouette(true 어두운 윤곽 · 'light' 빛의 윤곽), solemn(입·손짓을 멈추고 느리게), speed, y }
  constructor(type, x = 0, z = 0, face = 0, o = {}) {
    this.p = makePerson(type);
    if (o.silhouette) silhouette(this.p, o.silhouette === 'light');
    this.solemn = !!o.solemn;
    this.noGaze = o.gaze === false; // 남이 말해도 돌아보지 않음 (멀리 있는 사람 등)
    this.item = null;
    this.pos = new THREE.Vector2(x, z);
    this.goal = this.pos.clone();
    this.face = face; this.faceT = face;
    this.pose = 'idle'; this.t0 = 0;
    this.y = 0; this.yT = 0;
    this.show = 1; this.showT = 1;
    this.floating = !!this.p.t.wings;
    this.speed = 0.55;
    this.walkPhase = Math.random() * 6;
    this.seed = Math.random() * 10;
    if (o.speed) this.speed = o.speed;
    if (o.y) { this.y = this.yT = o.y; this.fixedY = true; } // 높이를 직접 정한 사람(십자가 위)은 지면을 따르지 않는다
    this.ground = 0;
    this.big = 1; // 3D 지형 안에서 멀리 물러날 때 사람만 키우는 배율 (stage.js)
    this.p.root.position.set(x, this.y, z);
    // 나타나고 사라질 때 크기 대신 투명도로 — 재질을 인물마다 따로 둔다
    this.mats = [];
    this.p.root.traverse(m => {
      if (!m.isMesh) return;
      m.material = m.material.clone();
      Object.assign(m.material.userData, { op: m.material.opacity, tr: m.material.transparent, dw: m.material.depthWrite });
      this.mats.push(m.material);
    });
    this.op = -1;
  }
  // 나타나고 사라질 때: 반투명(transparent) 대신 점묘 투명도(alphaHash)를 쓴다.
  // 반투명은 겹친 천(망토·베일·소매)의 앞뒤가 엉켜 뒤쪽이 비쳐 보이고, 다 나타나는 순간 옷 위치가 바뀐 듯 보였다
  fadeTo(op) {
    if (Math.abs(op - this.op) < 0.004) return;
    const solid = op > 0.995;
    this.mats.forEach(m => {
      if (m.userData.tr) { m.opacity = m.userData.op * op; return; } // 원래 반투명인 것(볼 홍조)은 그대로
      if (m.alphaHash !== !solid) { m.alphaHash = !solid; m.needsUpdate = true; }
      m.opacity = solid ? 1 : op;
    });
    this.op = op;
  }
  // 자세를 바로 맞춘다 — 생성되거나 장면이 다시 시작될 때 기본 자세에서 천천히 바뀌는 모습이 보이지 않게
  settle() { const s = this.show; for (let i = 0; i < 60; i++) this.update(i * 0.05, 0.05); this.show = s; this.fadeTo(Math.min(1, s)); }
  set(pose) { if (pose !== this.pose) { this.pose = pose; this.t0 = performance.now() / 1000; } }
  moveTo(x, z = this.goal.y) { this.goal.set(x, z); }
  look(dir) { this.faceT = dir; this.target = null; } // -1 왼쪽, 0 정면, 1 오른쪽 (중간값 허용)
  update(time, dt) {
    const p = this.p, t = time + this.seed;
    // 이동
    const d = this.goal.clone().sub(this.pos), dist = d.length();
    const moving = dist > 0.02;
    if (moving) {
      const step = Math.min(dist, this.speed * dt);
      this.pos.addScaledVector(d.normalize(), step);
    }
    // 걷는 동안만 가는 쪽을 보고, 멈추면 지정한 방향(상대)을 다시 본다
    // (놀라 뒷걸음칠 때는 상대를 본 채로 물러난다)
    // 바라볼 상대가 있으면(대화 중) 그 사람 쪽으로 — 몸은 얼굴이 보이는 데까지만, 나머지는 고개로 돌린다
    let want = this.faceT, headY = 0;
    if (this.target && this.target.showT > 0 && this.pose !== 'sleep') {
      const ang = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.y - this.pos.y);
      want = THREE.MathUtils.clamp(ang, -1.15, 1.15);
      headY = THREE.MathUtils.clamp(ang - this.face, -0.45, 0.45);
    }
    const faceTo = moving && Math.abs(d.x) > 0.01 && !this.floating && this.pose !== 'afraid' ? Math.sign(d.x) * 1.35 : want;
    this.face = damp(this.face, faceTo, 6, dt);
    p.head.rotation.y = damp(p.head.rotation.y, moving ? 0 : headY, 5, dt);
    this.y = damp(this.y, this.yT + (this.floating ? 0.22 + Math.sin(t * 1.6) * 0.035 : 0), 2.2, dt);
    this.show = damp(this.show, this.showT, 4, dt);
    p.root.position.set(this.pos.x, this.y + this.ground, this.pos.y);
    p.root.rotation.y = this.face;
    p.root.scale.setScalar((0.94 + 0.06 * this.show) * this.big);
    p.root.visible = this.show > 0.01;
    this.fadeTo(Math.min(1, this.show));

    // 자세별 목표: 팔 [앞, 옆, 팔꿈치], 몸 기울기, 머리 숙임, 낮춤(무릎 꿇기), 눕기
    // kneel: 0 서 있음 → 1 무릎 꿇음 (치마가 낮아져 바닥에 퍼지고 상체가 내려앉는다)
    let aL = [0.05, 0.07, -0.15], aR = [0.05, 0.07, -0.15], lean = 0, nod = 0, sink = 0, lie = 0, kneel = 0, carry = false;
    const squash = 1 + Math.sin(t * 1.8) * 0.008;
    const chest = [-0.3, -0.22, -1.55]; // 두 손을 가슴 앞에 모음
    switch (moving && !this.floating ? 'walk' : this.pose) {
      case 'walk': {
        this.walkPhase += dt * 7.5;
        const s = Math.sin(this.walkPhase);
        aL = [s * 0.4, 0.07, -0.3]; aR = [-s * 0.4, 0.07, -0.3];
        sink = -Math.abs(Math.cos(this.walkPhase)) * 0.02;
        lean = 0.06;
        p.feet[0].position.z = 0.09 + s * 0.07; p.feet[1].position.z = 0.09 - s * 0.07;
        if (this.pose === 'carry') { carry = true; aL = aR = [-0.4, -0.25, -1.3]; }
        break;
      }
      case 'speak':
        aR = [-0.5 + Math.sin(t * 2.6) * 0.2, 0.3 + Math.sin(t * 1.3) * 0.1, -0.9 + Math.sin(t * 2.6 + 1) * 0.25];
        aL = [-0.1, 0.1, -0.4];
        nod = Math.sin(t * 2.2) * 0.07;
        break;
      case 'listen': nod = 0.08 + Math.sin(t * 0.9) * 0.03; aL = aR = [-0.1, 0.05, -0.5]; break;
      case 'afraid':
        aL = aR = [-0.25, -0.12, -2.1]; lean = -0.14; nod = -0.1;
        p.root.position.x += Math.sin(t * 38) * 0.004;
        break;
      case 'kneel': aL = aR = chest; lean = 0.12; nod = 0.32; kneel = 1; break;
      case 'pray': aL = aR = chest; nod = 0.25; break;
      case 'bless': aR = [-1.5 + Math.sin(t * 1.5) * 0.08, 0.95, -0.55]; aL = [-0.1, 0.12, -0.4]; nod = -0.05; break;
      case 'raise': aL = aR = [-2.6 + Math.sin(t * 2) * 0.06, 0.45, -0.1]; nod = -0.2; break;
      case 'bow': lean = 0.45; nod = 0.3; aL = aR = [-0.3, -0.1, -0.8]; break;
      case 'look-up': nod = -0.35; aL = aR = [-0.1, 0.15, -0.4]; break;
      case 'sleep': lie = 1; aL = aR = [0, 0.1, -0.2]; nod = 0.1; break;
      case 'carry': aL = aR = [-0.4, -0.25, -1.3]; nod = 0.18; carry = true; break;
      case 'ride': kneel = 0.8; aL = aR = [-0.3, -0.2, -1.2]; nod = 0.08; break; // 나귀 등에 걸터앉음
      case 'point': aR = [-1.5, 0.25, 0]; break;
      case 'sit': kneel = 0.75; aL = aR = [-0.3, -0.15, -0.9]; break;
      case 'rebuke': aR = [-1.95, 0.3, -0.05]; aL = [-0.7, 0.55, -0.25]; lean = 0.04; nod = -0.12; break; // 바람을 꾸짖음
      case 'break': { // 빵을 떼어 나눔: 두 손을 앞에 모았다 벌린다
        const o = (Math.sin(t * 1.6) + 1) * 0.1;
        aL = [-0.95, -0.1 + o, -0.95]; aR = [-0.95, -0.1 + o, -0.95]; nod = 0.18; break;
      }
      case 'shrug': aL = aR = [-0.45, 0.6, -1.05]; nod = 0.08; break; // 어쩔 줄 모름
      case 'cower': aL = aR = [-0.25, -0.12, -2.1]; lean = 0.22; nod = 0.25; kneel = 0.55; p.root.position.x += Math.sin(t * 34) * 0.003; break;
      case 'mourn': aL = aR = [-0.45, -0.32, -2.05]; lean = 0.25; nod = 0.55; kneel = 1; break; // 얼굴을 감싸고 엎드림
      case 'crucified': aL = aR = [0, 1.5, 0]; nod = 0.3; break;
      case 'crucified-dead': aL = aR = [0, 1.42, 0]; nod = 0.62; break;
      case 'sit-ground': kneel = 0.9; aL = aR = [-0.3, -0.2, -1.0]; nod = 0.05; break;
      case 'hold-basket': aL = aR = [-0.45, -0.3, -1.25]; nod = 0.12; break;
    }
    // 엄숙한 장면: 숨쉬기 외의 작은 몸짓을 멈춘다
    if (this.solemn) { nod += 0.05; }
    p.armL.userData.loaf.visible = p.armR.userData.loaf.visible = this.pose === 'break';
    // 손에 든 물건: item 이름의 것 하나만 보이고, 서 있거나 무릎 꿇은 동안엔 두 손으로 받쳐 든다
    let holding = false;
    Object.entries(p.items).forEach(([k, g]) => { g.visible = this.item === k || (k === 'basket' && this.pose === 'hold-basket'); holding ||= g.visible; });
    if (holding && !moving && ['idle', 'listen', 'kneel', 'hold-basket', 'bow'].includes(this.pose)) { aL = aR = [-0.45, -0.3, -1.25]; }
    if (!moving) { p.feet[0].position.z = damp(p.feet[0].position.z, 0.09, 8, dt); p.feet[1].position.z = damp(p.feet[1].position.z, 0.09, 8, dt); }
    const k = 5;
    const arm = (a, [fx, sx, ex]) => {
      a.rotation.x = damp(a.rotation.x, fx, k, dt);
      a.rotation.z = damp(a.rotation.z, sx * a.userData.side, k, dt);
      a.userData.elbow.rotation.x = damp(a.userData.elbow.rotation.x, ex, k, dt);
    };
    arm(p.armL, aL); arm(p.armR, aR);
    p.torso.rotation.x = damp(p.torso.rotation.x, lean, k, dt);
    p.head.rotation.x = damp(p.head.rotation.x, nod, k, dt);
    p.body.scale.y = damp(p.body.scale.y, squash * (p.t.height || 1), k, dt);
    p.body.rotation.z = damp(p.body.rotation.z, lie * Math.PI / 2 * -Math.sign(this.face || 1), 3, dt);
    p.body.position.y = damp(p.body.position.y, lie * 0.12 - sink, 3, dt);
    this.kneel = damp(this.kneel || 0, kneel, 3.5, dt);
    const kn = this.kneel;
    if (p.skirtMesh) {
      p.skirtMesh.morphTargetInfluences[0] = kn; // 서 있는 치마 → 꿇은 치마
      p.hemTrim.scale.set(1 + 0.22 * kn, 1 + 0.5 * kn, 1); // 단 장식도 넓게 퍼진 치맛단을 따라 (회전된 고리라 y가 깊이)
      p.hemTrim.position.z = -0.04 * kn;
      p.hemTrim.position.y = 0.028 - 0.012 * kn;
    }
    p.torso.position.y = p.waist * (1 - 0.58 * kn);
    p.mantleG.scale.y = 1 - (p.waist * 0.58 * kn) / p.mantleSpan;
    p.mantleG.scale.x = 1 + 0.12 * kn; p.mantleG.scale.z = 1 + 0.3 * kn; // 꿇으면 바닥에 퍼진 치맛단을 덮게 망토 자락도 넓게 (치마가 망토를 뚫고 나왔다)
    p.feet.forEach(f => (f.visible = lie < 0.5 && kn < 0.3 && !this.floating));
    // 아기: 안는 자세이거나, item으로 'baby'를 들고 있을 때(나귀를 타고 가면서 등)
    if (this.item === 'baby') { carry = true; if (!moving) aL = aR = [-0.4, -0.25, -1.3]; }
    p.baby.visible = carry;
    // 눈 깜빡임(사람마다 박자가 다르게), 말할 때 입 움직임
    // 저마다 2~6.5초 사이 제멋대로, 가끔은 두 번 연달아 깜빡인다
    if (this.blinkAt === undefined || this.blinkAt - t > 8) this.blinkAt = t + 0.5 + Math.random() * 4; // 장면을 되감아 시간이 뒤로 가도 다시 맞춘다
    if (t > this.blinkAt + 0.13) this.blinkAt = t + (Math.random() < 0.15 ? 0.2 : 2 + Math.random() * 4.5);
    const blink = t >= this.blinkAt ? 0.12 : 1;
    // 윗꺼풀을 앞으로 돌려 내리면 감긴다 (-0.4: 뜬 눈, 1.4: 감은 눈)
    p.eyes.forEach(e => { const L = e.userData.lid; L.rotation.x = damp(L.rotation.x, lie > 0.5 || blink < 1 ? 1.4 : -0.4, 30, dt); });
    const talk = this.pose === 'speak' && !this.solemn ? 0.55 + Math.abs(Math.sin(t * 8.5) * Math.sin(t * 3.1)) * 1.6 : 0.35;
    p.mouth.scale.y = damp(p.mouth.scale.y, talk, 18, dt);
    p.bed.visible = lie > 0.5;
    // 누우면 몸 가운데가 깔개 위에 오도록 발 쪽으로 옮긴다
    p.body.position.x = damp(p.body.position.x, lie * 0.42 * -Math.sign(this.face || 1), 3, dt);
    if (p.wings) {
      const flap = 0.35 + Math.sin(t * (this.y > 0.4 ? 7 : 2.2)) * (this.y > 0.4 ? 0.35 : 0.12);
      p.wings[0].rotation.y = flap; p.wings[1].rotation.y = -flap; // 끝이 등 뒤로 젖혀진다
    }
    if (p.glow) p.glow.material.opacity = (0.65 + Math.sin(t * 2.4) * 0.15) * this.show;
  }
}

export { TYPES, SKIN, makePerson, Actor, damp };
