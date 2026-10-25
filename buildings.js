/* 3D 건물 (지도 모드에서만): 바탕 지도와 같은 오픈스트리트맵의 건물 윤곽을 높이만큼 세운다.
   자료는 OpenFreeMap 벡터 타일(무료, 키 없음)의 building 층 — render_height(높이 m)·render_min_height가 들어 있다.
   줌 14 타일(전주에서 한 변 약 2.4km) 하나를 한 덩어리 메시로 만들어, 카메라가 보는 곳 둘레만 받고 멀어지면 버린다.
   높이는 지형처럼 과장하지 않는다(실제 높이). 바닥은 그 건물 윤곽에서 가장 낮은 땅에 맞춰 공중에 뜨지 않게 */
import { THREE } from './stage/kit.js';
import { lngPx, latPx } from './geo.js';
import { readLayer } from './mvt.js';

const ZB = 14;
const TILEJSON = 'https://tiles.openfreemap.org/planet';
const pxLng = (x, z) => x / (256 * 2 ** z) * 360 - 180;
const pxLat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (256 * 2 ** z)))) * 180 / Math.PI;

// 타일 주소 틀은 한 번만 받는다 (판이 바뀌면 주소의 날짜가 바뀐다)
let tmpl = null;
const tileUrl = async (z, x, y) => {
  tmpl ||= fetch(TILEJSON).then(r => r.json()).then(j => j.tiles[0]).catch(() => null);
  const t = await tmpl;
  return t && t.replace('{z}', z).replace('{x}', x).replace('{y}', y);
};

// 켜고 끄기: 모든 지역의 건물에 함께 적용
let on = true;
const live = new Set();
export function setBuildingsOn(v) { on = !!v; live.forEach(b => (b.group.visible = on)); }

// 벽 감는 방향이 고리마다 달라 앞뒤가 섞이니 양면으로 그린다
const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
// 벽은 따뜻한 흰색, 지붕은 조금 어둡게. 높은 건물일수록 살짝 푸르게 (멀리서도 층이 읽히게)
const wallCol = new THREE.Color(), roofCol = new THREE.Color();

// F: 지역 좌표틀, ground(lat, lng): 땅 높이(m, 지형과 같은 기준), ready(lat, lng): 그 자리 고도 자료 받기
export function makeBuildings({ F, ground, ready }) {
  const group = new THREE.Group();
  group.name = 'buildings';
  group.visible = on;
  const tiles = new Map();
  const self = { group };

  async function make(tx, ty, t) {
    const url = await tileUrl(ZB, tx, ty);
    if (!url || t.dead) return;
    const buf = await fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    if (!buf || t.dead) return;
    const L = readLayer(buf, 'building');
    // 바닥 높이를 재려면 그 타일의 고도 자료가 있어야 한다 (줌 15 고도 타일 넷)
    await Promise.all([[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([u, v]) => ready(pxLat((ty + v) * 256, ZB), pxLng((tx + u) * 256, ZB))));
    if (t.dead) return;
    const k = 256 / L.extent;
    const toXZ = ([x, y]) => F.toXZ(pxLat(ty * 256 + y * k, ZB), pxLng(tx * 256 + x * k, ZB));
    const pos = [], col = [];
    const tri = (a, b, c, color) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b); };
    for (const f of L.features) {
      if (f.type !== 3) continue;
      const top = Math.max(3, +f.tags.render_height || 6), bot = Math.max(0, +f.tags.render_min_height || 0);
      if (top - bot < 0.5) continue;
      // 바깥 고리(넓이 +)와 그 안의 구멍(넓이 −)으로 나눈다 (타일 좌표는 y가 아래로)
      const polys = [];
      for (const r of f.rings) {
        let a = 0;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
        if (Math.abs(a) < 1) continue;
        const pts = r.map(toXZ);
        if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        if (a > 0) polys.push({ outer: pts, holes: [] }); else polys[polys.length - 1]?.holes.push(pts);
      }
      const h = top - bot;
      wallCol.setHSL(0.09 - Math.min(h, 40) * 0.0015, 0.18, 0.86 - Math.min(h, 40) * 0.004);
      roofCol.copy(wallCol).multiplyScalar(0.8);
      for (const { outer, holes } of polys) {
        // 바닥: 윤곽에서 가장 낮은 땅보다 조금 아래 (비탈에서도 바닥이 뜨지 않게)
        let g = Infinity;
        for (const [x, z] of outer) { const ll = F.toLL(x, z); g = Math.min(g, ground(ll.lat, ll.lng)); }
        const y0 = g - 1 + bot, y1 = g + top;
        // 벽: 고리마다 변 하나에 네모 하나
        for (const ring of [outer, ...holes]) for (let i = 0; i < ring.length; i++) {
          const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
          tri([ax, y0, az], [bx, y0, bz], [bx, y1, bz], wallCol);
          tri([ax, y0, az], [bx, y1, bz], [ax, y1, az], wallCol);
        }
        // 지붕
        const v2 = r => r.map(([x, z]) => new THREE.Vector2(x, z));
        const o = v2(outer), hs = holes.map(v2), all = [...o, ...hs.flat()];
        for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(o, hs)) {
          tri([all[a].x, y1, all[a].y], [all[c].x, y1, all[c].y], [all[b].x, y1, all[b].y], roofCol);
        }
      }
    }
    if (!pos.length || t.dead) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    t.mesh = mesh;
    group.add(mesh);
  }
  function drop(key, t) {
    t.dead = true;
    if (t.mesh) { group.remove(t.mesh); t.mesh.geometry.dispose(); }
    tiles.delete(key);
  }
  // 보는 곳(x, z) 둘레 반경 r(m)의 타일을 받는다. 너무 멀리서 볼 땐(건물이 점처럼 작을 땐) 새로 받지 않는다
  self.want = (x, z, r) => {
    if (!on || r > 2500) return;
    const ll = F.toLL(x, z);
    const cx = lngPx(ll.lng, ZB) / 256, cy = latPx(ll.lat, ZB) / 256;
    const tm = 40075016 * Math.cos(ll.lat * Math.PI / 180) / 2 ** ZB, rt = Math.min(r, 1500) / tm;
    for (let ty = Math.floor(cy - rt); ty <= Math.floor(cy + rt); ty++) for (let tx = Math.floor(cx - rt); tx <= Math.floor(cx + rt); tx++) {
      const key = tx + '/' + ty;
      if (tiles.has(key)) continue;
      const t = { tx, ty };
      tiles.set(key, t);
      make(tx, ty, t).catch(() => {});
    }
    tiles.forEach((t, key) => { if (Math.hypot(t.tx + 0.5 - cx, t.ty + 0.5 - cy) > rt + 2) drop(key, t); });
  };
  self.dispose = () => { tiles.forEach((t, key) => drop(key, t)); live.delete(self); };
  live.add(self);
  return self;
}
