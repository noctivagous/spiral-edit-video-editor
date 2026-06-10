// Physical dimensions of spiral "tracks" and frame rectangles
export const TRACK_SPACING = 90;
export const FRAME_W = 64;
export const FRAME_H = 40;
export const FRAME_GAP = 0;
export const FRAME_STEP = FRAME_W;
export const FPS = 30;

// Spiral generation direction vectors (right, up, left, down)
export const dirs = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
];

// Built-in clip library definitions
export const clipDefs = [
  { name: "Ocean Drone", file: "media/ocean-drone-at-dusk.mp4", c1: "#0ea5e9", c2: "#6366f1" },
  { name: "Ocean Beach", file: "media/ocean-onto-beach.mp4", c1: "#f59e0b", c2: "#ef4444" },
  { name: "Into Forest", file: "media/ocean-into-forest.mp4", c1: "#22c55e", c2: "#14b8a6" },
];

// Base pixels-per-second for playback (scaled by zoom)
export const BASE_PPS = 78;

// Debug sampling interval
export const DEBUG_SAMPLE_INTERVAL = 0.05;
