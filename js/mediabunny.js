import { FPS } from "./config.js";

let _mb = null;
export async function getMediabunny() {
  if (!_mb) _mb = await import("https://esm.sh/mediabunny@1.45.4");
  return _mb;
}

export const frameCache = new Map();

export async function getFrameThumb(clip, frameIdx, w = 160, h = 90) {
  const key = `${clip.id}:${frameIdx}`;
  const cached = frameCache.get(key);
  if (cached) return cached;
  if (!clip._sink) {
    const { Input, UrlSource, ALL_FORMATS, VideoSampleSink } = await getMediabunny();
    const input = new Input({ source: new UrlSource(clip.file), formats: ALL_FORMATS });
    clip._input = input;
    const track = await input.getPrimaryVideoTrack();
    clip._sink = new VideoSampleSink(track);
  }
  const sample = await clip._sink.getSample(frameIdx / FPS);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  sample.draw(c.getContext("2d"), 0, 0, w, h);
  sample.close();
  frameCache.set(key, c);
  return c;
}

export async function getFirstFrame(clip) {
  if (clip.thumbs && clip.thumbs[0]) return clip.thumbs[0];
  const c = await getFrameThumb(clip, 0);
  if (!clip.thumbs) clip.thumbs = [];
  clip.thumbs[0] = c;
  return c;
}
