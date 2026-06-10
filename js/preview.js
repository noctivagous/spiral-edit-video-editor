import { FPS, FRAME_STEP } from "./config.js";
import {
  timelineMode, clips, timelineFrames, timelineClips,
  playOffset, timelineDensity, pctx, previewCanvas,
} from "./state.js";
import { getFrameThumb } from "./mediabunny.js";
import { getTotalFrames } from "./timeline-state.js";

let _pendingPreview = null;

export function updatePreview() {
  const pw = previewCanvas.clientWidth, ph = previewCanvas.clientHeight;
  pctx.clearRect(0, 0, pw, ph);
  let clipId, localFrame, clipName;

  if (timelineMode === "frames") {
    const visSlot = Math.max(0, Math.floor(playOffset / FRAME_STEP));
    const idx = Math.min(timelineFrames.length - 1, Math.floor(visSlot / timelineDensity));
    const entry = timelineFrames[idx];
    if (entry) {
      clipId = entry.clipId;
      localFrame = entry.frameIdx;
      clipName = entry.clipName;
    }
  } else {
    const visSlot = Math.max(0, Math.floor(playOffset / FRAME_STEP));
    const idx = Math.min(getTotalFrames() - 1, Math.floor(visSlot / timelineDensity));
    let accum = 0;
    for (const c of timelineClips) {
      const clipFrames = c.trimOut - c.trimIn + 1;
      if (idx < accum + clipFrames) {
        clipId = c.clipId;
        localFrame = c.trimIn + (idx - accum);
        clipName = c.clipName;
        break;
      }
      accum += clipFrames;
    }
  }

  if (clipId != null && clips[clipId]) {
    if (_pendingPreview) _pendingPreview.cancel = true;
    const token = { cancel: false };
    _pendingPreview = token;
    getFrameThumb(clips[clipId], localFrame, pw, ph).then((thumb) => {
      if (token.cancel) return;
      const tw = thumb.width, th = thumb.height;
      const scale = Math.min(pw / tw, ph / th);
      const dw = tw * scale, dh = th * scale;
      const dx = (pw - dw) / 2, dy = (ph - dh) / 2;
      pctx.clearRect(0, 0, pw, ph);
      pctx.shadowColor = "rgba(0,245,255,.5)";
      pctx.shadowBlur = 30;
      pctx.drawImage(thumb, dx, dy, dw, dh);
      pctx.shadowBlur = 0;
    });
    document.getElementById("metaClip").textContent = clipName || "\u2014";
    document.getElementById("metaFrame").textContent = `${(localFrame || 0) + 1}`;
  } else {
    pctx.fillStyle = "#111";
    pctx.fillRect(0, 0, pw, ph);
    document.getElementById("metaClip").textContent = "\u2014";
    document.getElementById("metaFrame").textContent = "0";
  }
}
