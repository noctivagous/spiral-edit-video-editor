# Browser-Based Video Editor Architecture

Research compiled 2025-06-10 from MDN, img.ly, Remotion, ffmpeg.wasm docs, UpUply blog.

---

## The Architecture Spectrum

Most production editors use a **hybrid model** — the browser handles UI + preview, the cloud (or a Wasm worker) handles heavy encode:

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  Browser (client)       │     │  Cloud / Worker (server)  │
│                         │     │                          │
│  • Timeline UI          │     │  • Transcoding           │
│  • Preview playback     │     │  • Final render          │
│  • Drag / trim / effects│     │  • Export (4K / HDR)     │
│  • Low-res proxies      │     │  • AI inference          │
│  • Sparse thumbnails    │     │  • Complex filter graph  │
└─────────────────────────┘     └──────────────────────────┘
```

### Three tiers of approach

| Tier | Examples | Video handling | Frame accuracy |
|------|----------|----------------|----------------|
| **Lightweight** (trim/crop) | Clipchamp basic, Kapwing | `<video>` element + Canvas overlays | Approximate |
| **Mid-tier** (multi-track, effects) | VEED.io, Adobe Express | WebGL compositing + WebCodecs decode + Wasm filters | Frame-accurate via WebCodecs |
| **Professional** (timeline NLE) | Remotion, IMG.LY CE.SDK, Canva | Server-side render pipeline; browser is UI-only for final output | Server-side |

---

## Core Web Technologies

| Technology | Role in video editing | Complexity | When to use |
|-----------|----------------------|------------|-------------|
| **Canvas 2D** | Simple overlays, frame drawing, thumbnails | Low | Trimming, basic effects, thumbnail generation |
| **WebGL** | GPU-accelerated compositing, filters, transitions | High | Real-time multi-layer preview, shader effects |
| **WebGPU** | Next-gen GPU access (successor to WebGL) | High | Future-proof high-performance rendering |
| **WebCodecs** | Direct hardware decode/encode (VideoDecoder, AudioDecoder) | Medium | Frame-accurate extraction, transcoding pipelines |
| **WebAssembly** | Near-native perf for codecs (ffmpeg.wasm, etc.) | High | Format conversion, complex filter graphs |
| **Web Audio API** | Multi-track audio, effects, mixing | Medium | Audio processing, waveform visualization |
| **MediaStream API** | Live webcam / microphone capture | Low | Recording features |

### How they compose together

A typical pipeline:

```
Source file
    │
    ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Demuxer    │────▶│  WebCodecs   │────▶│  WebGL /     │
│  (mp4box.js)│     │  VideoDecoder│     │  Canvas      │
│  or native  │     │  (HW accel)  │     │  (composite) │
│  <video>    │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌──────────────┐
                    │  WebAssembly │     │  Web Audio   │
                    │  (ffmpeg.wasm│     │  API         │
                    │   for export)│     │  (mix tracks)│
                    └──────────────┘     └──────────────┘
```

---

## Frame Extraction: Approaches Compared

| Approach | Complexity | Frame accuracy | Browser support | Seeking | Dependencies |
|----------|-----------|----------------|-----------------|---------|--------------|
| `<video>` + RAF capture | Low | Approximate (±1-2 frames) | Universal | Native | None |
| `<video>` + seek + drawImage | Low | Frame-exact (after seeked event) | Universal | Native | None |
| WebCodecs + demuxer | High | Exact | Chrome/Firefox/Safari recent | Manual re-decode | mp4box.js or @remotion/media-parser |
| ffmpeg.wasm | Medium | Exact | All (Wasm) | Re-encode | 30MB Wasm core + worker CORS issues |

### Key insight

**No production editor extracts every frame to memory.** They all use on-demand seeking:

- **Preview**: Native `<video>` element seeking (hardware accelerated, free)
- **Thumbnails on timeline**: Sparse keyframe extraction (every N frames) or poster frames
- **Trim handles**: Just metadata (`trimIn`/`trimOut` in seconds) — no frame data changes
- **Export**: Pass source + trim ranges to encoder (ffmpeg.wasm or server)

---

## Industry Standard Data Model

```javascript
// Standard NLE project format — every editor uses a variant of this
{
  version: 1,
  metadata: {
    fps: 30,
    resolution: { width: 1920, height: 1080 }
  },
  tracks: [{
    name: "Video Track 1",
    clips: [{
      sourceId: "uuid-ocean-clip",
      sourceURL: "media/ocean-drone.mp4",
      startOnTimeline: 0,         // when clip appears in composition (seconds)
      sourceStart: 2.5,           // trimIn in source (seconds)
      sourceEnd: 5.5,             // trimOut in source (seconds)
      duration: 3.0,              // = sourceEnd - sourceStart
      effects: [
        { type: "brightness", value: 1.2 },
        { type: "crop", rect: { x: 0, y: 0, w: 1920, h: 1080 } }
      ],
      transforms: {
        position: { x: 0, y: 0 },
        scale: 1.0,
        rotation: 0
      }
    }]
  }, {
    name: "Audio Track 1",
    clips: [ /* similar structure */ ]
  }]
}
```

This is **serializable** — can be saved/loaded as JSON. The actual video files are referenced by URL, not embedded.

---

## How Trimming Works (in production)

Trimming is entirely **metadata-driven**. No frame data is modified until export:

### User interaction

```
 Clip on timeline:
 [=====|===============|=====]
      ↑ trimIn         ↑ trimOut
      (draggable)      (draggable)
```

### Internal state change

```javascript
// Before trim:
{ sourceStart: 0, sourceEnd: 90 }  // frame indices

// User drags trimIn handle right by 10 frames:
{ sourceStart: 10, sourceEnd: 90 }

// Preview updates instantly:
video.currentTime = sourceStart / fps  // seeks to frame 10
```

### Export pipeline

```bash
# ffmpeg on server or Wasm:
ffmpeg -i source.mp4 -ss 2.5 -t 3.0 -c copy output.mp4
#          input     start  duration (frames/fps)
```

---

## Key Takeaways for the Spiral Editor

### What to keep
- The spiral visualization concept — unique spatial affordance
- `clipSequence` model with `{clipId, trimIn, trimOut}` — matches industry standard
- The data-driven scene graph rebuild (`rebuildScene()`)
- Sparse thumbnail rendering in clips mode (`thumbInterval`)

### What to change (next iteration)
1. **Stop pre-extracting all frames.** Use `<video>` on-demand seeking for both preview and thumbnails. For the spiral, generate sparse thumbnails from a hidden `<video>` element seeking to keyframe intervals.
2. **Store timestamps in seconds, not frame indices.** `trimIn: 2.5` instead of `trimIn: 75`. This is resolution-independent and matches every encoder API.
3. **Add a linear track strip** below the spiral for precise trim handle dragging. The spiral is the overview; the strip is the precision tool.
4. **Separate source from edit metadata.** Project file should reference video URLs, not embed frame data. The current project save embeds all frames as base64 — this explodes at >30s of video.

### When to add WebCodecs
When you need:
- Frame-exact thumbnails without seeking latency
- Raw pixel access for effects pipeline (brightness, color grade)
- Export with Wasm workers (ffmpeg.wasm for final encode)

Until then, native `<video>` + Canvas is sufficient and dramatically simpler.

---

## Reference Links

- MDN WebCodecs API: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- ffmpeg.wasm docs: https://ffmpegwasm.netlify.app/docs/overview
- Remotion: https://www.remotion.dev/docs/media-parser/webcodecs
- img.ly video editing guide: https://img.ly/blog/javascript-video-editing-guide/
- UpUply browser video editor analysis: https://www.upuply.com/blog/browser-video-editor
- WebCut (open-source editor): https://dev.to/frustigor/webcut-redefining-web-based-video-editing-for-developers-with-open-source-excellence-1hci