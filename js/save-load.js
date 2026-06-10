import { clips, setClips, clipSequence,
  timelineMode, setTimelineMode,
  playbackMode, setPlaybackMode,
  playheadDirection, setPlayheadDirection,
  timelineDensity, setTimelineDensity,
  playheadSpeedMultiplier, setPlayheadSpeedMultiplier,
  playOffset, setPlayOffset,
} from "./state.js";
import {
  rebuildFrameArray, rebuildClipArray, updateScrubRange,
  updateTimecodeWithScrub, updateSpiralLength,
  updateHudFrames,
} from "./timeline-state.js";
import { rebuildScene } from "./scene-graph.js";
import { updatePreview } from "./preview.js";
import { buildClipListEntry } from "./clip-loader.js";

async function dataURLToCanvas(url) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

export async function saveProject() {
  try {
    const data = {
      version: 1,
      timeline: {
        mode: timelineMode,
        playbackMode,
        playheadDirection,
        density: timelineDensity,
        speedMultiplier: playheadSpeedMultiplier,
        playOffset,
      },
      clips: clips.map((c) => {
        const frames = [];
        for (const t of c.thumbs) {
          try { frames.push(t.toDataURL()); } catch (e) { frames.push(null); }
        }
        return { name: c.name, frames };
      }),
      sequence: clipSequence.map((s) => ({ clipId: s.clipId })),
    };
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: "project.spiral",
        types: [{ description: "Spiral Project", accept: { "application/json": [".spiral"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data));
      await writable.close();
    } else {
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "project.spiral";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (err) {
    if (err.name !== "AbortError" && err.name !== "SecurityError") throw err;
  }
}

export async function loadProject() {
  try {
    let data;
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "Spiral Project", accept: { "application/json": [".spiral"] } }],
      });
      const file = await handle.getFile();
      data = JSON.parse(await file.text());
    } else {
      return;
    }
    const loaded = [];
    for (const c of data.clips) {
      const thumbs = await Promise.all(c.frames.map(dataURLToCanvas));
      loaded.push({ name: c.name, id: loaded.length, duration: thumbs.length, thumbs });
    }
    setClips(loaded);
    clipSequence.length = 0;
    data.sequence.forEach((s) => {
      clipSequence.push({ clipId: s.clipId, trimIn: 0, trimOut: clips[s.clipId].duration - 1 });
    });
    const t = data.timeline;
    setTimelineMode(t.mode); setPlaybackMode(t.playbackMode); setPlayheadDirection(t.playheadDirection);
    setTimelineDensity(t.density); setPlayheadSpeedMultiplier(t.speedMultiplier);
    setPlayOffset(t.playOffset);
    rebuildFrameArray();
    rebuildClipArray();
    document.getElementById("clipList").innerHTML = "";
    clips.forEach((c) => buildClipListEntry(c));
    updateScrubRange();
    updateTimecodeWithScrub();
    updatePreview();
    updateSpiralLength();
    rebuildScene();
    updateHudFrames();
  } catch (err) {
    if (err.name !== "AbortError" && err.name !== "SecurityError") throw err;
  }
}

document.getElementById("saveBtn").addEventListener("click", saveProject);
document.getElementById("loadBtn").addEventListener("click", loadProject);
