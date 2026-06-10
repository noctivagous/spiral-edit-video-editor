import { clipDefs, FPS } from "./config.js";
import {
  clips, setClips, clipSequence,
} from "./state.js";
import { getMediabunny } from "./mediabunny.js";
import {
  rebuildFrameArray, updateScrubRange, updateSpiralLength,
  updateTimecodeWithScrub, updateHudFrames, addClipToTimeline,
} from "./timeline-state.js";
import { rebuildScene } from "./scene-graph.js";
import { updatePreview } from "./preview.js";

export function buildClipListEntry(clip) {
  const clipListEl = document.getElementById("clipList");
  const el = document.createElement("div");
  el.className = "clip";
  el.draggable = true;
  el.dataset.clipId = clip.id;
  el.innerHTML = `
    <div class="clip-thumb"></div>
    <div class="clip-meta">
      <div class="clip-name">${clip.name}</div>
      <div class="clip-sub">${clip.duration} frames \u2022 ${(clip.duration / FPS).toFixed(1)}s</div>
      <div class="clip-actions">
        <button class="btn-small" data-add>Add to Timeline</button>
      </div>
    </div>`;
  el.querySelector(".clip-thumb").appendChild(clip.thumbs[0]);
  clipListEl.appendChild(el);
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", clip.id);
    e.dataTransfer.effectAllowed = "copy";
  });
  el.querySelector("[data-add]").addEventListener("click", () => addClipToTimeline(clip.id));
}

export async function loadVideoClips() {
  const { Input, UrlSource, ALL_FORMATS, VideoSampleSink } = await getMediabunny();
  const statusEl = document.getElementById("hudFps");
  for (let i = 0; i < clipDefs.length; i++) {
    const def = clipDefs[i];
    statusEl.textContent = `Loading ${def.name}...`;
    const input = new Input({ source: new UrlSource(def.file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const duration = await input.computeDuration();
    const totalFrames = Math.ceil(duration * FPS);
    const sink = new VideoSampleSink(track);
    const firstSample = await sink.getSample(0);
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 160;
    thumbCanvas.height = 90;
    firstSample.draw(thumbCanvas.getContext("2d"), 0, 0, 160, 90);
    firstSample.close();
    const clip = { ...def, id: i, duration: totalFrames, thumbs: [thumbCanvas], _input: input, _sink: sink };
    clips.push(clip);
    buildClipListEntry(clip);
    statusEl.textContent = `${def.name} \u2713`;
  }
  initTimelineSequence();
}

export function initTimelineSequence() {
  clipSequence.length = 0;
  clipSequence.push({ clipId: 0, trimIn: 0, trimOut: clips[0].duration - 1 });
  clipSequence.push({ clipId: 1, trimIn: 0, trimOut: clips[1].duration - 1 });
  clipSequence.push({ clipId: 2, trimIn: 0, trimOut: clips[2].duration - 1 });
  rebuildFrameArray();
  updateScrubRange();
  updateSpiralLength();
  rebuildScene();
  updateTimecodeWithScrub();
  updatePreview();
  updateHudFrames();
  document.getElementById("hudFrames").textContent = `${clips.reduce((s, c) => s + c.duration, 0)} frames`;
}

export function rebuildTimelineFromSequence(seq) {
  clipSequence.length = 0;
  seq.forEach((entry) =>
    clipSequence.push({ ...entry, trimIn: 0, trimOut: clips[entry.clipId].duration - 1 }),
  );
  rebuildFrameArray();
  updateScrubRange();
  updateTimecodeWithScrub();
}
