import { TRACK_SPACING, FPS, FRAME_STEP } from "./config.js";
import { view, sg, playbackMode, playOffset, timelineDensity, timelineCanvas } from "./state.js";
import { pointAtDistance } from "./spiral.js";
import { Text } from "pixi.js";

export function updatePlayheadGraphics() {
  if (!sg) return;
  const w = timelineCanvas.clientWidth;
  const h = timelineCanvas.clientHeight;
  const isPlayheadMode = playbackMode === "playhead";

  sg.spiralContainer.position.set(w / 2 + view.offsetX, h / 2 + view.offsetY);
  sg.spiralContainer.scale.set(view.scale, view.scale);

  sg.stripPlayhead.visible = !isPlayheadMode;
  if (!isPlayheadMode) {
    sg.stripPlayhead.position.set(w / 2 + view.offsetX, h / 2 + view.offsetY);
    sg.stripPlayhead.scale.set(view.scale, view.scale);
  }

  sg.playheadContainer.visible = isPlayheadMode;
  if (isPlayheadMode) {
    const { x, y, ang } = pointAtDistance(playOffset);
    sg.playheadContainer.position.set(x, y);
    sg.playheadContainer.rotation = ang;

    const lineLength = TRACK_SPACING * 0.9;
    sg.playheadGlow.clear();
    sg.playheadGlow
      .moveTo(0, -lineLength / 2)
      .lineTo(0, lineLength / 2)
      .stroke({ width: 10, color: 0xff3bff, alpha: 0.2 });

    sg.playheadLine.clear();
    sg.playheadLine
      .moveTo(0, -lineLength / 2)
      .lineTo(0, lineLength / 2)
      .stroke({ width: 3, color: 0xff3bff, alpha: 0.9 });

    sg.playheadTri.clear();
    sg.playheadTri
      .moveTo(-6, -lineLength / 2)
      .lineTo(6, -lineLength / 2)
      .lineTo(0, -lineLength / 2 - 8)
      .closePath()
      .fill(0xff3bff);

    const timeSec = playOffset / (FPS * FRAME_STEP * timelineDensity);
    const f = Math.floor((timeSec % 1) * FPS);
    const s = Math.floor(timeSec) % 60;
    const m = Math.floor(timeSec / 60);
    sg.playheadLabel.text = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
    sg.playheadLabel.position.set(0, lineLength / 2 + 4);
  }
}

export let zoomLineLabel = null;

export function updateZoomLineGraphics() {
  if (!sg) return;
  const g = sg.zoomLineGraphics;
  g.clear();
  if (!zoomLineActive) {
    if (zoomLineLabel) zoomLineLabel.visible = false;
    return;
  }

  const rect = timelineCanvas.getBoundingClientRect();
  const sx = zoomLineStart.x - rect.left;
  const sy = zoomLineStart.y - rect.top;
  const ex = zoomLineEnd.x - rect.left;
  const ey = zoomLineEnd.y - rect.top;

  g.moveTo(sx, sy)
    .lineTo(ex, ey)
    .stroke({ width: 2, color: 0xff3bff, alpha: 0.9 });

  g.circle(sx, sy, 5).fill({ color: 0xff3bff, alpha: 0.9 });
  g.circle(ex, ey, 5).fill(0xff3bff);

  const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
  if (!zoomLineLabel) {
    zoomLineLabel = new Text({
      text: "",
      style: { fontFamily: "monospace", fontSize: 11, fill: "#ff3bff" },
    });
    zoomLineLabel.anchor.set(0.5, 0.5);
    g.addChild(zoomLineLabel);
  }
  zoomLineLabel.visible = true;
  zoomLineLabel.text = `~${Math.round(view.scale * 100)}%`;
  zoomLineLabel.position.set(midX, midY - 8);
}

// Zoom line state (needed by both playhead.js and controls.js)
export let zoomLineActive = false;
export let zoomLineStart = { x: 0, y: 0 };
export let zoomLineEnd = { x: 0, y: 0 };
export let zoomLineBaseScale = 1;

export function setZoomLineActive(v) { zoomLineActive = v; }
export function setZoomLineStart(v) { zoomLineStart = v; }
export function setZoomLineEnd(v) { zoomLineEnd = v; }
export function setZoomLineBaseScale(v) { zoomLineBaseScale = v; }
