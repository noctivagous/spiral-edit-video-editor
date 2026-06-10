import { FPS, FRAME_STEP, DEBUG_SAMPLE_INTERVAL } from "./config.js";
import { app } from "./pixi-setup.js";
import {
  sg, view,
  isPlaying, playOffset, setPlayOffset, speed,
  playbackMode, playheadDirection,
  timelineDensity, playheadSpeedMultiplier,
  markersDirty, setMarkersDirty,
  lastPlayOffset, setLastPlayOffset,
  lastZoomScale, setLastZoomScale,
  _pendingThumbs, _thumbLoadThrottle,
  setThumbLoadThrottle, addThumbLoadThrottle,
  debugTracking, debugSamples, pushDebugSample, addDebugSampleTimer,
  timelineCanvas,
} from "./state.js";
import { pointAtDistance } from "./spiral.js";
import { rebuildMarkers } from "./scene-graph.js";
import { loadSpiralThumbnails } from "./thumbnails.js";
import { updatePlayheadGraphics, updateZoomLineGraphics } from "./playhead.js";
import { updateTimecodeWithScrub, getTotalFrames } from "./timeline-state.js";
import { updatePreview } from "./preview.js";

let lastFpsTime = 0;
let fpsCnt = 0;

export function tickerCallback(ticker) {
  if (!app || !sg) return;

  // --- Playback ---
  if (isPlaying && getTotalFrames() > 0) {
    const pps = FPS * FRAME_STEP * timelineDensity;
    const advance = speed * pps * (ticker.deltaMS / 1000) * playheadSpeedMultiplier;
    const totalFrames = getTotalFrames();
    const maxDist = Math.ceil(totalFrames * timelineDensity) * FRAME_STEP;

    if (playbackMode === "strip") {
      setPlayOffset(playOffset + advance);
      if (playOffset >= maxDist) setPlayOffset(0);
    } else {
      if (playheadDirection === "outward") {
        setPlayOffset(playOffset + advance);
        if (playOffset >= maxDist) setPlayOffset(0);
      } else {
        setPlayOffset(playOffset - advance);
        if (playOffset <= 0) setPlayOffset(maxDist);
      }
    }
    updateTimecodeWithScrub();
    updatePreview();
    if (debugTracking) {
      addDebugSampleTimer(ticker.deltaMS / 1000);
      if (debugSampleTimer >= DEBUG_SAMPLE_INTERVAL) {
        const timeSec = playOffset / (FPS * FRAME_STEP * timelineDensity);
        pushDebugSample({
          t: debugSamples.length * DEBUG_SAMPLE_INTERVAL,
          playOffset,
          timeSec,
          frame: Math.floor(timeSec * FPS),
        });
      }
    }
  }

  // --- Strip mode: reposition items ---
  if (playbackMode === "strip" && sg.itemsContainer.children.length > 0) {
    const children = sg.itemsContainer.children;
    for (let i = 0; i < children.length; i++) {
      const wrapper = children[i];
      const dist = wrapper.__frameIndex * FRAME_STEP + FRAME_W / 2 - playOffset;
      const pos = pointAtDistance(dist);
      wrapper.position.set(pos.x, pos.y);
      wrapper.rotation = pos.ang;
    }
  }

  // --- Markers ---
  if (markersDirty || (playbackMode === "strip" && Math.abs(playOffset - lastPlayOffset) > 10)) {
    setMarkersDirty(true);
  }
  if (markersDirty) {
    rebuildMarkers();
  }

  // --- Throttled thumbnail reload ---
  const zoomChanged = Math.abs(lastZoomScale - view.scale) > 0.01;
  if (_pendingThumbs.length > 0 && (zoomChanged || Math.abs(playOffset - lastPlayOffset) > 20)) {
    addThumbLoadThrottle(ticker.deltaMS);
    if (_thumbLoadThrottle > 150) {
      setThumbLoadThrottle(0);
      loadSpiralThumbnails(_pendingThumbs);
    }
  }
  setLastPlayOffset(playOffset);
  setLastZoomScale(view.scale);

  // --- Playhead ---
  updatePlayheadGraphics();

  // --- Zoom line ---
  updateZoomLineGraphics();

  // --- FPS counter ---
  fpsCnt++;
  const now = performance.now();
  if (now - lastFpsTime > 1000) {
    document.getElementById("hudFps").textContent =
      Math.round((fpsCnt * 1000) / (now - lastFpsTime)) + " FPS";
    fpsCnt = 0;
    lastFpsTime = now;
  }

  // --- Render ---
  try {
    app.renderer.render(app.stage);
  } catch (e) {
    console.error("Render error:", e);
  }
}
