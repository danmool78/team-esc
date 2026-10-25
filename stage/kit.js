/* 3D 무대 공통 도구: 재질·도형·주름 */
import * as THREE from '../assets/vendor/three.module.min.js';
export { THREE };

const matCache = new Map();
const mat = (c, extra = {}) => {
  const k = c + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, ...extra }));
  return matCache.get(k);
};
const DS = { side: THREE.DoubleSide };
const lathe = (pts, seg = 32, phi0 = 0, phiLen = Math.PI * 2) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiLen);
// 옷 주름: 회전체 표면을 둘레 방향으로 물결치게 한다 (yTop 아래로 갈수록 깊게)
function folds(geo, n, amp, yTop) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const a = Math.atan2(v.x, v.z), k = Math.min(1, Math.max(0, (yTop - v.y) / yTop));
    const nr = r + amp * k * Math.sin(a * n + Math.sin(a * 3) * 0.8);
    p.setXYZ(i, (v.x / r) * nr, v.y, (v.z / r) * nr);
  }
  geo.computeVertexNormals();
  return geo;
}
const mesh = (geo, m, parent, pos, scale) => {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  if (pos) o.position.set(...pos);
  if (scale) o.scale.set(...scale);
  parent.add(o);
  return o;
};
// 등 쪽(-z)을 감싸는 각도. 회전체(Lathe)는 φ=π가 등, 구(Sphere)는 φ=3π/2가 등이다
const BACK = len => [Math.PI - len / 2, len];
const SBACK = len => [Math.PI * 1.5 - len / 2, len];
const sphere = (r, w = 20, h = 14, ...a) => new THREE.SphereGeometry(r, w, h, ...a);

let glowTex;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(.35, 'rgba(255,215,130,.45)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (glowTex = new THREE.CanvasTexture(c));
}

const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));

export { mat, DS, lathe, folds, mesh, BACK, SBACK, sphere, glowTexture, damp };
