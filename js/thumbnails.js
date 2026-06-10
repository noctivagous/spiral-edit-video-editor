import { FRAME_W, FRAME_H, FRAME_STEP } from "./config.js";
import { view, playOffset, timelineCanvas, _pendingThumbs, setPendingThumbs } from "./state.js";
import { pointAtDistance } from "./spiral.js";
import { getFrameThumb } from "./mediabunny.js";
import { Sprite } from "pixi.js";

export function loadSpiralThumbnails(pending) {
  const w = timelineCanvas.clientWidth;
  const h = timelineCanvas.clientHeight;
  const halfDiag = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2) / view.scale + 100;
  const minDist = Math.max(0, playOffset - halfDiag);
  const maxDist = playOffset + halfDiag;

  const visible = pending.filter((p) => {
    if (p.wrapper.__thumbLoaded) return false;
    const d = p.visualSlot * FRAME_STEP;
    return d >= minDist && d <= maxDist;
  });

  let idx = 0;
  function loadBatch() {
    const batch = visible.slice(idx, idx + 8);
    idx += 8;
    if (batch.length === 0) return;
    Promise.all(batch.map((pt) => getFrameThumb(pt.clip, pt.frameIdx))).then((thumbs) => {
      for (let i = 0; i < batch.length; i++) {
        const pt = batch[i];
        const thumb = thumbs[i];
        if (!thumb || !pt.wrapper || pt.wrapper.destroyed) continue;
        if (pt.wrapper.__thumbLoaded) continue;
        const sprite = Sprite.from(thumb);
        sprite.anchor.set(0.5);
        sprite.width = FRAME_W;
        sprite.height = FRAME_H;
        pt.wrapper.addChildAt(sprite, 2);
        pt.wrapper.__thumbLoaded = true;
      }
      if (idx < visible.length) requestAnimationFrame(loadBatch);
    });
  }
  if (visible.length > 0) loadBatch();
}
