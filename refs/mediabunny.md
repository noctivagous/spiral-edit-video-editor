# Mediabunny — Web-Native Media Toolkit

Researched 2025-06-10 from https://mediabunny.dev

---

## What it is

A zero-dependency TypeScript library for reading, writing, and converting media files in the browser. Uses WebCodecs under the hood, but wraps it in a clean streaming API. Created by Vanilagy (Griffin Redman), sponsored by Remotion, Gling AI, Diffusion Studio, and others.

**License**: MPL-2.0 — free for any purpose, including closed-source commercial use.

---

## Performance (vs alternatives)

Benchmarks from the project's README (Ryzen 7600X, RTX 4070, NVMe SSD):

| Task | Mediabunny | @remotion/media-parser | mp4box.js | ffmpeg.wasm |
|------|-----------|----------------------|-----------|-------------|
| Extract metadata | **862 ops/s** | 233 ops/s | 43.5 ops/s | 1.83 ops/s |
| Iterate all video packets | **10,800 packets/s** | — | 2,390 packets/s | — |
| Convert to .webm + resize 320x180 | **804 frames/s** | 324 frames/s (remotion/webcodecs) | — | 12.0 frames/s |

---

## Bundle size (min+gzip)

| Feature | Size |
|---------|------|
| Reading .wav | 5.1 KB |
| Reading .mp4 | 16.0 KB |
| Reading .webm | 15.2 KB |
| Reading all formats | 30.0 KB |
| All features | 69.6 KB |
| ffmpeg.wasm (comparison) | ~10 MB |

---

## Key API for the spiral editor

### Frame-accurate seeking

```typescript
const input = new Input({
  source: new UrlSource('./ocean-drone.mp4'),
  formats: ALL_FORMATS,
});

const videoTrack = await input.getPrimaryVideoTrack();
const sink = new VideoSampleSink(videoTrack);

// Seek to exact time (seconds) — returns a VideoFrame
const frame = await sink.getSample(duration / 2);

// Or iterate all frames:
for await (const frame of sink.samples()) {
  // frame is a VideoFrame — can draw to canvas
  ctx.drawImage(frame, 0, 0, 160, 90);
  frame.close();
}
```

### Trimming + conversion

```typescript
const input = new Input({
  source: new UrlSource('./ocean-drone.mp4'),
  formats: ALL_FORMATS,
});

const output = new Output({
  format: new Mp4OutputFormat(),
  target: new BlobTarget(),
});

const conversion = await Conversion.init({ input, output });
await conversion.setTrim({ start: 2.5, end: 5.5 });
await conversion.execute();

const { blob } = output.target; // trimmed .mp4 as Blob
```

### Frame extraction for spiral thumbnails

```typescript
const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
const videoTrack = await input.getPrimaryVideoTrack();
const sink = new VideoSampleSink(videoTrack);

const thumbnails = [];
let t = 0;
while (t < duration) {
  const frame = await sink.getSample(t);
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  canvas.getContext('2d').drawImage(frame, 0, 0, 160, 90);
  thumbnails.push(canvas);
  frame.close();
  t += 1 / 30; // 30fps
}
```

---

## Fit for the spiral editor

| Requirement | Mediabunny | Native `<video>` |
|------------|-----------|-----------------|
| Frame-accurate seeking | ✅ `sink.getSample(t)` | ❌ approximate (seeked event race) |
| Thumbnail extraction | ✅ fast, exact | ✅ works, but may miss frames |
| Trim preview | ✅ built-in conversion API | ✅ native seeking |
| Export trimmed video | ✅ `Conversion.execute()` | ❌ needs ffmpeg.wasm |
| Bundle size | 30 KB | 0 (browser built-in) |
| Browser support | Chrome/Firefox/Safari (WebCodecs) | Universal |
| Complexity | Low (clean API) | Low |

### Recommendation

This is the **best candidate** for replacing both the current `<video>` RAF extraction AND the failed ffmpeg.wasm CDN approach:

- Frame extraction is exact and fast (no missed frames, no seeking race conditions)
- Trim/export is a single API call — no ffmpeg.wasm CDN Worker/CORS headache
- Tiny bundle (30KB vs 30MB for ffmpeg.wasm)
- Same-origin HTTP only (WebCodecs requires secure context or localhost)
- MPL-2.0 license is permissive

The only caveat: it requires WebCodecs support (Chrome 94+, Firefox 130+, Safari 17+). For a demo editor, this is fine.

**Cost to integrate**: Install via npm, swap `extractFramesFromVideo` to use Mediabunny's `getSample()`, swap `saveProject`/export to use `Conversion.setTrim()` + `BlobTarget`.

---

## Reference

- Homepage: https://mediabunny.dev
- GitHub: https://github.com/Vanilagy/mediabunny
- Guide: https://mediabunny.dev/guide/introduction
- Supported formats: https://mediabunny.dev/guide/supported-formats-and-codecs