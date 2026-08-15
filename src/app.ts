import { RoadOstEngine } from "./audio/engine";
import { DriveRecorder } from "./export/recorder";
import { createMapper } from "./mapping/mapper";
import { RecapTracker, persistRecap } from "./recap/recap";
import { FeatureBus, type BusMode } from "./sensors/bus";
import { SimulatorController, type SimulatorPresetId } from "./sensors/simulator";
import type { FeatureFrame, MixState } from "./sensors/types";
import {
  parseRoadOstUrl,
  serializeRoadOstUrl,
  type RoadOstUrlState
} from "./share/url";
import {
  createControls,
  type ControlsHandle,
  type StudioSettings
} from "./ui/controls";
import { Hud } from "./ui/hud";
import { RecapPanel } from "./ui/recap";
import { Visualizer } from "./ui/visualizer";

const SETTINGS_KEY = "roadost.settings.v1";
const LAST_VIEW_KEY = "roadost.lastView";
const ONBOARDING_KEY = "roadost.onboarding.v1";

const DEFAULT_SETTINGS: StudioSettings = {
  masterVolume: 0.85,
  holdKey: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
};

const readSettings = (): StudioSettings => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<StudioSettings>;
    return {
      masterVolume:
        typeof stored.masterVolume === "number"
          ? Math.min(1, Math.max(0, stored.masterVolume))
          : DEFAULT_SETTINGS.masterVolume,
      holdKey: typeof stored.holdKey === "boolean" ? stored.holdKey : DEFAULT_SETTINGS.holdKey,
      reducedMotion:
        typeof stored.reducedMotion === "boolean"
          ? stored.reducedMotion
          : DEFAULT_SETTINGS.reducedMotion
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const writeSettings = (settings: StudioSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The studio still works when storage is unavailable.
  }
};

const rememberView = (view: "landing" | "studio"): void => {
  try {
    localStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // View memory is optional.
  }
};

const writeClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
};

const landingMarkup = `
  <main class="landing-shell">
    <nav class="landing-nav" aria-label="Primary navigation">
      <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="RoadOST home">Road<span>OST</span></a>
      <div class="nav-actions">
        <a href="https://github.com/aditano/RoadOST" target="_blank" rel="noreferrer">GitHub</a>
        <button id="nav-open-studio" type="button">Open studio</button>
      </div>
    </nav>

    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">A live score for the road</p>
        <h1>Your drive<br /><span>writes the score.</span></h1>
        <p class="hero-lede">RoadOST turns speed, weather, light, and motion into a live cinematic rock arrangement. It opens in your browser. Nothing to install.</p>
        <p class="bluetooth-note"><span aria-hidden="true">●</span> Pair your phone to the car over Bluetooth, tap Start, and drive.</p>
        <div class="hero-actions">
          <button id="hero-open-studio" class="primary-cta" type="button">Open the drive studio <span>→</span></button>
          <button id="hero-play-demo" class="text-cta" type="button"><span aria-hidden="true">▶</span> Play a 90s demo</button>
        </div>
      </div>
      <div class="hero-stage" aria-label="RoadOST drive studio preview">
        <div class="stage-glow"></div>
        <div class="road-preview">
          <div class="preview-sky"><span class="preview-moon"></span></div>
          <div class="preview-ridge"></div>
          <div class="preview-road"><i></i><i></i><i></i></div>
          <span class="rain-line r1"></span><span class="rain-line r2"></span><span class="rain-line r3"></span><span class="rain-line r4"></span><span class="rain-line r5"></span>
          <div class="preview-top"><span>ROADOST // LIVE</span><b>NIGHT RAIN HIGHWAY</b></div>
          <div class="preview-speed"><b>70</b><span>MPH</span></div>
          <div class="preview-section"><span>CHORUS</span><b>160 BPM</b></div>
        </div>
        <div class="floating-chip chip-energy"><span>ENERGY</span><b>92%</b></div>
        <div class="floating-chip chip-rain"><span>RAIN BED</span><b>HEAVY</b></div>
      </div>
    </section>

    <div class="proof-strip" aria-label="Product qualities">
      <span><b>01</b> Runs in your browser</span>
      <span><b>02</b> Synthesized live</span>
      <span><b>03</b> Local by design</span>
    </div>

    <section class="product-definition section-wrap">
      <div>
        <p class="eyebrow">What it is</p>
        <h2>A score engine that listens to the road.</h2>
      </div>
      <div class="definition-copy">
        <p>RoadOST uses a bank of synthesized drums, bass, guitar, pads, hooks, and weather textures. The mapper reshapes the arrangement as the drive changes.</p>
        <p class="not-generator"><span>Not a song generator.</span> No waiting for a model. No random full songs. Every change stays locked to the beat and key.</p>
      </div>
    </section>

    <section class="how-section section-wrap">
      <div class="section-intro">
        <p class="eyebrow">How it works</p>
        <h2>Road in. Score out.</h2>
        <p>Three fast stages turn live conditions into music without sending your drive to a server.</p>
      </div>
      <div class="signal-flow">
        <article><span class="flow-number">01</span><div class="flow-icon">⌁</div><h3>Sensors</h3><p>Speed, motion, heading, light, time, and weather.</p></article>
        <div class="flow-arrow" aria-hidden="true">→</div>
        <article><span class="flow-number">02</span><div class="flow-icon">⌘</div><h3>Mapper</h3><p>Energy, tempo, texture, key color, and section decisions.</p></article>
        <div class="flow-arrow" aria-hidden="true">→</div>
        <article><span class="flow-number">03</span><div class="flow-icon">≋</div><h3>Live stem mix</h3><p>A reactive rock and cinema arrangement, always on beat.</p></article>
      </div>
    </section>

    <section class="features-section section-wrap">
      <div class="section-intro centered">
        <p class="eyebrow">Built for a real drive</p>
        <h2>Glanceable. Reactive. Yours.</h2>
      </div>
      <div class="feature-grid">
        <article>
          <div class="feature-art live-art"><span></span><span></span><span></span><span></span><span></span></div>
          <p class="feature-kicker">LIVE MIX</p><h3>The arrangement moves with you.</h3>
          <p>Rain pulls in texture. Highway energy opens the chorus. Tunnels break the brightness and reveal the pad.</p>
        </article>
        <article>
          <div class="feature-art sim-art"><span>70<small>MPH</small></span><i></i></div>
          <p class="feature-kicker">SIMULATOR</p><h3>Hear it before the first mile.</h3>
          <p>Ten road presets and a 90 second timeline make the full engine easy to explore from a desk.</p>
        </article>
        <article>
          <div class="feature-art share-art"><b>CHORUS</b><span>8 BARS</span><i>↗</i></div>
          <p class="feature-kicker">SAVE + SHARE</p><h3>Keep the drive, not the data trail.</h3>
          <p>Record the mix, review a local recap, and share a compact preset link. No account required.</p>
        </article>
      </div>
    </section>

    <section class="final-cta section-wrap">
      <p class="eyebrow">The road is ready</p>
      <h2>Give the next drive<br />its own soundtrack.</h2>
      <button id="footer-open-studio" class="primary-cta" type="button">Open the drive studio <span>→</span></button>
      <p>Browser audio starts only after your tap.</p>
    </section>

    <footer class="landing-footer">
      <a class="brand" href="${import.meta.env.BASE_URL}">Road<span>OST</span></a>
      <p>Sensor honesty: availability varies by browser. Missing inputs are labeled and never presented as live.</p>
      <div><a href="https://github.com/aditano/RoadOST" target="_blank" rel="noreferrer">GitHub</a><span>MIT License</span></div>
    </footer>
  </main>
`;

export const mountApp = (root: HTMLElement): void => {
  let disposeView: () => void = () => undefined;

  const baseUrl = (): URL => new URL(import.meta.env.BASE_URL, window.location.origin);

  const navigate = (state: RoadOstUrlState): void => {
    const url = serializeRoadOstUrl(state, baseUrl());
    window.history.pushState({}, "", url);
    renderRoute();
  };

  const mountLanding = (): (() => void) => {
    rememberView("landing");
    document.title = "RoadOST | Your drive writes the score";
    document.body.classList.remove("studio-view");
    document.body.classList.add("landing-view");
    root.innerHTML = landingMarkup;

    const openStudio = (): void =>
      navigate({ view: "studio", sim: false, preset: null, demo: false });
    const playDemo = (): void =>
      navigate({
        view: "studio",
        sim: true,
        preset: "night-rain-highway",
        demo: true
      });

    const studioButtons = ["#nav-open-studio", "#hero-open-studio", "#footer-open-studio"];
    studioButtons.forEach((selector) =>
      root.querySelector<HTMLButtonElement>(selector)?.addEventListener("click", openStudio)
    );
    root.querySelector<HTMLButtonElement>("#hero-play-demo")?.addEventListener("click", playDemo);

    return () => undefined;
  };

  const mountStudio = (route: RoadOstUrlState): (() => void) => {
    rememberView("studio");
    document.title = "Drive Studio | RoadOST";
    document.body.classList.remove("landing-view");
    document.body.classList.add("studio-view");
    root.innerHTML = `
      <main class="studio-shell">
        <div id="controls-root" class="controls-column"></div>
        <div class="studio-data">
          <section class="viz-section studio-card">
            <div class="section-heading compact">
              <div><p class="eyebrow">Live road</p><h2>Horizon</h2></div>
              <span class="live-indicator"><i></i> Reactive</span>
            </div>
            <div id="viz-root"></div>
          </section>
          <section class="hud-section studio-card">
            <div class="section-heading compact">
              <div><p class="eyebrow">Signal map</p><h2>Drive state</h2></div>
            </div>
            <div id="hud-root"></div>
          </section>
        </div>
        <section id="recap-root" class="recap-panel studio-card" hidden></section>
        <footer class="studio-footer">RoadOST runs locally in this browser. Keep your eyes on the road and controls untouched while moving.</footer>
      </main>
    `;

    const controlsRoot = root.querySelector<HTMLElement>("#controls-root");
    const hudRoot = root.querySelector<HTMLElement>("#hud-root");
    const vizRoot = root.querySelector<HTMLElement>("#viz-root");
    const recapRoot = root.querySelector<HTMLElement>("#recap-root");
    if (!controlsRoot || !hudRoot || !vizRoot || !recapRoot) {
      throw new Error("Studio failed to mount required regions");
    }

    const simulator = new SimulatorController();
    const initialPreset: SimulatorPresetId | null = route.demo
      ? "night-rain-highway"
      : route.preset;
    if (initialPreset) {
      simulator.applyPreset(initialPreset);
    }

    const bus = new FeatureBus(simulator);
    let mapper = createMapper();
    const engine = new RoadOstEngine();
    const recorder = new DriveRecorder(engine.getCaptureStream());
    const tracker = new RecapTracker();
    const hud = new Hud(hudRoot);
    const visualizer = new Visualizer(vizRoot);
    const settings = readSettings();
    let latestFrame: FeatureFrame = simulator.getFeatureFrame(performance.now());
    let latestMix: MixState = mapper.update(latestFrame);
    let mode: BusMode = route.sim || route.demo || route.preset ? "sim" : "live";
    let running = false;
    let demoPending = route.demo;
    let missingGeoFrames = 0;
    let animationFrame = 0;
    let controls: ControlsHandle;

    const currentShareUrl = (): string =>
      serializeRoadOstUrl(
        {
          view: "studio",
          sim: mode === "sim",
          preset: mode === "sim" ? simulator.getState().presetId : null,
          demo: false
        },
        baseUrl()
      );

    const copyLink = async (): Promise<void> => {
      const copied = await writeClipboard(currentShareUrl());
      controls.setStatusText(copied ? "Drive link copied." : "Could not copy the drive link.");
    };

    const recapPanel = new RecapPanel(recapRoot, {
      onCopyLink: () => void copyLink(),
      onCopyText: (text) => {
        void writeClipboard(text).then((copied) =>
          controls.setStatusText(copied ? "Recap text copied." : "Could not copy recap text.")
        );
      }
    });

    const finishSession = (): void => {
      if (!running) {
        return;
      }
      const recap = tracker.finish(latestFrame, latestMix);
      persistRecap(recap);
      recapPanel.render(recap);
      running = false;
      recorder.stop();
      engine.stop();
      controls.setRunning(false);
      controls.setDriving(false);
      controls.setStatusText("Score stopped. Your recap is ready.");
      recapRoot.scrollIntoView({ behavior: settings.reducedMotion ? "auto" : "smooth", block: "start" });
    };

    const setMode = (nextMode: BusMode): void => {
      mode = nextMode;
      bus.setMode(nextMode);
      controls.setMode(nextMode);
      controls.setStatusText(
        nextMode === "sim" ? "Simulator mode active." : "Live sensor mode active."
      );
    };

    controls = createControls(
      controlsRoot,
      {
        onStart: () => {
          void (async () => {
            if (running) {
              return;
            }
            if (mode === "live") {
              const permission = await bus.requestMotionPermission();
              if (!permission) {
                controls.setStatusText("Motion permission denied. Continuing without motion.");
              }
            }
            try {
              await engine.start();
            } catch {
              controls.setStatusText("Audio could not start in this browser.");
              return;
            }
            mapper = createMapper();
            latestFrame = { ...latestFrame, t: performance.now() };
            latestMix = mapper.update(latestFrame);
            recorder.start();
            running = true;
            tracker.start(latestFrame, latestMix);
            controls.setRunning(true);
            controls.setStatusText("Score running. The road is writing.");
            if (demoPending) {
              demoPending = false;
              simulator.setTimelineSeconds(0);
              simulator.setTimelinePlaying(true);
              controls.setStatusText("Demo running. The 90 second road is moving.");
            }
          })();
        },
        onStop: finishSession,
        onSave: () => {
          void (async () => {
            const saved = await recorder.saveThisDriveAndRestart();
            if (!saved) {
              controls.setStatusText("No recording is available yet.");
              return;
            }
            const recap = tracker.snapshot(latestFrame, latestMix);
            persistRecap(recap);
            recapPanel.render(recap);
            controls.setStatusText("Drive audio saved. Recap updated.");
          })();
        },
        onBack: () => {
          if (running) {
            finishSession();
          }
          navigate({ view: "landing", sim: false, preset: null, demo: false });
        },
        onShare: () => void copyLink(),
        onModeChange: setMode,
        onMasterVolume: (value) => {
          settings.masterVolume = value;
          engine.updateSettings({ masterVolume: value });
          writeSettings(settings);
        },
        onHoldKey: (value) => {
          settings.holdKey = value;
          engine.updateSettings({ holdKey: value });
          writeSettings(settings);
        },
        onReducedMotion: (value) => {
          settings.reducedMotion = value;
          engine.updateSettings({ reducedMotion: value });
          visualizer.setReducedMotion(value);
          writeSettings(settings);
        },
        onPreset: (preset) => {
          simulator.applyPreset(preset);
          controls.syncSimulatorState(simulator.getState());
          controls.setStatusText(`${preset.replaceAll("-", " ")} loaded.`);
        },
        onSpeedMps: (value) => simulator.setSpeedMps(value),
        onRainMmHr: (value) => simulator.setRainMmHr(value),
        onLux: (value) => simulator.setLux(value),
        onHour: (value) => simulator.setHourLocal(value),
        onTimelineSecond: (value) => simulator.setTimelineSeconds(value),
        onTimelinePlaying: (value) => simulator.setTimelinePlaying(value),
        onTunnelBlast: () => simulator.triggerTunnelBlast()
      },
      settings
    );

    engine.updateSettings(settings);
    visualizer.setReducedMotion(settings.reducedMotion);
    controls.setMode(mode);
    controls.syncSimulatorState(simulator.getState());

    bus.start(mode);
    const unsubscribe = bus.subscribe((frame) => {
      latestFrame = frame;
      if (mode === "live" && frame.source.geo === "missing") {
        missingGeoFrames += 1;
      } else {
        missingGeoFrames = 0;
      }
      if (!route.sim && !route.demo && mode === "live" && missingGeoFrames > 40) {
        setMode("sim");
        controls.setStatusText("Geolocation unavailable. Switched to simulator.");
      }
    });

    const renderLoop = (): void => {
      latestMix = mapper.update(latestFrame);
      if (running) {
        engine.applyMix(latestMix);
        tracker.sample(latestFrame, latestMix);
      }
      controls.syncSimulatorState(simulator.getState());
      const driving = running && mode === "live" && (latestFrame.speedMps ?? 0) > 4;
      controls.setDriving(driving);
      hud.render(latestFrame, latestMix);
      visualizer.render(latestFrame, latestMix);
      animationFrame = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const keyboardHandler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.matches("input, textarea, select, button") || target?.isContentEditable === true;
      if (editing) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        controls.triggerTransport();
      } else if (/^Digit[1-9]$/.test(event.code) && mode === "sim") {
        controls.triggerPreset(Number(event.code.slice(-1)) - 1);
      } else if (event.key.toLowerCase() === "l") {
        setMode("live");
      } else if (event.key.toLowerCase() === "s") {
        setMode("sim");
      } else if (event.key === "Escape") {
        if (running) {
          finishSession();
        }
        navigate({ view: "landing", sim: false, preset: null, demo: false });
      }
    };
    window.addEventListener("keydown", keyboardHandler);

    let dismissOnboarding: (() => void) | null = null;
    try {
      if (localStorage.getItem(ONBOARDING_KEY) !== "done") {
        const onboarding = document.createElement("section");
        onboarding.className = "onboarding";
        onboarding.setAttribute("role", "dialog");
        onboarding.setAttribute("aria-modal", "true");
        onboarding.setAttribute("aria-labelledby", "onboarding-title");
        onboarding.innerHTML = `
          <div class="onboarding-card">
            <p class="eyebrow">First drive</p>
            <h2 id="onboarding-title">Three things, then road.</h2>
            <ol>
              <li><b>Choose Live or Simulator.</b><span>Live asks for available sensor permissions.</span></li>
              <li><b>Tap Start score.</b><span>Your tap unlocks browser audio.</span></li>
              <li><b>Put the phone down.</b><span>The mix adapts without more input.</span></li>
            </ol>
            <button id="dismiss-onboarding" class="primary-cta" type="button">Enter the studio</button>
          </div>
        `;
        document.body.appendChild(onboarding);
        const close = (): void => {
          localStorage.setItem(ONBOARDING_KEY, "done");
          onboarding.remove();
        };
        onboarding
          .querySelector<HTMLButtonElement>("#dismiss-onboarding")
          ?.addEventListener("click", close);
        dismissOnboarding = () => onboarding.remove();
      }
    } catch {
      // Onboarding storage is optional.
    }

    return () => {
      if (running) {
        recorder.stop();
      }
      dismissOnboarding?.();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", keyboardHandler);
      unsubscribe();
      engine.dispose();
      bus.stop();
    };
  };

  const renderRoute = (): void => {
    disposeView();
    const route = parseRoadOstUrl(window.location.href);
    disposeView = route.view === "studio" ? mountStudio(route) : mountLanding();
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const popHandler = (): void => renderRoute();
  window.addEventListener("popstate", popHandler);
  window.addEventListener("hashchange", popHandler);
  window.addEventListener("beforeunload", () => disposeView(), { once: true });
  renderRoute();
};
