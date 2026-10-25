// 벡터 타일(Mapbox Vector Tile, protobuf)에서 한 층(layer)의 도형만 꺼내는 작은 해독기.
// 건물 윤곽(building 층)만 쓰므로 라이브러리 없이 필요한 만큼만 읽는다.
// 돌려주는 것: { extent, features: [{ type, tags, rings: [[[x,y],...], ...] }] } (x,y는 0~extent 타일 좌표)
export function readLayer(buf, want) {
  const b = new Uint8Array(buf);
  let p = 0;
  const varint = () => { let v = 0, s = 0, c; do { c = b[p++]; v += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return v; };
  const skip = w => { if (w === 0) varint(); else if (w === 1) p += 8; else if (w === 2) p += varint(); else if (w === 5) p += 4; };
  const str = (s, e) => new TextDecoder().decode(b.subarray(s, e));
  const packed = end => { const a = []; while (p < end) a.push(varint()); return a; };
  const zz = n => (n % 2 ? -(n + 1) / 2 : n / 2);
  while (p < b.length) {
    const k = varint(), f = k >> 3, w = k & 7;
    if (f !== 3 || w !== 2) { skip(w); continue; }
    const len = varint(), end = p + len;
    let name = '', extent = 4096;
    const keys = [], vals = [], feats = [];
    while (p < end) {
      const k2 = varint(), f2 = k2 >> 3, w2 = k2 & 7;
      if (f2 === 1 && w2 === 2) { const l = varint(); name = str(p, p + l); p += l; }
      else if (f2 === 3 && w2 === 2) { const l = varint(); keys.push(str(p, p + l)); p += l; }
      else if (f2 === 4 && w2 === 2) {
        // 값: 문자열·숫자 중 하나
        const l = varint(), e = p + l; let v = null;
        while (p < e) {
          const k3 = varint(), f3 = k3 >> 3, w3 = k3 & 7;
          if (f3 === 1) { const sl = varint(); v = str(p, p + sl); p += sl; }
          else if (f3 === 2) { v = new DataView(b.buffer, b.byteOffset + p, 4).getFloat32(0, true); p += 4; }
          else if (f3 === 3) { v = new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true); p += 8; }
          else if (f3 === 4 || f3 === 5) v = varint();
          else if (f3 === 6) v = zz(varint());
          else if (f3 === 7) v = !!varint();
          else skip(w3);
        }
        vals.push(v);
      }
      else if (f2 === 5 && w2 === 0) extent = varint();
      else if (f2 === 2 && w2 === 2) { const l = varint(); feats.push([p, p + l]); p += l; }
      else skip(w2);
    }
    p = end;
    if (name !== want) continue;
    const features = feats.map(([s, e]) => {
      p = s;
      let type = 0, tagIdx = [], geom = [];
      while (p < e) {
        const k4 = varint(), f4 = k4 >> 3, w4 = k4 & 7;
        if (f4 === 2 && w4 === 2) { const l = varint(); tagIdx = packed(p + l); }
        else if (f4 === 3) type = varint();
        else if (f4 === 4 && w4 === 2) { const l = varint(); geom = packed(p + l); }
        else skip(w4);
      }
      const tags = {};
      for (let i = 0; i < tagIdx.length; i += 2) tags[keys[tagIdx[i]]] = vals[tagIdx[i + 1]];
      // 그리기 명령: 1 MoveTo, 2 LineTo, 7 ClosePath (좌표는 앞 점에서의 차이, 지그재그 부호)
      const rings = []; let x = 0, y = 0, ring = null;
      for (let i = 0; i < geom.length;) {
        const c = geom[i++], id = c & 7, n = c >> 3;
        if (id === 7) { if (ring) rings.push(ring); ring = null; continue; }
        for (let j = 0; j < n; j++) {
          x += zz(geom[i++]); y += zz(geom[i++]);
          if (id === 1) { if (ring) rings.push(ring); ring = [[x, y]]; } else ring.push([x, y]);
        }
      }
      if (ring && type !== 3) rings.push(ring);
      return { type, tags, rings };
    });
    return { extent, features };
  }
  return { extent: 4096, features: [] };
}
