import { FRAME_W, FRAME_H, FRAME_STEP, FPS, TRACK_SPACING } from "./config.js";
import {
  view, sg, setSg, timelineMode, playbackMode, clips,
  timelineFrames, timelineClips, playOffset, timelineDensity,
  markersDirty, setMarkersDirty,
  timelineCanvas,
  _pendingThumbs, setPendingThumbs,
} from "./state.js";
import { spiral, pointAtDistance } from "./spiral.js";
import { loadSpiralThumbnails } from "./thumbnails.js";
import { Graphics, Text, Container, Sprite } from "pixi.js";
import { getTotalFrames } from "./timeline-state.js";

export const markerTextPool = [];

export function rebuildScene() {
  if (!sg) return;
  rebuildSpiralPath();
  rebuildItems();
  rebuildMarkers();
}

export function rebuildSpiralPath() {
  if (!sg) return;
  const g = sg.pathGraphics;
  g.clear();
  g.moveTo(0, 0);
  for (let i = 1; i < spiral.length; i++) {
    const s = spiral[i];
    if (i === 1) g.moveTo(s.x1, s.y1);
    else g.lineTo(s.x1, s.y1);
    g.lineTo(s.x2, s.y2);
  }
  g.stroke({ width: 2, color: 0x00f5ff, alpha: 0.25 });
}

export function getThumbInterval() {
  const s = view.scale;
  if (s < 0.5) return 9999;
  if (s < 1.2) return FPS;
  if (s < 2.0) return 10;
  return 1;
}

export function rebuildItems() {
  if (!sg) return;
  const container = sg.itemsContainer;
  container.removeChildren();

  const displayOffset = playbackMode === "playhead" ? 0 : playOffset;

  if (timelineMode === "frames") {
    const pendingThumbs = [];
    const totalVisualSlots = Math.ceil(timelineFrames.length * timelineDensity);
    for (let v = 0; v < totalVisualSlots; v++) {
      const originalIdx = Math.min(timelineFrames.length - 1, Math.floor(v / timelineDensity));
      const frame = timelineFrames[originalIdx];
      if (!frame) continue;
      const clip = clips[frame.clipId];
      const clipColor = clip ? parseInt(clip.c1.replace("#", ""), 16) : null;
      const dist = v * FRAME_STEP + FRAME_W / 2 - displayOffset;
      const pos = pointAtDistance(dist);
      addFrameSprite(container, null, frame.clipName, originalIdx, clip, pos, 1, false, clipColor, false, v);
      pendingThumbs.push({
        wrapper: container.children[container.children.length - 1],
        clip,
        frameIdx: frame.frameIdx,
        visualSlot: v,
      });
    }
    setPendingThumbs(pendingThumbs);
    loadSpiralThumbnails(pendingThumbs);
  } else {
    const thumbInterval = getThumbInterval();
    timelineClips.forEach((clip) => {
      const clipData = clips[clip.clipId];
      const c1 = parseInt(clipData.c1.replace("#", ""), 16);
      const clipFrameCount = clip.trimOut - clip.trimIn + 1;
      const bgInterval = Math.max(1, Math.round(clipFrameCount / 10));

      for (let f = clip.trimIn; f <= clip.trimOut; f++) {
        const frameIndex = clip.startFrame + (f - clip.trimIn);
        const dist = frameIndex * FRAME_STEP + FRAME_W / 2 - displayOffset;
        const pos = pointAtDistance(dist);
        const thumb = clipData.thumbs[f];
        const shouldDrawThumb = (f - clip.trimIn) % thumbInterval === 0;
        const drawBg = f === clip.trimIn || (f - clip.trimIn) % bgInterval === 0;

        addFrameSprite(container, thumb, clip.clipName, frameIndex, clip, pos, timelineDensity,
          shouldDrawThumb, drawBg ? c1 : null, f === clip.trimIn);
      }
    });
  }
}

export function addFrameSprite(container, thumb, clipName, index, clip, pos, widthScale,
  drawThumb, clipColor, isFirstFrame, visIndex) {
  const w = FRAME_W * widthScale;
  const wrapper = new Container();
  wrapper.position.set(pos.x, pos.y);
  wrapper.rotation = pos.ang;
  wrapper.__frameIndex = visIndex != null ? visIndex : index;

  if (clipColor) {
    const bg = new Graphics();
    bg.rect(-w / 2 - 2, -FRAME_H / 2 - 2, w + 4, FRAME_H + 4)
      .fill({ color: clipColor, alpha: 0.3 });
    wrapper.addChild(bg);
  }

  const bg = new Graphics();
  bg.rect(-w / 2 - 3, -FRAME_H / 2 - 3, w + 6, FRAME_H + 6)
    .fill({ color: 0xffffff, alpha: 0.06 });
  wrapper.addChild(bg);

  if (thumb && drawThumb !== false) {
    const sprite = Sprite.from(thumb);
    sprite.anchor.set(0.5);
    sprite.width = w;
    sprite.height = FRAME_H;
    wrapper.addChild(sprite);

    const gloss = new Graphics();
    gloss.rect(-w / 2, -FRAME_H / 2, w, FRAME_H).fill({ color: 0xffffff, alpha: 0.08 });
    wrapper.addChild(gloss);
  }

  const label = new Text({
    text: String(index).padStart(4, "0"),
    style: { fontFamily: "monospace", fontSize: 10, fill: "#00f5ff" },
  });
  label.position.set(-w / 2 + 4, FRAME_H / 2 - 14);
  wrapper.addChild(label);

  if (clip && isFirstFrame) {
    const nameLabel = new Text({
      text: clipName.substring(0, 10),
      style: { fontFamily: "monospace", fontSize: 10, fill: "#00f5ff" },
    });
    nameLabel.position.set(-w / 2 + 4, -FRAME_H / 2 - 14);
    wrapper.addChild(nameLabel);
  }

  container.addChild(wrapper);
}

export function getTimeMarkerInterval() {
  const s = view.scale;
  if (s < 0.5) return FPS * 5;
  if (s < 1.0) return FPS;
  if (s < 1.5) return FPS / 2;
  if (s < 2.0) return FPS / 5;
  return 1;
}

export function formatTimeLabel(frames) {
  const sec = Math.floor(frames / FPS);
  const f = frames % FPS;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0)
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
  return `${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
}

export function rebuildMarkers() {
  if (!sg) return;
  setMarkersDirty(false);

  const container = sg.markersContainer;
  while (container.children.length > 0) {
    const child = container.children[0];
    if (child === sg.markerGraphics) {
      container.removeChild(child);
    } else {
      child.visible = false;
      container.removeChild(child);
      markerTextPool.push(child);
    }
  }

  const totalFrames = getTotalFrames();
  const totalDist = totalFrames * FRAME_STEP;
  const isPlayheadMode = playbackMode === "playhead";

  const w = timelineCanvas.clientWidth;
  const h = timelineCanvas.clientHeight;
  const halfW = w / 2 / view.scale;
  const halfH = h / 2 / view.scale;
  const halfDiagonal = Math.sqrt(halfW * halfW + halfH * halfH);
  const margin = 3000;
  const coverage = halfDiagonal + margin;

  const startDist = isPlayheadMode ? Math.max(0, -coverage) : playOffset - coverage;
  const endDist = isPlayheadMode ? totalDist + coverage : playOffset + coverage;

  const markerIntervalFrames = getTimeMarkerInterval();
  const step = FRAME_STEP;
  const startFrame = Math.ceil(startDist / step / markerIntervalFrames) * markerIntervalFrames;
  const endFrame = Math.min(totalFrames, Math.floor(endDist / step / markerIntervalFrames) * markerIntervalFrames);

  if (!sg.markerGraphics || sg.markerGraphics.destroyed) {
    sg.markerGraphics = new Graphics();
  } else {
    sg.markerGraphics.clear();
  }
  container.addChildAt(sg.markerGraphics, 0);

  let poolIdx = 0;

  for (let frame = startFrame; frame <= endFrame; frame += markerIntervalFrames) {
    const dist = frame * step;
    const displayDist = isPlayheadMode ? dist : dist - playOffset;
    if (isPlayheadMode && displayDist < -500) continue;
    if (!isPlayheadMode && (displayDist < -coverage || displayDist > coverage)) continue;

    const { x, y, ang } = pointAtDistance(displayDist);

    const screenX = w / 2 + view.offsetX + x * view.scale;
    const screenY = h / 2 + view.offsetY + y * view.scale;
    if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;

    const tickLength = 15 / view.scale;
    const perpAng = ang + Math.PI / 2;
    const tx1 = x + Math.cos(perpAng) * tickLength;
    const ty1 = y + Math.sin(perpAng) * tickLength;
    const tx2 = x - Math.cos(perpAng) * tickLength;

    sg.markerGraphics
      .moveTo(tx1, ty1)
      .lineTo(tx2, y)
      .stroke({ width: 1.5 / view.scale, color: 0x00f5ff, alpha: 0.4 });

    const labelX = tx1 + (Math.cos(perpAng) * 4) / view.scale;
    const labelY = ty1 + (Math.sin(perpAng) * 4) / view.scale;
    const fontSize = Math.max(8, 10 / view.scale);

    let label;
    if (poolIdx < markerTextPool.length) {
      label = markerTextPool[poolIdx];
      label.visible = true;
      label.text = formatTimeLabel(frame);
      label.style.fontSize = fontSize;
    } else {
      label = new Text({
        text: formatTimeLabel(frame),
        style: { fontFamily: "monospace", fontSize, fill: "#00f5ff" },
      });
    }
    label.position.set(labelX, labelY);
    label.anchor.set(0, 0.5);
    container.addChild(label);
    poolIdx++;
  }
}
