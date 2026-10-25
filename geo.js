/* 좌표 도구: 위경도 ↔ 게임 지역의 미터 좌표, 웹 메르카토르 타일 */

// 기본 게임 지역: 전주 한옥마을 (진행자가 게임을 만들 때 바꾼다)
export const JEONJU = { lat: 35.8155, lng: 127.1525 };

// 지역 좌표: 중심에서 동쪽이 +x, 남쪽이 +z (미터). 화면 위가 북쪽이 되도록 three.js의 -z를 북으로 둔다.
// 몇 km 안의 게임이라 평면 근사로 충분하다
export function makeFrame(center) {
  const kx = 111320 * Math.cos(center.lat * Math.PI / 180), kz = 110574;
  return {
    center,
    toXZ: (lat, lng) => [(lng - center.lng) * kx, -(lat - center.lat) * kz],
    toLL: (x, z) => ({ lat: center.lat - z / kz, lng: center.lng + x / kx }),
  };
}

// 두 지점 사이 거리(m)
export function dist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const fmtDist = m => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`);

// 웹 메르카토르: 줌 z의 전체 픽셀 좌표
export const lngPx = (lng, z) => (lng + 180) / 360 * 256 * 2 ** z;
export const latPx = (lat, z) => {
  const s = Math.sin(lat * Math.PI / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z;
};
