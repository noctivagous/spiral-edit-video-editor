import { FPS, FRAME_STEP } from "./config.js";
import {
  view, isPlaying, setIsPlaying,
  playOffset, setPlayOffset, speed, setSpeed,
  timelineCanvas, markersDirty, setMarkersDirty,
  timelineDensity, setTimelineDensity,
  playheadSpeedMultiplier, setPlayheadSpeedMultiplier,
  playbackMode, setPlaybackMode,
  playheadDirection, setPlayheadDirection,
  timelineMode, setTimelineMode,
  debugTracking, setDebugTracking, resetDebugSamples,
} from "./state.js";
import { rebuildScene } from "./scene-graph.js";
import {
  updateTimecodeWithScrub, updateHudFrames,
  updateSpiralLength, getCurrentTime, updateScrubRange,
  rebuildFrameArray, rebuildClipArray,
} from "./timeline-state.js";
import { updatePreview } from "./preview.js";
import {
  zoomLineActive, setZoomLineActive,
  zoomLineStart, setZoomLineStart,
  zoomLineEnd, setZoomLineEnd,
  zoomLineBaseScale, setZoomLineBaseScale,
} from "./playhead.js";

// --- Keyboard ---
let zPressed = false;
let lastMouseX = 0, lastMouseY = 0;

window.addEventListener("keydown", (e) => {
  if (e.key === "z" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (!zPressed) {
      zPressed = true;
      setZoomLineActive(true);
      setZoomLineBaseScale(view.scale);
      setZoomLineStart({ x: lastMouseX, y: lastMouseY });
      setZoomLineEnd({ ...zoomLineStart });
      document.getElementById("zoomLineIndicator").classList.add("active");
    } else {
      zPressed = false;
      setZoomLineActive(false);
      document.getElementById("zoomLineIndicator").classList.remove("active");
    }
  }
});

window.addEventListener("mousemove", (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  if (zoomLineActive) {
    applyZoomFromLine(e.clientX, e.clientY);
    return;
  }
  if (!view.dragging) return;
  view.offsetX += e.clientX - view.lastX;
  view.offsetY += e.clientY - view.lastY;
  view.lastX = e.clientX;
  view.lastY = e.clientY;
});

timelineCanvas.addEventListener("mousedown", (e) => {
  if (zoomLineActive) return;
  view.dragging = true;
  view.lastX = e.clientX;
  view.lastY = e.clientY;
  timelineCanvas.classList.add("grabbing");
});

window.addEventListener("mouseup", () => {
  view.dragging = false;
  timelineCanvas.classList.remove("grabbing");
});

timelineCanvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.08 : 0.92;
    const rect = timelineCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    view.offsetX = mx - (mx - view.offsetX) * factor;
    view.offsetY = my - (my - view.offsetY) * factor;
    view.scale = Math.max(0.3, Math.min(2.5, view.scale * factor));
    zoomSlider.value = view.scale;
    document.getElementById("hudZoom").textContent = Math.round(view.scale * 100) + "%";
    setMarkersDirty(true);
  },
  { passive: false },
);

timelineCanvas.addEventListener("dragover", (e) => e.preventDefault());
timelineCanvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
  if (!isNaN(id)) addClipToTimeline(id);
});

function applyZoomFromLine(x, y) {
  if (!zoomLineActive) return;
  setZoomLineEnd({ x, y });
  const dx = zoomLineEnd.x - zoomLineStart.x;
  const dy = zoomLineEnd.y - zoomLineStart.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const sign = dx >= 0 ? 1 : -1;
  const rect = timelineCanvas.getBoundingClientRect();
  const baseline = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
  const ratio = distance / baseline;
  const newScale = Math.max(0.3, Math.min(2.5, zoomLineBaseScale + sign * ratio * 2.2));
  const refX = zoomLineStart.x - rect.left;
  const refY = zoomLineStart.y - rect.top;
  const mx = refX - rect.width / 2;
  const my = refY - rect.height / 2;
  const factor = newScale / view.scale;
  view.offsetX = mx - (mx - view.offsetX) * factor;
  view.offsetY = my - (my - view.offsetY) * factor;
  view.scale = newScale;
  zoomSlider.value = view.scale;
  document.getElementById("hudZoom").textContent = Math.round(view.scale * 100) + "%";
  setMarkersDirty(true);
}

// --- DOM refs ---
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const speedSel = document.getElementById("speedSel");
const zoomSlider = document.getElementById("zoomSlider");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetBtn = document.getElementById("resetBtn");
const scrubSlider = document.getElementById("scrubSlider");

function setTimelineModeWrapper(mode) {
  if (mode === timelineMode) return;
  const currentTime = getCurrentTime();
  setTimelineMode(mode);
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  if (mode === "frames") rebuildFrameArray();
  else rebuildClipArray();
  setPlayOffset(currentTime * FPS * FRAME_STEP * timelineDensity);
  updateSpiralLength();
  updateScrubRange();
  updateTimecodeWithScrub();
  updatePreview();
  updateHudFrames();
  rebuildScene();
}

function setPlaybackModeWrapper(mode) {
  if (mode === playbackMode) return;
  setPlaybackMode(mode);
  document.querySelectorAll("[data-playback]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.playback === mode);
  });
  const dirGroup = document.getElementById("playheadDirGroup");
  if (dirGroup) dirGroup.style.display = mode === "playhead" ? "flex" : "none";
  rebuildScene();
  setMarkersDirty(true);
}

function setPlayheadDirectionWrapper(dir) {
  if (dir === playheadDirection) return;
  setPlayheadDirection(dir);
  document.querySelectorAll("[data-direction]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.direction === dir);
  });
}

// --- Button bindings ---
playBtn.addEventListener("click", () => {
  const v = !isPlaying;
  setIsPlaying(v);
  playBtn.textContent = v ? "\u23F8" : "\u25B6";
  if (v) { resetDebugSamples(); setDebugTracking(true); }
  else setDebugTracking(false);
});

stopBtn.addEventListener("click", () => {
  setIsPlaying(false);
  setDebugTracking(false);
  playBtn.textContent = "\u25B6";
  setPlayOffset(0);
  updateTimecodeWithScrub();
  updatePreview();
  setMarkersDirty(true);
});

speedSel.addEventListener("change", () => setSpeed(parseFloat(speedSel.value)));

zoomSlider.addEventListener("input", () => {
  view.scale = parseFloat(zoomSlider.value);
  document.getElementById("hudZoom").textContent = Math.round(view.scale * 100) + "%";
  setMarkersDirty(true);
});

zoomInBtn.addEventListener("click", () => {
  view.scale = Math.min(2.5, view.scale * 1.2);
  zoomSlider.value = view.scale;
  setMarkersDirty(true);
});

zoomOutBtn.addEventListener("click", () => {
  view.scale = Math.max(0.3, view.scale / 1.2);
  zoomSlider.value = view.scale;
  setMarkersDirty(true);
});

resetBtn.addEventListener("click", () => {
  view.offsetX = 0;
  view.offsetY = 0;
  view.scale = 1;
  zoomSlider.value = 1;
  document.getElementById("hudZoom").textContent = "100%";
  setMarkersDirty(true);
});

scrubSlider.addEventListener("input", () => {
  const val = parseInt(scrubSlider.value, 10);
  setPlayOffset(Math.floor(val * timelineDensity) * FRAME_STEP);
  updateTimecodeWithScrub();
  updatePreview();
  setMarkersDirty(true);
});

// --- Mode toggle buttons ---
document.querySelectorAll(".mode-btn").forEach((btn) => {
  if (btn.dataset.mode) {
    btn.addEventListener("click", () => setTimelineModeWrapper(btn.dataset.mode));
  } else if (btn.dataset.playback) {
    btn.addEventListener("click", () => setPlaybackModeWrapper(btn.dataset.playback));
  } else if (btn.dataset.direction) {
    btn.addEventListener("click", () => setPlayheadDirectionWrapper(btn.dataset.direction));
  }
});

// --- Density slider ---
const densitySlider = document.getElementById("densitySlider");
const densityValue = document.getElementById("densityValue");
densitySlider.addEventListener("input", () => {
  setTimelineDensity(parseFloat(densitySlider.value));
  densityValue.textContent = timelineDensity.toFixed(2) + "\u00D7";
  updateSpiralLength();
  rebuildScene();
  updateTimecodeWithScrub();
  setMarkersDirty(true);
});

// --- Speed multiplier slider ---
const speedMultSlider = document.getElementById("speedMultSlider");
const speedMultValue = document.getElementById("speedMultValue");
speedMultSlider.addEventListener("input", () => {
  setPlayheadSpeedMultiplier(parseFloat(speedMultSlider.value));
  speedMultValue.textContent = playheadSpeedMultiplier.toFixed(2) + "\u00D7";
});
