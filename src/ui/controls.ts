import type { BusMode } from "../sensors/bus";
import type { SimulatorPresetId, SimulatorState } from "../sensors/simulator";
import { SIM_TIMELINE_DURATION_SECONDS } from "../sensors/simulator";

export type ControlsCallbacks = {
  onStart: () => void;
  onStop: () => void;
  onSave: () => void;
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
};

const PRESET_LABELS: Array<{ id: SimulatorPresetId; label: string }> = [
  { id: "night-rain-highway", label: "Night rain highway" },
  { id: "sunny-neighborhood", label: "Sunny neighborhood" },
  { id: "dawn-commute", label: "Dawn commute" },
  { id: "tunnel-blast", label: "Tunnel blast" },
  { id: "storm-crawl", label: "Storm crawl" }
];

const formatSimValue = (value: number, digits = 1): string => value.toFixed(digits);

export const createControls = (
  container: HTMLElement,
  callbacks: ControlsCallbacks
): ControlsHandle => {
  container.innerHTML = `
    <section class="topbar">
      <div class="wordmark">RoadOST</div>
      <p class="tagline">Your drive writes the score.</p>
      <div class="mode-row">
        <button class="mode-btn" data-mode="live" type="button">Live sensors</button>
        <button class="mode-btn" data-mode="sim" type="button">Simulator</button>
      </div>
      <p class="status-line" id="status-line">Ready.</p>
    </section>
    <section class="transport">
      <button id="start-score" class="cta start" type="button">Start score</button>
      <button id="stop-score" class="cta stop" type="button">Stop</button>
      <button id="save-drive" class="save-btn" type="button">Save this drive</button>
    </section>
    <section class="settings" id="settings-panel">
      <h2>Settings</h2>
      <label>Master volume <input id="master-volume" type="range" min="0" max="1" step="0.01" value="0.85" /></label>
      <label><input id="hold-key" type="checkbox" /> Hold key</label>
      <label><input id="reduced-motion" type="checkbox" /> Reduced motion</label>
    </section>
    <section class="sim-panel" id="sim-panel">
      <h2>Simulator</h2>
      <div class="preset-grid">
        ${PRESET_LABELS.map(
          (preset) =>
            `<button type="button" class="preset-btn" data-preset="${preset.id}">${preset.label}</button>`
        ).join("")}
      </div>
      <label>Speed (m/s) <span id="speed-value"></span>
        <input id="sim-speed" type="range" min="0" max="40" step="0.1" />
      </label>
      <label>Rain (mm/h) <span id="rain-value"></span>
        <input id="sim-rain" type="range" min="0" max="8" step="0.1" />
      </label>
      <label>Light (lux) <span id="lux-value"></span>
        <input id="sim-lux" type="range" min="0" max="40000" step="100" />
      </label>
      <label>Hour <span id="hour-value"></span>
        <input id="sim-hour" type="range" min="0" max="23.9" step="0.1" />
      </label>
      <label>Timeline (90s) <span id="timeline-value"></span>
        <input id="sim-timeline" type="range" min="0" max="${SIM_TIMELINE_DURATION_SECONDS}" step="0.1" />
      </label>
      <div class="sim-actions">
        <button id="timeline-play" type="button">Play timeline</button>
        <button id="tunnel-trigger" type="button">Trigger tunnel</button>
      </div>
    </section>
  `;

  const startBtn = container.querySelector<HTMLButtonElement>("#start-score");
  const stopBtn = container.querySelector<HTMLButtonElement>("#stop-score");
  const saveBtn = container.querySelector<HTMLButtonElement>("#save-drive");
  const modeButtons = container.querySelectorAll<HTMLButtonElement>(".mode-btn");
  const settingsPanel = container.querySelector<HTMLElement>("#settings-panel");
  const simPanel = container.querySelector<HTMLElement>("#sim-panel");
  const statusLine = container.querySelector<HTMLElement>("#status-line");

  const masterVolumeInput = container.querySelector<HTMLInputElement>("#master-volume");
  const holdKeyInput = container.querySelector<HTMLInputElement>("#hold-key");
  const reducedMotionInput = container.querySelector<HTMLInputElement>("#reduced-motion");

  const speedInput = container.querySelector<HTMLInputElement>("#sim-speed");
  const rainInput = container.querySelector<HTMLInputElement>("#sim-rain");
  const luxInput = container.querySelector<HTMLInputElement>("#sim-lux");
  const hourInput = container.querySelector<HTMLInputElement>("#sim-hour");
  const timelineInput = container.querySelector<HTMLInputElement>("#sim-timeline");
  const timelineButton = container.querySelector<HTMLButtonElement>("#timeline-play");
  const tunnelButton = container.querySelector<HTMLButtonElement>("#tunnel-trigger");
  const speedValue = container.querySelector<HTMLElement>("#speed-value");
  const rainValue = container.querySelector<HTMLElement>("#rain-value");
  const luxValue = container.querySelector<HTMLElement>("#lux-value");
  const hourValue = container.querySelector<HTMLElement>("#hour-value");
  const timelineValue = container.querySelector<HTMLElement>("#timeline-value");

  if (
    !startBtn ||
    !stopBtn ||
    !saveBtn ||
    !settingsPanel ||
    !simPanel ||
    !statusLine ||
    !masterVolumeInput ||
    !holdKeyInput ||
    !reducedMotionInput ||
    !speedInput ||
    !rainInput ||
    !luxInput ||
    !hourInput ||
    !timelineInput ||
    !timelineButton ||
    !tunnelButton ||
    !speedValue ||
    !rainValue ||
    !luxValue ||
    !hourValue ||
    !timelineValue
  ) {
    throw new Error("Controls failed to mount.");
  }

  startBtn.addEventListener("click", callbacks.onStart);
  stopBtn.addEventListener("click", callbacks.onStop);
  saveBtn.addEventListener("click", callbacks.onSave);

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode === "live" ? "live" : "sim";
      callbacks.onModeChange(mode);
    });
  }

  masterVolumeInput.addEventListener("input", () => {
    callbacks.onMasterVolume(Number(masterVolumeInput.value));
  });
  holdKeyInput.addEventListener("change", () => callbacks.onHoldKey(holdKeyInput.checked));
  reducedMotionInput.addEventListener("change", () => {
    callbacks.onReducedMotion(reducedMotionInput.checked);
  });

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
  timelineInput.addEventListener("input", () => callbacks.onTimelineSecond(Number(timelineInput.value)));
  timelineButton.addEventListener("click", () => {
    callbacks.onTimelinePlaying(timelineButton.dataset.playing !== "true");
  });
  tunnelButton.addEventListener("click", callbacks.onTunnelBlast);

  const setRunning = (running: boolean): void => {
    runningState = running;
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    saveBtn.disabled = !running || drivingLock;
  };

  const setDriving = (driving: boolean): void => {
    drivingLock = driving;
    settingsPanel.classList.toggle("hidden-while-driving", driving);
    simPanel.classList.toggle("hidden-while-driving", driving);
    modeButtons.forEach((button) => {
      button.disabled = driving;
    });
    saveBtn.disabled = !runningState || driving;
  };

  const setMode = (mode: BusMode): void => {
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
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

    speedValue.textContent = formatSimValue(state.speedMps, 1);
    rainValue.textContent = formatSimValue(state.precipMmHr, 1);
    luxValue.textContent = formatSimValue(state.lux, 0);
    hourValue.textContent = formatSimValue(state.hourLocal, 1);
    timelineValue.textContent = formatSimValue(state.timelineSec, 1);
    timelineButton.dataset.playing = state.timelinePlaying ? "true" : "false";
    timelineButton.textContent = state.timelinePlaying ? "Pause timeline" : "Play timeline";
  };

  let runningState = false;
  let drivingLock = false;
  setRunning(false);

  return {
    setRunning,
    setDriving,
    setMode,
    setStatusText,
    syncSimulatorState
  };
};
