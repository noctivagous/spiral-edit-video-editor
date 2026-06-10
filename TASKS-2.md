# Mediabunny Integration Plan

**Loading**: `import('https://esm.sh/mediabunny@0')` — ESM dynamic import from CDN, no bundler needed.

---

## Spiral-First Loading (applies to all phases)

The spiral must be visible and zoomable immediately on page load, before clips finish processing.

### Boot sequence (current vs target)

```
CURRENT:
  1. Load clips from IDB or extract from video  → 9-30s BLOCKING
  2. Initialize PixiJS
  3. Draw spiral + frames

TARGET:
  1. Initialize PixiJS immediately
  2. Draw spiral path (empty, no clip frames, but zoomable/pannable)
  3. Start loading Mediabunny + clips in background
  4. As each clip finishes: add to clip library UI (progressive)
  5. After all clips ready: init clip sequence + rebuild scene with frames
```

### Requirements
- Spiral path renders on load (before any clip processing)
- Scroll wheel zoom and drag-pan work immediately
- HUD shows "Loading clips..." during extraction
- Clip library populates progressively as each clip finishes
- Scene rebuild (with frame thumbnails on spiral) happens once all clips are loaded
- Play button is disabled until clips are loaded

---

## Phase 1 — Frame Extraction via Mediabunny

Replace native `<video>` + RAF extraction with Mediabunny's frame-accurate `sink.getSample(t)`.

### Changes

- Add `getMediabunny()` loader (dynamic import via esm.sh, singleton)
- Rewrite `extractFramesFromVideo` to use `Input` → `VideoSampleSink` → `getSample(i/fps)` loop
- IDB caching stays identical (same canvas output)
- Boot sequence stays identical (load clips → cache → build scene)

### Files affected

`Spiral-video-editor-demo-pixi.html`:
- Lines ~641-682: Replace `extractFramesFromVideo` function body
- After clip section: Add `getMediabunny()` singleton

---

## Phase 2 — On-Demand Preview (do now)

Eliminate pre-extraction wait. Preview and spiral thumbnails seek from video source directly.

### Preview during playback

In `updatePreview()` (frames mode), instead of `timelineFrames[idx].thumb`:

```javascript
// Open a per-clip Mediabunny sink on first use, seek to current time
if (!clip._sink) {
  const input = new Input({ source: new UrlSource(clip.file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  clip._sink = new VideoSampleSink(track);
}
const vf = await clip._sink.getSample(localFrame / FPS);
ctx.drawImage(vf, 0, 0, pw, ph);
vf.close();
```

### Spiral frame thumbnails

In `rebuildItems()` (frames mode), instead of `timelineFrames[v].thumb`:

```javascript
// Sparse: show every Nth frame as a thumbnail
// Dense frames get colored rect + frame number only
const shouldDrawThumb = v % thumbInterval === 0;
if (shouldDrawThumb) {
  const frame = await clip._sink.getSample(frameIdx / FPS);
  // ... draw as sprite
} else {
  // draw empty rect with clip color
}
```

### Clip library thumbnails

Keep individual frame thumbnails. Extract them on boot via Mediabunny (like Phase 1, but only for the clip library list, not the full timeline).

### Tradeoffs

| Aspect | Pre-extract (current) | On-demand (new) |
|--------|----------------------|-----------------|
| Boot time | ~9s extraction + cache | ~1s (only library thumbnails) |
| Playback preview | Instant (array lookup) | ~5-10ms seek per frame |
| Spiral thumbnails | All frames pre-rendered | Sparse + on-demand |
| Memory | 270 canvas elements in RAM | 0 frame canvases (except library) |

Acceptable because:
- Preview seek (5-10ms) is well within a 16ms frame budget at 60fps
- Spiral thumbnails are sparse (every 10-30 frames) — visible thumbnails are few
- Eliminates the 9s boot wait

### Dependency changes

- `updatePreview()` becomes async (needs `await` on `sink.getSample`)
- `rebuildItems()` becomes async (needs `await` on `sink.getSample`)
- Ticker callback stays sync but calls async functions (fire-and-forget with cached frame)
- Need a frame cache: `Map<clipId, Map<frameIndex, VideoFrame>>` or similar

### Frame cache strategy

```javascript
const frameCache = new Map(); // "clipId:frameIdx" → canvas

async function getCachedFrame(clip, frameIdx) {
  const key = `${clip.id}:${frameIdx}`;
  if (frameCache.has(key)) return frameCache.get(key);
  // Seek and render
  const vf = await clip._sink.getSample(frameIdx / FPS);
  const c = document.createElement('canvas');
  c.width = 160; c.height = 90;
  c.getContext('2d').drawImage(vf, 0, 0);
  vf.close();
  frameCache.set(key, c);
  return c;
}
```

---

## Phase 3 — Export Timeline with Concatenation

Export the full timeline as a single MP4/WebM using Mediabunny's `CanvasSource` for concatenation.

### Architecture

```
For each clip in clipSequence:
  1. Open Mediabunny Input + VideoSampleSink
  2. Iterate frames from trimIn to trimOut
  3. Draw each frame to an offscreen canvas at composition time
  4. Feed canvas to CanvasSource → Output's video track

Audio:
  1. For each clip, iterate audio samples
  2. Mix into AudioBufferSource → Output's audio track
```

### Code sketch

```javascript
async function exportTimeline() {
  const { Input, Output, WebMOutputFormat, BlobTarget, Conversion, UrlSource, ALL_FORMATS, CanvasSource } = await getMediabunny();

  // Create output
  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BlobTarget(),
  });

  // Create canvas source for frame-by-frame composition
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 360; // 480p
  const canvasSource = new CanvasSource(canvas, {
    codec: 'vp9',
    bitrate: 2_000_000,
    fps: FPS,
  });
  output.addVideoTrack(canvasSource);

  await output.start();

  // Write frames from each clip in sequence
  for (const entry of clipSequence) {
    const clip = clips[entry.clipId];
    const input = new Input({ source: new UrlSource(clip.file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const sink = new VideoSampleSink(track);

    for (let f = entry.trimIn; f <= entry.trimOut; f++) {
      const vf = await sink.getSample(f / FPS);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vf, 0, 0, canvas.width, canvas.height);
      vf.close();
      await canvasSource.addFrame(); // push frame to encoder
    }
  }

  await output.finalize();
  const blob = output.target.blob;
  // Download or save
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'timeline-export.webm';
  a.click();
}
```

### UI

Add "Export" button next to Save/Load in the controls bar.

### Notes

- Audio track concatenation is Phase 3.5 (AudioBufferSource + mixing)
- Export runs in background; show progress indicator
- VP9 in WebM for broad browser support; MP4 with H.264 if needed

---

## Phase 4 — Project Format Evolution

Current `.spiral` file embeds all frame data as base64 (~5MB for 270 frames). With on-demand seeking, we can drop this.

### New save format

```json
{
  "version": 2,
  "timeline": { /* same as before */ },
  "sources": [
    { "name": "Ocean Drone", "file": "media/ocean-drone-at-dusk.mp4" },
    { "name": "Ocean Beach", "file": "media/ocean-onto-beach.mp4" },
    { "name": "Into Forest", "file": "media/ocean-into-forest.mp4" }
  ],
  "sequence": [
    { "clipId": 0, "trimIn": 0, "trimOut": 89 },
    { "clipId": 1, "trimIn": 0, "trimOut": 89 },
    { "clipId": 2, "trimIn": 0, "trimOut": 89 }
  ]
}
```

### Load flow

1. Parse JSON → get source file paths + trim ranges
2. On-demand: open Mediabunny `Input` per source, seek frames as needed
3. No IDB cache needed (source files are the source of truth)
4. No pre-extraction wait

### When to do this

After Phase 2 is stable (on-demand seeking proven). The old v1 format (embedded base64) still loads for backward compat.

---

## Milestones

| Phase | Depends on | Est. effort | Delivers |
|-------|-----------|-------------|----------|
| 1 — Extraction via Mediabunny | — | Small | Reliable frame extraction, IDB cache |
| 2 — On-demand preview | 1 | Medium | Instant boot, no pre-extraction wait |
| 3 — Export with concat | 1 | Medium | Downloadable timeline as video |
| 4 — Project format v2 | 2 | Small | Tiny project files, source-referenced |
| 3.5 — Audio in export | 3 | Small | Audio tracks in exported video |

---

EXTRA tasks

1. video frames shouldn't be upset down on the top edge segments of the spiral.
on the right edge segments, they should be rotated 180 degrees from what they are.
2. use layout debug utilities we made to make the segments of the spiral
line up instead of overflow or overlap.  We are usually a rectangular
spiral, so this should provide flexibility.
3. debug dropdown menu at top and one of the list items says, "reset loading"
4. seeking/playback preview box (current), scrubbing preview box.
two preview boxes.  the first is the existing one which is where the
playhead is located (seeking/playback).  a new one underneath it is for hover-based scrubbing
and shows in the preview box the frame where the mouse is hovering and if the mouse 
leaves any hover space over a clip this scrubbing preview box turns empty.  
both preview boxes should gain a timecode box, with a monospace font.  so, when 
hover-based scrubbing the timecode box will turn empty if the mouse leaves
a clip area.
5. clip selection. the clip selection highlights the entire collective shape of the clips, including
how many segments it includes
	d / left mouse click - seek to point underneath mouse
	f - select clip underneath mouse

