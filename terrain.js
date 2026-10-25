/* 3D 지형: 지도를 옮기는 대로 이어 받아 그리는 조각 지형.
   조각 하나 = 웹 메르카토르 줌 17 타일 하나 (전주에서 한 변 약 250m) = 위성사진 타일 한 장.
   작은 조각을 여럿 동시에 받아 가까운 곳부터 바로바로 채운다 (500m 조각에 타일 넷을 기다릴 때보다 빨리 보인다).
   카메라가 보는 곳 둘레의 조각을 가까운 것부터 받아 만들고, 멀어진 조각은 버린다.
   높이: AWS Open Data의 Terrain Tiles(terrarium, SRTM 등 공개 고도 자료) 줌 15.
   겉그림: 위성사진(Esri World Imagery의 Clarity — 기본 영상은 전주 상공이 줌마다 구름에 덮여 있었다) 또는 지도(OpenStreetMap) 줌 17.
   조각 경계의 높이는 모두 같은 함수(elevAt)로 구하므로 이웃 조각과 틈 없이 맞물린다 */
import { THREE } from './stage/kit.js';
import { makeFrame, lngPx, latPx } from './geo.js';
import { makeBuildings } from './buildings.js';

export const EXAG = 1.6; // 높이 과장 배율 — 전주는 낮은 언덕이라 실제 비율로는 밋밋하다
const ZD = 15, ZC = 17;          // 높이 · 조각(=겉그림) 줌
const N = 24;                    // 조각 하나의 격자 칸 수 (≈ 10m 간격)
const BUSY = 8;                  // 한꺼번에 받는 조각 수

export const LAYERS = {
  sat: { url: (z, x, y) => `https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, credit: '위성사진 © Esri, Maxar, Earthstar Geographics' },
  map: { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, credit: '지도 © OpenStreetMap 기여자' },
};
const DEM = (x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZD}/${x}/${y}.png`;

const loadImg = src => new Promise(res => {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = src;
});
// 메르카토르 전체 픽셀 → 위경도
const pxLng = (x, z) => x / (256 * 2 ** z) * 360 - 180;
const pxLat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (256 * 2 ** z)))) * 180 / Math.PI;

/* ---------- 고도 타일: 받아서 미터 값 배열로 풀어 둔다 (여러 게임·지역이 함께 쓴다) ---------- */
const demWait = new Map(), demData = new Map();
function dem(x, y) {
  const k = x + '/' + y;
  if (!demWait.has(k)) demWait.set(k, loadImg(DEM(x, y)).then(im => {
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, 256, 256).data, h = new Float32Array(256 * 256);
    for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    demData.set(k, h);
    return h;
  }));
  return demWait.get(k);
}
// 고도(m). 그 자리의 고도 타일이 아직 없으면 null
function elevAt(lat, lng) {
  const fx = lngPx(lng, ZD) - 0.5, fy = latPx(lat, ZD) - 0.5;
  const tx = Math.floor((fx + 0.5) / 256), ty = Math.floor((fy + 0.5) / 256);
  const h = demData.get(tx + '/' + ty);
  if (!h) return null;
  const lx = Math.max(0, Math.min(254.999, fx - tx * 256)), ly = Math.max(0, Math.min(254.999, fy - ty * 256));
  const ix = Math.floor(lx), iy = Math.floor(ly), u = lx - ix, v = ly - iy, a = iy * 256 + ix;
  return (h[a] * (1 - u) + h[a + 1] * u) * (1 - v) + (h[a + 256] * (1 - u) + h[a + 257] * u) * v;
}

/* ---------- 조각 지형 ---------- */
// area: { center, layer } — center가 지역 좌표의 원점(0, 0)
export async function buildTerrain({ center, layer = 'sat' }) {
  const F = makeFrame(center);
  const L = LAYERS[layer] || LAYERS.sat;
  const group = new THREE.Group();
  group.name = 'terrain';
  const chunks = new Map(); // 'x/y' → { mesh, H, ready, dead }
  const queue = [];
  let busy = 0, demOk = false, version = 0;

  // 원점 고도를 0으로: 처음 받은 가운데 고도 타일에서 잰다
  await dem(Math.floor(lngPx(center.lng, ZD) / 256), Math.floor(latPx(center.lat, ZD) / 256));
  const base = elevAt(center.lat, center.lng) ?? 0;
  const lift = e => (e == null ? 0 : (e - base) * EXAG);

  async function make(tx, ty, c) {
    // 오른쪽·아래 경계는 이웃 타일의 첫 픽셀이라, 거기 걸친 고도 타일까지 기다린다
    const s = ZC - ZD, dx = [tx >> s, (tx + 1) >> s], dy = [ty >> s, (ty + 1) >> s];
    const jobs = [];
    for (const x of new Set(dx)) for (const y of new Set(dy)) jobs.push(dem(x, y));
    let img = null;
    jobs.push(loadImg(L.url(ZC, tx, ty)).then(im => (img = im)));
    await Promise.all(jobs);
    if (c.dead) return;
    demOk ||= demData.size > 0;

    const pos = new Float32Array((N + 1) ** 2 * 3), uv = new Float32Array((N + 1) ** 2 * 2), H = new Float32Array((N + 1) ** 2);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const lat = pxLat(ty * 256 + (j / N) * 256, ZC), lng = pxLng(tx * 256 + (i / N) * 256, ZC);
      const [x, z] = F.toXZ(lat, lng);
      H[k] = lift(elevAt(lat, lng));
      pos.set([x, H[k], z], k * 3);
      uv.set([i / N, 1 - j / N], k * 2);
    }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    let map = null;
    if (img) { map = new THREE.Texture(img); map.needsUpdate = true; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : 0x8f9a6c, roughness: 0.95 }));
    mesh.receiveShadow = true;
    Object.assign(c, { mesh, H, ready: true });
    group.add(mesh);
    version++;
  }
  function pump() {
    while (busy < BUSY && queue.length) {
      const [tx, ty] = queue.shift(), c = chunks.get(tx + '/' + ty);
      if (!c || c.dead) continue;
      busy++;
      make(tx, ty, c).catch(() => {}).finally(() => { busy--; pump(); });
    }
  }
  function drop(k, c) {
    c.dead = true;
    if (c.mesh) { group.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.map?.dispose(); c.mesh.material.dispose(); }
    chunks.delete(k);
  }

  // 지도 모드면 3D 건물도 (바탕 지도와 같은 오픈스트리트맵 자료라 윤곽이 지도와 맞는다)
  const bld = layer === 'map' ? makeBuildings({
    F, ground: (lat, lng) => lift(elevAt(lat, lng)),
    ready: (lat, lng) => dem(Math.floor(lngPx(lng, ZD) / 256), Math.floor(latPx(lat, ZD) / 256)),
  }) : null;
  if (bld) group.add(bld.group);

  // 카메라가 보는 곳(x, z) 둘레 반경 r(m)의 조각을 원한다: 없는 것은 가까운 순서로 받고, 2.2배 넘게 먼 것은 버린다
  let last = null;
  function want(x, z, r) {
    bld?.want(x, z, r);
    if (last && Math.hypot(x - last.x, z - last.z) < 40 && Math.abs(r - last.r) < last.r * 0.15) return;
    last = { x, z, r };
    const ll = F.toLL(x, z);
    const cx = lngPx(ll.lng, ZC) / 256, cy = latPx(ll.lat, ZC) / 256;
    const tm = 40075016 * Math.cos(ll.lat * Math.PI / 180) / 2 ** ZC; // 조각 한 변(m)
    const rt = r / tm;
    const add = [];
    for (let ty = Math.floor(cy - rt); ty <= Math.floor(cy + rt); ty++) for (let tx = Math.floor(cx - rt); tx <= Math.floor(cx + rt); tx++) {
      const d = Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy);
      if (d > rt + 0.71) continue;
      const k = tx + '/' + ty;
      if (!chunks.has(k)) { chunks.set(k, { tx, ty }); add.push([d, tx, ty]); }
    }
    chunks.forEach((c, k) => { if (Math.hypot(c.tx + 0.5 - cx, c.ty + 0.5 - cy) > rt * 2.2 + 1) drop(k, c); });
    // 새로 원하는 것을 맨 앞에, 가까운 것부터
    queue.unshift(...add.sort((a, b) => a[0] - b[0]).map(([, tx, ty]) => [tx, ty]));
    pump();
  }

  // 높이: 다 만든 조각이면 그 격자에서, 아니면 받아 둔 고도 타일에서 바로, 그것도 없으면 0
  const heightAt = (x, z) => {
    const ll = F.toLL(x, z);
    const gx = lngPx(ll.lng, ZC) / 256, gy = latPx(ll.lat, ZC) / 256;
    const tx = Math.floor(gx), ty = Math.floor(gy), c = chunks.get(tx + '/' + ty);
    if (c?.ready) {
      const fx = (gx - tx) * N, fy = (gy - ty) * N, i = Math.min(N - 1, Math.floor(fx)), j = Math.min(N - 1, Math.floor(fy)), u = fx - i, v = fy - j;
      const h = (a, b) => c.H[b * (N + 1) + a];
      return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
    }
    return lift(elevAt(ll.lat, ll.lng));
  };
  // 처음 화면: 원점 둘레 r까지 다 받을 때까지 기다린다
  // x, z: 먼저 받을 곳 (기본은 원점). 위성/지도만 바꿀 땐 지금 보던 곳부터
  async function prime(r, x = 0, z = 0) {
    want(x, z, r);
    while (busy || queue.length) await new Promise(res => setTimeout(res, 60));
  }
  const dispose = () => { chunks.forEach((c, k) => drop(k, c)); bld?.dispose(); };

  return { group, heightAt, frame: F, want, prime, dispose, credit: L.credit, get demOk() { return demOk; }, get version() { return version; } };
}
