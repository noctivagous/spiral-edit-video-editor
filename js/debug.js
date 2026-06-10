import { FRAME_W, FRAME_STEP, DEBUG_SAMPLE_INTERVAL } from "./config.js";
import { spiral, totalSpiralLen, pointAtDistance } from "./spiral.js";
import { sg, debugSamples, debugTracking, setDebugTracking, clips, view } from "./state.js";
import { Graphics, Text } from "pixi.js";
import { rebuildScene } from "./scene-graph.js";

window.debugSpiral = {
  trackStart: () => { setDebugTracking(true); },
  trackStop: () => { setDebugTracking(false); },
  trackToggle: () => { setDebugTracking(!debugTracking); },
  getSamples: () => debugSamples,
  clearSamples: () => { debugSamples.length = 0; },
  summary: () => {
    if (debugSamples.length === 0) return "no samples";
    const first = debugSamples[0], last = debugSamples[debugSamples.length - 1];
    return {
      count: debugSamples.length,
      interval: DEBUG_SAMPLE_INTERVAL,
      duration: last.t,
      first, last,
      playOffsetRange: [first.playOffset, last.playOffset],
      timeSecRange: [first.timeSec, last.timeSec],
      frameRange: [first.frame, last.frame],
    };
  },

  segmentCount: spiral.length - 1,
  spiralLength: totalSpiralLen,
  getSegments: (startIdx, endIdx) => {
    const s = startIdx || 0, e = endIdx || spiral.length - 1;
    return spiral.slice(s, e + 1).map((seg, i) => ({
      idx: s + i, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2,
      len: seg.len, cum: seg.cum,
      rect: { x: Math.min(seg.x1, seg.x2), y: Math.min(seg.y1, seg.y2), w: Math.abs(seg.x2 - seg.x1) || 1, h: Math.abs(seg.y2 - seg.y1) || 1 },
    }));
  },
  segmentAtDistance: (d) => {
    if (d <= 0) return spiral[0];
    let lo = 0, hi = spiral.length - 1;
    while (lo < hi) { const mid = lo + hi >> 1; if (spiral[mid].cum < d) lo = mid + 1; else hi = mid; }
    return spiral[lo];
  },
  segmentAtFrame: (frameIdx) => {
    const dist = frameIdx * FRAME_STEP;
    return window.debugSpiral.segmentAtDistance(dist);
  },
  totalBounds: () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 1; i < spiral.length; i++) {
      const s = spiral[i];
      minX = Math.min(minX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2);
      maxX = Math.max(maxX, s.x1, s.x2); maxY = Math.max(maxY, s.y1, s.y2);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  },
  frameBounds: (frameIdx) => {
    const dist = frameIdx * FRAME_STEP + FRAME_W / 2;
    const pos = pointAtDistance(dist);
    return {
      center: { x: pos.x, y: pos.y }, ang: pos.ang,
      leftEdge: dist - FRAME_W / 2, rightEdge: dist + FRAME_W / 2,
    };
  },
  frameSegments: (frameIdx) => {
    const leftDist = frameIdx * FRAME_STEP;
    const rightDist = frameIdx * FRAME_STEP + FRAME_W;
    const leftSeg = window.debugSpiral.segmentAtDistance(Math.max(0, leftDist));
    const rightSeg = window.debugSpiral.segmentAtDistance(Math.max(0, rightDist));
    const leftSegIdx = spiral.indexOf(leftSeg);
    const rightSegIdx = spiral.indexOf(rightSeg);
    return window.debugSpiral.getSegments(Math.min(leftSegIdx, rightSegIdx), Math.max(leftSegIdx, rightSegIdx));
  },
  drawSegments: (count) => {
    const n = count || 20;
    const g = new Graphics();
    const overlay = sg.spiralContainer.addChild(g);
    for (let i = 1; i <= Math.min(n, spiral.length - 1); i++) {
      const s = spiral[i];
      const segBounds = { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x2 - s.x1) || 1, h: Math.abs(s.y2 - s.y1) || 1 };
      g.rect(segBounds.x, segBounds.y, segBounds.w, segBounds.h).stroke({ width: 1, color: 0xff3bff, alpha: 0.5 });
      g.circle(s.x1, y1, 3).fill(0x00ff00);
      if (i === 1 || i % 10 === 0) {
        const midX = (s.x1 + s.x2) / 2, midY = (s.y1 + s.y2) / 2;
        const label = new Text({ text: String(i), style: { fontFamily: "monospace", fontSize: 9, fill: "#ff3bff" } });
        label.position.set(midX, midY);
        sg.spiralContainer.addChild(label);
      }
    }
    return { drawn: n, id: "segOverlay" };
  },
  clearOverlay: () => {
    const toRemove = [];
    sg.spiralContainer.children.forEach((c) => {
      if (c === sg.pathGraphics || c === sg.itemsContainer || c === sg.markersContainer || c === sg.playheadContainer || c.destroyed) return;
      toRemove.push(c);
    });
    toRemove.forEach((c) => { sg.spiralContainer.removeChild(c); c.destroy({ children: true }); });
    return toRemove.length;
  },
  getSceneGraph: () => sg ? { containerCount: sg.itemsContainer.children.length } : null,
  rebuild: rebuildScene,
  getScene: () => sg ? {
    spiralContainer: { position: { x: sg.spiralContainer.position.x, y: sg.spiralContainer.position.y }, scale: { x: sg.spiralContainer.scale.x, y: sg.spiralContainer.scale.y }, visible: sg.spiralContainer.visible, children: sg.spiralContainer.children.length },
    itemsContainer: { position: { x: sg.itemsContainer.position.x, y: sg.itemsContainer.position.y }, scale: { x: sg.itemsContainer.scale.x, y: sg.itemsContainer.scale.y }, children: sg.itemsContainer.children.length },
    pathGraphics: { geometry: sg.pathGraphics.geometry?.graphicsData?.length, visible: sg.pathGraphics.visible },
  } : null,
  getFrames: () => sg ? sg.itemsContainer.children.slice(0, 5).map((f) => ({
    position: { x: f.position.x, y: f.position.y }, rotation: f.rotation, children: f.children?.length,
  })) : null,
  getFrameDetails: () => sg ? {
    frame0: {
      position: { x: sg.itemsContainer.children[0]?.position?.x, y: sg.itemsContainer.children[0]?.position?.y },
      rotation: sg.itemsContainer.children[0]?.rotation, visible: sg.itemsContainer.children[0]?.visible,
      alpha: sg.itemsContainer.children[0]?.alpha,
      children: sg.itemsContainer.children[0]?.children?.map((c) => ({
        type: c.constructor.name, visible: c.visible, alpha: c.alpha, geometry: c.geometry?.graphicsData?.length,
      })),
    },
  } : null,
  checkFrames: (clipIdx) => {
    const c = clips && clips[clipIdx];
    if (!c || !c.thumbs || c.thumbs.length < 2) return { error: "no data", len: c?.thumbs?.length };
    const t0 = c.thumbs[0], t1 = c.thumbs[c.thumbs.length - 1], tMid = c.thumbs[Math.floor(c.thumbs.length / 2)];
    const ctx0 = t0.getContext("2d"), ctx1 = t1.getContext("2d"), ctxMid = tMid.getContext("2d");
    let totalSame = 0, total = 250;
    for (let i = 0; i < total; i++) {
      const px0 = ctx0.getImageData((i * 4) % 160, Math.floor(i / 40), 1, 1).data;
      const px1 = ctx1.getImageData((i * 4) % 160, Math.floor(i / 40), 1, 1).data;
      if (px0[0] === px1[0] && px0[1] === px1[1] && px0[2] === px1[2]) totalSame++;
    }
    return { clipName: c.name, numThumbs: c.thumbs.length, samePx: totalSame, totalPx: total };
  },
  wrapperChildCount: (idx) => sg ? sg.itemsContainer.children[idx]?.children?.length : null,
};
