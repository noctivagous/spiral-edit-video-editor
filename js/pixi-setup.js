import { Application, Container, Graphics, Text } from "pixi.js";
import { timelineCanvas } from "./state.js";

let app;
export { app };

export let appReady = false;

export async function initPixiApp() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = timelineCanvas.getBoundingClientRect();
  const w = Math.max(100, rect.width);
  const h = Math.max(100, rect.height);

  app = new Application();
  await app.init({
    canvas: timelineCanvas,
    width: w * dpr,
    height: h * dpr,
    resolution: dpr,
    autoDensity: true,
    backgroundAlpha: 0,
    antialias: true,
  });

  const spiralContainer = new Container();
  app.stage.addChild(spiralContainer);

  const pathGraphics = new Graphics();
  spiralContainer.addChild(pathGraphics);

  const itemsContainer = new Container();
  spiralContainer.addChild(itemsContainer);

  const markersContainer = new Container();
  spiralContainer.addChild(markersContainer);

  const playheadContainer = new Container();
  spiralContainer.addChild(playheadContainer);

  const playheadGlow = new Graphics();
  playheadContainer.addChild(playheadGlow);

  const playheadLine = new Graphics();
  playheadContainer.addChild(playheadLine);

  const playheadTri = new Graphics();
  playheadContainer.addChild(playheadTri);

  const playheadLabel = new Text({
    text: "00:00.00",
    style: { fontFamily: "monospace", fontSize: 10, fill: "#ff3bff", align: "center" },
  });
  playheadLabel.anchor.set(0.5, 0);
  playheadContainer.addChild(playheadLabel);

  const stripPlayhead = new Container();
  app.stage.addChild(stripPlayhead);
  const stripCircle = new Graphics();
  stripCircle.circle(0, 0, 22).stroke({ width: 3, color: 0xff3bff, alpha: 0.9 });
  stripPlayhead.addChild(stripCircle);
  const stripDot = new Graphics();
  stripDot.circle(0, 0, 4).fill(0xff3bff);
  stripPlayhead.addChild(stripDot);

  const zoomLineGraphics = new Graphics();
  app.stage.addChild(zoomLineGraphics);

  return {
    spiralContainer,
    pathGraphics,
    itemsContainer,
    markersContainer,
    markerGraphics: new Graphics(),
    playheadContainer,
    playheadGlow,
    playheadLine,
    playheadTri,
    playheadLabel,
    stripPlayhead,
    zoomLineGraphics,
  };
}

export function resizePixiApp() {
  if (!app) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = timelineCanvas.getBoundingClientRect();
  const w = Math.max(100, rect.width);
  const h = Math.max(100, rect.height);
  app.renderer.resize(w * dpr, h * dpr);
  app.renderer.resolution = dpr;
}
