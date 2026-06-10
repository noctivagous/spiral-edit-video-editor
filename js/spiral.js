import { TRACK_SPACING, dirs } from "./config.js";

let spiral = buildSpiral(200000);
export { spiral };

export let totalSpiralLen = spiral[spiral.length - 1].cum;
export function setTotalSpiralLen(v) { totalSpiralLen = v; }

export function buildSpiral(maxDist) {
  const segs = [];
  let x = 0, y = 0, dir = 0, segLen = TRACK_SPACING;
  let total = 0;
  segs.push({ x1: 0, y1: 0, x2: 0, y2: 0, len: 0, cum: 0 });
  let i = 0;
  while (total < maxDist + 5000) {
    const dx = dirs[dir][0] * segLen;
    const dy = dirs[dir][1] * segLen;
    const x2 = x + dx;
    const y2 = y + dy;
    total += segLen;
    segs.push({ x1: x, y1: y, x2: x2, y2: y2, len: segLen, cum: total });
    x = x2;
    y = y2;
    dir = (dir + 1) % 4;
    if (i % 2 === 1) segLen += TRACK_SPACING;
    i++;
    if (i > 800) break;
  }
  return segs;
}

export function pointAtDistance(d) {
  if (d <= 0) return { x: 0, y: 0, ang: 0 };
  let lo = 0, hi = spiral.length - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (spiral[mid].cum < d) lo = mid + 1;
    else hi = mid;
  }
  const seg = spiral[lo];
  const prevCum = spiral[lo - 1]?.cum || 0;
  const t = Math.max(0, Math.min(1, (d - prevCum) / seg.len));
  const x = seg.x1 + (seg.x2 - seg.x1) * t;
  const y = seg.y1 + (seg.y2 - seg.y1) * t;
  const ang = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
  return { x, y, ang };
}
