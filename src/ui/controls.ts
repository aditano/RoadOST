import type { BusMode } from "../sensors/bus";
import {
  SIM_TIMELINE_DURATION_SECONDS,
  SIMULATOR_PRESET_IDS,
  type SimulatorPresetId,
  type SimulatorState
} from "../sensors/simulator";

export type StudioSettings = {
  masterVolume: number;
  holdKey: boolean;
  reducedMotion: boolean;
};

export type ControlsCallbacks = {
  onStart: () => void;
  onStop: () => void;
  onSave: () => void;
  onBack: () => void;
  onShare: () => void;
  onModeChange: (mode: BusMode) => void;
  onMasterVolume: (value: number) => void;
  onHoldKey: (value: boolean) => void;
  onReducedMotion: (value: boolean) => void;
  onPreset: (presetId: SimulatorPresetId) => void;
  onSpeedMps: (value: number) => void;
  onRainMmHr: (value: number) => void;
  onLux: (value: number) => void;
  onHour: (value: number) => void;
  onTimelineSecond: (value: number) => void;
  onTimelinePlaying: (value: boolean) => void;
  onTunnelBlast: () => void;
};

export type ControlsHandle = {
  setRunning: (running: boolean) => void;
  setDriving: (driving: boolean) => void;
  setMode: (mode: BusMode) => void;
  setStatusText: (text: string) => void;
  syncSimulatorState: (state: SimulatorState) => void;
  triggerTransport: () => void;
  triggerPreset: (index: number) => void;
};

export const PRESET_LABELS: Array<{ id: SimulatorPresetId; label: string; note: string }> = [
  { id: "night-rain-highway", label: "Night rain highway", note: "Fast, wet, dark" },
  { id: "sunny-neighborhood", label: "Sunny neighborhood", note: "Clear, easy pulse" },
  { id: "dawn-commute", label: "Dawn commute", note: "Rising road energy" },
  { id: "tunnel-blast", label: "Tunnel blast", note: "Light-drop break" },
  { id: "storm-crawl", label: "Storm crawl", note: "Thunder and tension" },
  { id: "midnight-city", label: "Midnight city", note: "Neon turns" },
  { id: "mountain-descent", label: "Mountain descent", note: "Fast switchbacks" },
  { id: "heatwave", label: "Heatwave", note: "Gold-hour drive" },
  { id: "blizzard", label: "Blizzard", note: "Whiteout and wind" },
  { id: "late-ferry", label: "Late ferry", note: "Slow dark water" }
];

const formatSimValue = (value: number, digits = 1): string => value.toFixed(digits);

export const createControls = (
  container: HTMLElement,
  callbacks: ControlsCallbacks,
  settings: StudioSettings
): ControlsHandle => {
  container.innerHTML = `
    <header class="studio-header">
      <button id="back-home" class="back-link" type="button" aria-label="Back to landing page">← Home</button>
      <a class="studio-wordmark" href="${import.meta.env.BASE_URL}" aria-label="RoadOST home">Road<span>OST</span></a>
      <p>Drive studio</p>
    </header>

    <section class="mode-panel control-card">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">Input</p>
          <h2>Choose your road</h2>
        </div>
        <div class="mode-row" role="group" aria-label="Input mode">
          <button class="mode-btn" data-mode="live" type="button"><span class="mode-dot"></span>Live</button>
          <button class="mode-btn" data-mode="sim" type="button"><span class="mode-dot"></span>Simulator</button>
        </div>
      </div>
      <p class="status-line" id="status-line" aria-live="polite">Ready for the road.</p>
    </section>

    <section class="transport control-card">
      <button id="transport-score" class="transport-button" type="button">
        <span class="transport-icon" aria-hidden="true">▶</span>
        <span class="transport-copy"><b>Start score</b><small>Audio begins on your tap</small></span>
      </button>
      <div class="session-actions">
        <button id="save-drive" class="secondary-button" type="button">Save this drive</button>
        <button id="share-drive" class="secondary-button" type="button">Copy drive link</button>
      </div>
    </section>

    <section class="sim-panel control-card" id="sim-panel">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">Simulator</p>
          <h2>Put the score somewhere</h2>
        </div>
        <span class="key-hint">Keys 1–9</span>
      </div>
      <div class="preset-grid">
        ${PRESET_LABELS.map(
          (preset, index) => `
            <button type="button" class="preset-btn" data-preset="${preset.id}">
              <span>${index < 9 ? index + 1 : ""}</span>
              <b>${preset.label}</b>
              <small>${preset.note}</small>
            </button>`
        ).join("")}
      </div>

      <div class="sim-sliders">
        <label><span>Speed <b id="speed-value"></b></span>
          <input id="sim-speed" type="range" min="0" max="40" step="0.1" />
        </label>
        <label><span>Rain <b id="rain-value"></b></span>
          <input id="sim-rain" type="range" min="0" max="8" step="0.1" />
        </label>
        <label><span>Light <b id="lux-value"></b></span>
          <input id="sim-lux" type="range" min="0" max="40000" step="100" />
        </label>
        <label><span>Hour <b id="hour-value"></b></span>
          <input id="sim-hour" type="range" min="0" max="23.9" step="0.1" />
        </label>
      </div>

      <div class="timeline-control">
        <div class="timeline-label"><span>90 second drive</span><b id="timeline-value"></b></div>
        <input id="sim-timeline" type="range" min="0" max="${SIM_TIMELINE_DURATION_SECONDS}" step="0.1" />
        <div class="sim-actions">
          <button id="timeline-play" type="button">Play timeline</button>
          <button id="tunnel-trigger" type="button">Trigger tunnel</button>
        </div>
      </div>
    </section>

    <details class="settings control-card" id="settings-panel">
      <summary>
        <span><span class="eyebrow">Audio and display</span><b>Settings</b></span>
        <span class="summary-plus" aria-hidden="true">+</span>
      </summary>
      <div class="settings-content">
        <label><span>Master volume</span><input id="master-volume" type="range" min="0" max="1" step="0.01" value="${settings.masterVolume}" /></label>
        <label class="check-row"><span><b>Hold key</b><small>Keep one tonal center for the session</small></span><input id="hold-key" type="checkbox" ${settings.holdKey ? "checked" : ""} /></label>
        <label class="check-row"><span><b>Reduced motion</b><small>Stop road and rain animation</small></span><input id="reduced-motion" type="checkbox" ${settings.reducedMotion ? "checked" : ""} /></label>
      </div>
    </details>
  `;

  const required = <T extends Element>(selector: string): T => {
    const element = container.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Controls failed to mount ${selector}`);
    }
    return element;
  };

  const transportButton = required<HTMLButtonElement>("#transport-score");
  const transportIcon = required<HTMLElement>(".transport-icon");
  const transportTitle = required<HTMLElement>(".transport-copy b");
  const transportDetail = required<HTMLElement>(".transport-copy small");
  const saveButton = required<HTMLButtonElement>("#save-drive");
  const shareButton = required<HTMLButtonElement>("#share-drive");
  const modeButtons = container.querySelectorAll<HTMLButtonElement>(".mode-btn");
  const simPanel = required<HTMLElement>("#sim-panel");
  const statusLine = required<HTMLElement>("#status-line");
  const masterVolumeInput = required<HTMLInputElement>("#master-volume");
  const holdKeyInput = required<HTMLInputElement>("#hold-key");
  const reducedMotionInput = required<HTMLInputElement>("#reduced-motion");
  const speedInput = required<HTMLInputElement>("#sim-speed");
  const rainInput = required<HTMLInputElement>("#sim-rain");
  const luxInput = required<HTMLInputElement>("#sim-lux");
  const hourInput = required<HTMLInputElement>("#sim-hour");
  const timelineInput = required<HTMLInputElement>("#sim-timeline");
  const timelineButton = required<HTMLButtonElement>("#timeline-play");
  const speedValue = required<HTMLElement>("#speed-value");
  const rainValue = required<HTMLElement>("#rain-value");
  const luxValue = required<HTMLElement>("#lux-value");
  const hourValue = required<HTMLElement>("#hour-value");
  const timelineValue = required<HTMLElement>("#timeline-value");

  let runningState = false;
  let drivingLock = false;

  const triggerTransport = (): void => {
    if (runningState) {
      callbacks.onStop();
    } else {
      callbacks.onStart();
    }
  };

  transportButton.addEventListener("click", triggerTransport);
  saveButton.addEventListener("click", callbacks.onSave);
  shareButton.addEventListener("click", callbacks.onShare);
  required<HTMLButtonElement>("#back-home").addEventListener("click", callbacks.onBack);

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      callbacks.onModeChange(button.dataset.mode === "live" ? "live" : "sim");
    });
  }

  masterVolumeInput.addEventListener("input", () =>
    callbacks.onMasterVolume(Number(masterVolumeInput.value))
  );
  holdKeyInput.addEventListener("change", () => callbacks.onHoldKey(holdKeyInput.checked));
  reducedMotionInput.addEventListener("change", () =>
    callbacks.onReducedMotion(reducedMotionInput.checked)
  );

  container.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.preset as SimulatorPresetId | undefined;
      if (id) {
        callbacks.onPreset(id);
      }
    });
  });

  speedInput.addEventListener("input", () => callbacks.onSpeedMps(Number(speedInput.value)));
  rainInput.addEventListener("input", () => callbacks.onRainMmHr(Number(rainInput.value)));
  luxInput.addEventListener("input", () => callbacks.onLux(Number(luxInput.value)));
  hourInput.addEventListener("input", () => callbacks.onHour(Number(hourInput.value)));
  timelineInput.addEventListener("input", () =>
    callbacks.onTimelineSecond(Number(timelineInput.value))
  );
  timelineButton.addEventListener("click", () =>
    callbacks.onTimelinePlaying(timelineButton.dataset.playing !== "true")
  );
  required<HTMLButtonElement>("#tunnel-trigger").addEventListener(
    "click",
    callbacks.onTunnelBlast
  );

  const setRunning = (running: boolean): void => {
    runningState = running;
    transportButton.classList.toggle("is-running", running);
    transportIcon.textContent = running ? "■" : "▶";
    transportTitle.textContent = running ? "Stop score" : "Start score";
    transportDetail.textContent = running ? "End drive and open recap" : "Audio begins on your tap";
    saveButton.disabled = !running || drivingLock;
  };

  const setDriving = (driving: boolean): void => {
    drivingLock = driving;
    container.closest(".studio-shell")?.classList.toggle("driving-lock", driving);
    modeButtons.forEach((button) => {
      button.disabled = driving;
    });
    saveButton.disabled = !runningState || driving;
    shareButton.disabled = driving;
  };

  const setMode = (mode: BusMode): void => {
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    simPanel.classList.toggle("disabled", mode !== "sim");
  };

  const setStatusText = (text: string): void => {
    statusLine.textContent = text;
  };

  const syncSimulatorState = (state: SimulatorState): void => {
    speedInput.value = state.speedMps.toString();
    rainInput.value = state.precipMmHr.toString();
    luxInput.value = state.lux.toString();
    hourInput.value = state.hourLocal.toString();
    timelineInput.value = state.timelineSec.toString();
    speedValue.textContent = `${formatSimValue(state.speedMps * 2.23694, 0)} mph`;
    rainValue.textContent = `${formatSimValue(state.precipMmHr, 1)} mm/h`;
    luxValue.textContent = `${formatSimValue(state.lux, 0)} lux`;
    hourValue.textContent = formatSimValue(state.hourLocal, 1);
    timelineValue.textContent = `${formatSimValue(state.timelineSec, 0)}s`;
    timelineButton.dataset.playing = state.timelinePlaying ? "true" : "false";
    timelineButton.textContent = state.timelinePlaying ? "Pause timeline" : "Play timeline";
    container.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === state.presetId);
    });
  };

  const triggerPreset = (index: number): void => {
    const preset = SIMULATOR_PRESET_IDS[index];
    if (preset) {
      callbacks.onPreset(preset);
    }
  };

  setRunning(false);
  return {
    setRunning,
    setDriving,
    setMode,
    setStatusText,
    syncSimulatorState,
    triggerTransport,
    triggerPreset
  };
};
