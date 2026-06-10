import * as PIXI from "pixi.js";
import { setSg } from "./state.js";
import { initPixiApp, app } from "./pixi-setup.js";
import { rebuildScene } from "./scene-graph.js";
import { tickerCallback } from "./render-loop.js";
import { loadVideoClips } from "./clip-loader.js";
import "./controls.js";
import "./save-load.js";
import "./debug.js";

// Resize handler (also used externally via ResizeObserver)
import { timelineCanvas, previewCanvas, pctx } from "./state.js";
import { updatePreview } from "./preview.js";

function resizeAll() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = timelineCanvas.parentElement.getBoundingClientRect();
  if (app) {
    app.renderer.resize(Math.max(100, rect.width * dpr), Math.max(100, rect.height * dpr));
    app.renderer.resolution = dpr;
  }
  const prect = previewCanvas.parentElement.getBoundingClientRect();
  previewCanvas.width = prect.width * dpr;
  previewCanvas.height = prect.height * dpr;
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  updatePreview();
}

new ResizeObserver(resizeAll).observe(timelineCanvas.parentElement);
new ResizeObserver(resizeAll).observe(previewCanvas.parentElement);

// --- Boot ---
setTimeout(async () => {
  try {
    resizeAll();
    if (typeof PIXI === "undefined") {
      document.getElementById("hudFps").textContent = "PixiJS failed to load";
      return;
    }
    setSg(await initPixiApp());
    rebuildScene();
    app.ticker.add(tickerCallback);
    document.getElementById("hudZoom").textContent = "100%";
    document.getElementById("hudFrames").textContent = "Loading clips...";
    loadVideoClips();
  } catch (err) {
    document.getElementById("hudFps").textContent = "Boot error: " + err.message;
    console.error("Boot error:", err);
  }
}, 50);
