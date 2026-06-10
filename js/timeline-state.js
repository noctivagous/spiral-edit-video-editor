import { FPS, FRAME_STEP } from "./config.js";
import {
  clips, timelineMode, setTimelineMode,
  timelineFrames, timelineClips, clipSequence,
  playOffset, timelineDensity,
  markersDirty, setMarkersDirty,
  setPlayOffset,
} from "./state.js";
import { totalSpiralLen, setTotalSpiralLen, buildSpiral, spiral } from "./spiral.js";

export function getCurrentTime() {
  return playOffset / (FPS * FRAME_STEP * timelineDensity);
}

export function getTotalTime() {
  return timelineMode === "frames"
    ? timelineFrames.length / FPS
    : timelineClips.reduce((sum, c) => sum + (c.trimOut - c.trimIn + 1) / FPS, 0);
}

export function getTotalFrames() {
  return timelineMode === "frames"
    ? timelineFrames.length
    : timelineClips.reduce((sum, c) => sum + (c.trimOut - c.trimIn + 1), 0);
}

export function rebuildFrameArray() {
  timelineFrames.length = 0;
  clipSequence.forEach((entry) => {
    const clip = clips[entry.clipId];
    for (let i = entry.trimIn; i <= entry.trimOut; i++) {
      timelineFrames.push({
        clipId: clip.id,
        frameIdx: i,
        thumb: null,
        clipName: clip.name,
      });
    }
  });
}

export function rebuildClipArray() {
  timelineClips.length = 0;
  let cursorFrame = 0;
  clipSequence.forEach((entry) => {
    const clip = clips[entry.clipId];
    timelineClips.push({
      clipId: clip.id,
      startFrame: cursorFrame,
      duration: entry.trimOut - entry.trimIn + 1,
      trimIn: entry.trimIn,
      trimOut: entry.trimOut,
      clipName: clip.name,
    });
    cursorFrame += entry.trimOut - entry.trimIn + 1;
  });
}

export function updateSpiralLength() {
  const needed = Math.ceil(getTotalFrames() * timelineDensity) * FRAME_STEP + 2000;
  const currentLen = spiral[spiral.length - 1].cum;
  if (needed > currentLen) {
    const newSpiral = buildSpiral(needed);
    spiral.splice(0, spiral.length, ...newSpiral);
    setTotalSpiralLen(newSpiral[newSpiral.length - 1].cum);
  }
}

export function updateScrubRange() {
  const scrubSlider = document.getElementById("scrubSlider");
  const totalFrames = getTotalFrames();
  scrubSlider.max = Math.max(0, totalFrames - 1);
  scrubSlider.value = Math.min(parseInt(scrubSlider.value) || 0, Math.max(0, totalFrames - 1));
}

export function updateHudFrames() {
  document.getElementById("hudFrames").textContent =
    timelineMode === "frames"
      ? `${timelineFrames.length} frames`
      : `${timelineClips.length} clips`;
}

export function addClipToTimeline(clipId) {
  const clip = clips[clipId];
  clipSequence.push({ clipId, trimIn: 0, trimOut: clip.duration - 1 });
  rebuildFrameArray();
  document.getElementById("hudFrames").textContent = `${timelineFrames.length} frames`;
  updateTimecodeWithScrub();
  updateScrubRange();
  updateSpiralLength();
}

export function formatTC(frames) {
  const sec = Math.floor(frames / FPS);
  const f = frames % FPS;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
}

export function formatTime(seconds) {
  const sec = Math.floor(seconds);
  const f = Math.floor((seconds - sec) * FPS);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
}

export function updateTimecode() {
  if (timelineMode === "frames") {
    const visSlot = Math.max(0, Math.floor(playOffset / FRAME_STEP));
    const cur = Math.min(timelineFrames.length - 1, Math.floor(visSlot / timelineDensity));
    document.getElementById("timecode").textContent = `${formatTC(cur)} / ${formatTC(timelineFrames.length)}`;
  } else {
    const curTime = getCurrentTime();
    const totalTime = getTotalTime();
    document.getElementById("timecode").textContent = `${formatTime(curTime)} / ${formatTime(totalTime)}`;
  }
}

export function updateTimecodeWithScrub() {
  updateTimecode();
  const visSlot = Math.max(0, Math.floor(playOffset / FRAME_STEP));
  const originalFrame = Math.min(getTotalFrames() - 1, Math.floor(visSlot / timelineDensity));
  const scrubSlider = document.getElementById("scrubSlider");
  scrubSlider.value = Math.min(originalFrame, scrubSlider.max);
}
