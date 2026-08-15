import { RoadOstEngine } from "./audio/engine";
import { createMapper } from "./mapping/mapper";
import { FeatureBus, type BusMode } from "./sensors/bus";
import { SimulatorController } from "./sensors/simulator";
import type { FeatureFrame } from "./sensors/types";
import { DriveRecorder } from "./export/recorder";
import { createControls } from "./ui/controls";
import { Hud } from "./ui/hud";
import { Visualizer } from "./ui/visualizer";

export const mountApp = (root: HTMLElement): void => {
  root.innerHTML = `
    <main class="app-shell">
      <div id="controls-root"></div>
      <section class="hud-section">
        <div id="hud-root"></div>
      </section>
      <section class="viz-section">
        <div id="viz-root"></div>
      </section>
    </main>
  `;

  const controlsRoot = root.querySelector<HTMLElement>("#controls-root");
  const hudRoot = root.querySelector<HTMLElement>("#hud-root");
  const vizRoot = root.querySelector<HTMLElement>("#viz-root");
  if (!controlsRoot || !hudRoot || !vizRoot) {
    throw new Error("App failed to mount required regions");
  }

  const simulator = new SimulatorController();
  const bus = new FeatureBus(simulator);
  const mapper = createMapper();
  const engine = new RoadOstEngine();
  const recorder = new DriveRecorder(engine.getCaptureStream());
  const hud = new Hud(hudRoot);
  const visualizer = new Visualizer(vizRoot);

  const params = new URLSearchParams(window.location.search);
  const forceSimulator = params.get("sim") === "1";
  let mode: BusMode = forceSimulator ? "sim" : "live";
  let running = false;
  let latestFrame: FeatureFrame = simulator.getFeatureFrame(performance.now());
  let missingGeoFrames = 0;

  const setMode = (nextMode: BusMode): void => {
    mode = nextMode;
    bus.setMode(nextMode);
    controls.setMode(nextMode);
    controls.setStatusText(nextMode === "sim" ? "Simulator mode active." : "Live sensors mode active.");
  };

  const controls = createControls(controlsRoot, {
    onStart: async () => {
      if (mode === "live") {
        const permission = await bus.requestMotionPermission();
        if (!permission) {
          controls.setStatusText("Motion permission denied. Continuing without motion.");
        }
      }

      await engine.start();
      recorder.start();
      running = true;
      controls.setRunning(true);
      controls.setStatusText("Score running.");
    },
    onStop: () => {
      running = false;
      recorder.stop();
      engine.stop();
      controls.setRunning(false);
      controls.setStatusText("Score stopped.");
    },
    onSave: async () => {
      const saved = await recorder.saveThisDriveAndRestart();
      controls.setStatusText(saved ? "Saved this drive." : "No recording available yet.");
    },
    onModeChange: (nextMode) => setMode(nextMode),
    onMasterVolume: (value) => engine.updateSettings({ masterVolume: value }),
    onHoldKey: (value) => engine.updateSettings({ holdKey: value }),
    onReducedMotion: (value) => {
      engine.updateSettings({ reducedMotion: value });
      visualizer.setReducedMotion(value);
    },
    onPreset: (preset) => {
      simulator.applyPreset(preset);
      controls.syncSimulatorState(simulator.getState());
      controls.setStatusText("Preset loaded.");
    },
    onSpeedMps: (value) => simulator.setSpeedMps(value),
    onRainMmHr: (value) => simulator.setRainMmHr(value),
    onLux: (value) => simulator.setLux(value),
    onHour: (value) => simulator.setHourLocal(value),
    onTimelineSecond: (value) => simulator.setTimelineSeconds(value),
    onTimelinePlaying: (value) => simulator.setTimelinePlaying(value),
    onTunnelBlast: () => simulator.triggerTunnelBlast()
  });

  controls.setMode(mode);
  controls.syncSimulatorState(simulator.getState());

  bus.start(mode);
  bus.subscribe((frame) => {
    latestFrame = frame;

    if (mode === "live" && frame.source.geo === "missing") {
      missingGeoFrames += 1;
    } else {
      missingGeoFrames = 0;
    }

    if (!forceSimulator && mode === "live" && missingGeoFrames > 40) {
      setMode("sim");
      controls.setStatusText("Geolocation unavailable. Switched to simulator.");
    }
  });

  const renderLoop = (): void => {
    const mix = mapper.update(latestFrame);
    if (running) {
      engine.applyMix(mix);
    }

    controls.syncSimulatorState(simulator.getState());
    const driving = running && (latestFrame.speedMps ?? 0) > 4;
    controls.setDriving(driving);
    hud.render(latestFrame, mix);
    visualizer.render(latestFrame, mix);

    window.requestAnimationFrame(renderLoop);
  };

  renderLoop();

  window.addEventListener("beforeunload", () => {
    recorder.stop();
    engine.dispose();
    bus.stop();
  });
};
