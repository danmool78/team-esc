/* 게임 지역의 3D 지형.
   높이: AWS Open Data의 Terrain Tiles(terrarium, SRTM 등 공개 고도 자료)를 줌 15로 받아 이어 붙인다.
   겉그림: 위성사진(Esri World Imagery의 Clarity — 기본 영상은 전주 상공이 줌마다 구름에 덮여 있었다) 또는 지도(OpenStreetMap) 타일을 이어 붙여 입힌다.
   받지 못하면 높이로 음영을 그려 대신한다 (오프라인·차단된 망에서도 지형은 보이게) */
import { THREE } from './stage/kit.js';
import { makeFrame, lngPx, latPx } from './geo.js';

export const EXAG = 1.6; // 높이 과장 배율 — 전주는 낮은 언덕이라 실제 비율로는 밋밋하다
const HZ = 15;           // 높이 타일 줌 (≈ 4m/픽셀)
const SEG = 220;         // 지형 격자 칸 수

export const LAYERS = {
  sat: { url: (z, x, y) => `https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, max: 17, credit: '위성사진 © Esri, Maxar, Earthstar Geographics' },
  map: { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, max: 18, credit: '지도 © OpenStreetMap 기여자' },
};
const DEM = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const loadImg = src => new Promise(res => {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = src;
});

// 위경도 범위를 덮는 타일을 받아 한 장의 캔버스로 잇는다. ox, oy: 캔버스 왼쪽 위의 전체 픽셀 좌표
async function mosaic(bb, z, url) {
  const x0 = Math.floor(lngPx(bb.lng0, z) / 256), x1 = Math.floor(lngPx(bb.lng1, z) / 256);
  const y0 = Math.floor(latPx(bb.lat1, z) / 256), y1 = Math.floor(latPx(bb.lat0, z) / 256);
  const c = document.createElement('canvas');
  c.width = (x1 - x0 + 1) * 256; c.height = (y1 - y0 + 1) * 256;
  const g = c.getContext('2d', { willReadFrequently: true });
  const jobs = [];
  let miss = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
    jobs.push(loadImg(url(z, x, y)).then(im => (im ? g.drawImage(im, (x - x0) * 256, (y - y0) * 256) : miss++)));
  await Promise.all(jobs);
  return { c, g, z, ox: x0 * 256, oy: y0 * 256, miss, total: jobs.length };
}

// 겉그림 줌: 지역 전체가 3000픽셀 안에 들어오는 가장 자세한 줌
function pickZoom(bb, max) {
  for (let z = max; z > 10; z--) {
    const w = lngPx(bb.lng1, z) - lngPx(bb.lng0, z);
    if (w <= 3000) return z;
  }
  return 11;
}

export async function buildTerrain({ center, radius, layer = 'sat' }) {
  const F = makeFrame(center);
  const half = radius * 1.35; // 반경 바깥으로 조금 더 깔아 가장자리가 보이지 않게
  const a = F.toLL(-half, half), b = F.toLL(half, -half);
  const bb = { lat0: a.lat, lng0: a.lng, lat1: b.lat, lng1: b.lng };

  const L = LAYERS[layer] || LAYERS.sat;
  const [dem, img] = await Promise.all([mosaic(bb, HZ, DEM), mosaic(bb, pickZoom(bb, L.max), L.url)]);
  const demData = dem.miss < dem.total ? dem.g.getImageData(0, 0, dem.c.width, dem.c.height).data : null;

  // 고도(m): terrarium = R·256 + G + B/256 − 32768
  const elev = (lat, lng) => {
    if (!demData) return 0;
    const fx = lngPx(lng, HZ) - dem.ox - 0.5, fy = latPx(lat, HZ) - dem.oy - 0.5;
    const ix = Math.max(0, Math.min(dem.c.width - 2, Math.floor(fx))), iy = Math.max(0, Math.min(dem.c.height - 2, Math.floor(fy)));
    const tx = fx - ix, ty = fy - iy;
    const at = (x, y) => { const i = (y * dem.c.width + x) * 4; return demData[i] * 256 + demData[i + 1] + demData[i + 2] / 256 - 32768; };
    return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
  };
  const base = elev(center.lat, center.lng);

  // 격자의 높이를 미리 구해 둔다 (heightAt은 이 격자를 보간)
  const N = SEG + 1, H = new Float32Array(N * N), step = (half * 2) / SEG;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const ll = F.toLL(-half + i * step, -half + j * step);
    H[j * N + i] = (elev(ll.lat, ll.lng) - base) * EXAG;
  }
  const heightAt = (x, z) => {
    const fx = Math.max(0, Math.min(SEG - 1e-3, (x + half) / step)), fz = Math.max(0, Math.min(SEG - 1e-3, (z + half) / step));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const h = (ii, jj) => H[jj * N + ii];
    return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - tz) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * tz;
  };

  const geo = new THREE.PlaneGeometry(half * 2, half * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2); // 눕힌 판: 꼭짓점 순서가 북서 → 남동으로 x, z와 같다
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const useImg = img.miss < img.total;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const i = Math.round((x + half) / step), j = Math.round((z + half) / step);
    pos.setY(k, H[j * N + i]);
    if (useImg) {
      const ll = F.toLL(x, z);
      uv.setXY(k, (lngPx(ll.lng, img.z) - img.ox) / img.c.width, 1 - (latPx(ll.lat, img.z) - img.oy) / img.c.height);
    }
  }
  geo.computeVertexNormals();

  const tex = new THREE.CanvasTexture(useImg ? img.c : shade(H, N));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return { mesh, heightAt, frame: F, half, credit: useImg ? L.credit : '', demOk: !!demData };
}

// 겉그림을 받지 못했을 때: 높이에 따라 들판색과 북서쪽 빛의 음영을 칠한다
function shade(H, N) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  let lo = Infinity, hi = -Infinity;
  H.forEach(h => { lo = Math.min(lo, h); hi = Math.max(hi, h); });
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h = H[j * N + i], t = (h - lo) / (hi - lo || 1);
    const dx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)];
    const dz = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
    const lit = 1 + (-dx - dz) * 0.04;
    const k = (j * N + i) * 4;
    im.data[k] = (120 + t * 70) * lit; im.data[k + 1] = (140 + t * 40) * lit; im.data[k + 2] = (90 + t * 30) * lit; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
