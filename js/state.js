// Timeline mode
export let timelineMode = "frames";
export function setTimelineMode(mode) { timelineMode = mode; }

export let playbackMode = "playhead";
export function setPlaybackMode(mode) { playbackMode = mode; }

export let playheadDirection = "outward";
export function setPlayheadDirection(dir) { playheadDirection = dir; }

export let timelineDensity = 1.0;
export function setTimelineDensity(v) { timelineDensity = v; }

export let playheadSpeedMultiplier = 1.0;
export function setPlayheadSpeedMultiplier(v) { playheadSpeedMultiplier = v; }

// Debug state
export let debugTracking = false;
export let debugSamples = [];
export let debugSampleTimer = 0;
export function resetDebugSamples() { debugSamples = []; debugSampleTimer = 0; }
export function setDebugTracking(v) { debugTracking = v; }
export function pushDebugSample(s) { debugSamples.push(s); }
export function addDebugSampleTimer(dt) { debugSampleTimer += dt; }

// View state (pan and zoom)
export const view = { offsetX: 0, offsetY: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 };

// Playback
export let isPlaying = false;
export function setIsPlaying(v) { isPlaying = v; }

export let playOffset = 0;
export function setPlayOffset(v) { playOffset = v; }

export let speed = 1;
export function setSpeed(v) { speed = v; }

// Scene graph
export let sg = null;
export function setSg(v) { sg = v; }

// Cached markers / thumbnails
export let markersDirty = true;
export function setMarkersDirty(v) { markersDirty = v; }

export let lastPlayOffset = 0;
export function setLastPlayOffset(v) { lastPlayOffset = v; }

export let lastZoomScale = 1;
export function setLastZoomScale(v) { lastZoomScale = v; }

export let _pendingThumbs = [];
export function setPendingThumbs(v) { _pendingThumbs = v; }

export let _thumbLoadThrottle = 0;
export function setThumbLoadThrottle(v) { _thumbLoadThrottle = v; }
export function addThumbLoadThrottle(dt) { _thumbLoadThrottle += dt; }

// Timeline data
export const timelineFrames = [];
export const timelineClips = [];
export const clipSequence = [];

// Loaded clip objects
export let clips = [];
export function setClips(v) { clips = v; }

// Canvas elements
export const timelineCanvas = document.getElementById("timeline");
export const previewCanvas = document.getElementById("preview");
export const pctx = previewCanvas.getContext("2d");
