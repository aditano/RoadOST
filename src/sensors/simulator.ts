import { clamp, clamp01 } from "../mapping/features";
import type { FeatureFrame, WeatherFrame } from "./types";

export type SimulatorPresetId =
  | "night-rain-highway"
  | "sunny-neighborhood"
  | "dawn-commute"
  | "tunnel-blast"
  | "storm-crawl"
  | "midnight-city"
  | "mountain-descent"
  | "heatwave"
  | "blizzard"
  | "late-ferry";

export const SIMULATOR_PRESET_IDS: readonly SimulatorPresetId[] = [
  "night-rain-highway",
  "sunny-neighborhood",
  "dawn-commute",
  "tunnel-blast",
  "storm-crawl",
  "midnight-city",
  "mountain-descent",
  "heatwave",
  "blizzard",
  "late-ferry"
];

export type SimulatorState = {
  speedMps: number;
  accelMps2: number;
  headingDeg: number;
  headingRate: number;
  lux: number;
  hourLocal: number;
  precipMmHr: number;
  cloud: number;
  tempC: number;
  weatherCode: number;
  windMps: number;
  visibility: number;
  presetId: SimulatorPresetId;
  timelineSec: number;
  timelinePlaying: boolean;
};

type PresetDefinition = {
  speedMps: number;
  accelMps2: number;
  headingDeg: number;
  headingRate: number;
  lux: number;
  hourLocal: number;
  precipMmHr: number;
  cloud: number;
  tempC: number;
  weatherCode: number;
  windMps: number;
  visibility: number;
};

const SIM_TIMELINE_SECONDS = 90;

const PRESETS: Record<SimulatorPresetId, PresetDefinition> = {
  "night-rain-highway": {
    speedMps: 31.3,
    accelMps2: 1.8,
    headingDeg: 250,
    headingRate: 2,
    lux: 40,
    hourLocal: 22.5,
    precipMmHr: 5.8,
    cloud: 0.95,
    tempC: 8,
    weatherCode: 82,
    windMps: 13,
    visibility: 2400
  },
  "sunny-neighborhood": {
    speedMps: 11.2,
    accelMps2: 0.45,
    headingDeg: 100,
    headingRate: 8,
    lux: 28000,
    hourLocal: 13.5,
    precipMmHr: 0,
    cloud: 0.1,
    tempC: 24,
    weatherCode: 0,
    windMps: 2,
    visibility: 24000
  },
  "dawn-commute": {
    speedMps: 21,
    accelMps2: 0.9,
    headingDeg: 80,
    headingRate: 12,
    lux: 4200,
    hourLocal: 6.5,
    precipMmHr: 0.1,
    cloud: 0.35,
    tempC: 14,
    weatherCode: 2,
    windMps: 5,
    visibility: 18000
  },
  "tunnel-blast": {
    speedMps: 26.8,
    accelMps2: 1.2,
    headingDeg: 190,
    headingRate: 3,
    lux: 16000,
    hourLocal: 15,
    precipMmHr: 0,
    cloud: 0.2,
    tempC: 19,
    weatherCode: 1,
    windMps: 4,
    visibility: 14000
  },
  "storm-crawl": {
    speedMps: 6.7,
    accelMps2: 0.5,
    headingDeg: 320,
    headingRate: 18,
    lux: 350,
    hourLocal: 19.2,
    precipMmHr: 3.4,
    cloud: 1,
    tempC: 10,
    weatherCode: 95,
    windMps: 16,
    visibility: 1100
  },
  "midnight-city": {
    speedMps: 19.5,
    accelMps2: 1.35,
    headingDeg: 35,
    headingRate: 24,
    lux: 180,
    hourLocal: 0.5,
    precipMmHr: 0,
    cloud: 0.3,
    tempC: 16,
    weatherCode: 1,
    windMps: 4.5,
    visibility: 18000
  },
  "mountain-descent": {
    speedMps: 24,
    accelMps2: 1.7,
    headingDeg: 145,
    headingRate: 42,
    lux: 7500,
    hourLocal: 17.8,
    precipMmHr: 0.2,
    cloud: 0.4,
    tempC: 9,
    weatherCode: 2,
    windMps: 9,
    visibility: 12000
  },
  heatwave: {
    speedMps: 28.5,
    accelMps2: 1.1,
    headingDeg: 270,
    headingRate: 6,
    lux: 22000,
    hourLocal: 18.6,
    precipMmHr: 0,
    cloud: 0.05,
    tempC: 38,
    weatherCode: 0,
    windMps: 3,
    visibility: 28000
  },
  blizzard: {
    speedMps: 14,
    accelMps2: 1.15,
    headingDeg: 10,
    headingRate: 14,
    lux: 480,
    hourLocal: 15.2,
    precipMmHr: 3.1,
    cloud: 1,
    tempC: -8,
    weatherCode: 75,
    windMps: 19,
    visibility: 320
  },
  "late-ferry": {
    speedMps: 7.4,
    accelMps2: 0.18,
    headingDeg: 60,
    headingRate: 1,
    lux: 55,
    hourLocal: 23.4,
    precipMmHr: 0.25,
    cloud: 0.72,
    tempC: 11,
    weatherCode: 51,
    windMps: 11,
    visibility: 7000
  }
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const envelope = (
  sec: number,
  points: Array<{ t: number; v: number }>
): number => {
  if (points.length === 0) {
    return 0;
  }

  const clampedSec = clamp(sec, 0, SIM_TIMELINE_SECONDS);
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    if (!left || !right) {
      continue;
    }
    if (clampedSec >= left.t && clampedSec <= right.t) {
      const pct = (clampedSec - left.t) / Math.max(0.00001, right.t - left.t);
      return lerp(left.v, right.v, pct);
    }
  }
  const fallback = points[points.length - 1];
  return fallback ? fallback.v : 0;
};

const timelineWeatherCode = (rainMmHr: number): number => {
  if (rainMmHr >= 3.5) {
    return 81;
  }
  if (rainMmHr >= 1.2) {
    return 63;
  }
  if (rainMmHr > 0.15) {
    return 51;
  }
  return 1;
};

export class SimulatorController {
  private state: SimulatorState = {
    ...PRESETS["night-rain-highway"],
    presetId: "night-rain-highway",
    timelineSec: 0,
    timelinePlaying: false
  };
  private tunnelLuxOverride: { activeUntilMs: number; preLux: number } | null = null;
  private lastFrameTimeMs = performance.now();

  getState(): SimulatorState {
    return { ...this.state };
  }

  listPresetIds(): SimulatorPresetId[] {
    return [...SIMULATOR_PRESET_IDS];
  }

  applyPreset(id: SimulatorPresetId): void {
    const preset = PRESETS[id];
    this.state = {
      ...this.state,
      ...preset,
      presetId: id
    };
    if (id === "tunnel-blast") {
      this.triggerTunnelBlast();
    }
  }

  setSpeedMps(value: number): void {
    this.state.speedMps = clamp(value, 0, 40);
  }

  setRainMmHr(value: number): void {
    this.state.precipMmHr = clamp(value, 0, 8);
    this.state.weatherCode = timelineWeatherCode(this.state.precipMmHr);
  }

  setLux(value: number): void {
    this.state.lux = clamp(value, 0, 40000);
  }

  setHourLocal(value: number): void {
    this.state.hourLocal = clamp(value, 0, 23.99);
  }

  setTimelineSeconds(value: number): void {
    this.state.timelineSec = clamp(value, 0, SIM_TIMELINE_SECONDS);
    this.applyTimeline(this.state.timelineSec);
  }

  setTimelinePlaying(value: boolean): void {
    this.state.timelinePlaying = value;
    this.lastFrameTimeMs = performance.now();
  }

  triggerTunnelBlast(): void {
    this.tunnelLuxOverride = {
      activeUntilMs: performance.now() + 1200,
      preLux: Math.max(1200, this.state.lux)
    };
  }

  getFeatureFrame(nowMs: number): FeatureFrame {
    this.advanceTimeline(nowMs);

    const weather = this.getWeatherFrame();
    const lux = this.getEffectiveLux(nowMs);

    return {
      t: nowMs,
      speedMps: this.state.speedMps,
      accelMps2: this.state.accelMps2,
      headingDeg: this.state.headingDeg,
      headingRate: this.state.headingRate,
      lux,
      hourLocal: this.state.hourLocal,
      weather,
      source: {
        geo: "sim",
        motion: "sim",
        light: "sim",
        weather: "sim"
      }
    };
  }

  private getWeatherFrame(): WeatherFrame {
    return {
      code: this.state.weatherCode,
      precipMmHr: this.state.precipMmHr,
      cloud: clamp01(this.state.cloud),
      tempC: this.state.tempC,
      isNight: this.state.hourLocal < 5 || this.state.hourLocal >= 21,
      windMps: this.state.windMps,
      visibility: this.state.visibility
    };
  }

  private getEffectiveLux(nowMs: number): number {
    if (!this.tunnelLuxOverride) {
      return this.state.lux;
    }

    if (nowMs >= this.tunnelLuxOverride.activeUntilMs) {
      this.state.lux = this.tunnelLuxOverride.preLux;
      this.tunnelLuxOverride = null;
      return this.state.lux;
    }

    return Math.max(10, this.tunnelLuxOverride.preLux * 0.08);
  }

  private advanceTimeline(nowMs: number): void {
    const dtSec = Math.max(0, (nowMs - this.lastFrameTimeMs) / 1000);
    this.lastFrameTimeMs = nowMs;
    if (!this.state.timelinePlaying) {
      return;
    }

    this.state.timelineSec += dtSec;
    if (this.state.timelineSec >= SIM_TIMELINE_SECONDS) {
      this.state.timelineSec = SIM_TIMELINE_SECONDS;
      this.state.timelinePlaying = false;
    }

    this.applyTimeline(this.state.timelineSec);
  }

  private applyTimeline(sec: number): void {
    const speed = envelope(sec, [
      { t: 0, v: 31.3 },
      { t: 16, v: 25 },
      { t: 30, v: 12 },
      { t: 48, v: 27 },
      { t: 60, v: 9 },
      { t: 78, v: 33 },
      { t: 90, v: 17 }
    ]);
    const rain = envelope(sec, [
      { t: 0, v: 5.8 },
      { t: 20, v: 3.2 },
      { t: 36, v: 0.3 },
      { t: 56, v: 0 },
      { t: 76, v: 4.4 },
      { t: 90, v: 0.8 }
    ]);
    const lux = envelope(sec, [
      { t: 0, v: 40 },
      { t: 26, v: 500 },
      { t: 40, v: 12000 },
      { t: 52, v: 80 },
      { t: 67, v: 9000 },
      { t: 90, v: 3500 }
    ]);
    const hour = envelope(sec, [
      { t: 0, v: 22.5 },
      { t: 26, v: 23.2 },
      { t: 52, v: 1.5 },
      { t: 90, v: 6.2 }
    ]);
    const accel = envelope(sec, [
      { t: 0, v: 0.4 },
      { t: 28, v: 1.8 },
      { t: 52, v: 0.2 },
      { t: 68, v: 1.4 },
      { t: 90, v: 0.8 }
    ]);

    this.state.speedMps = speed;
    this.state.precipMmHr = rain;
    this.state.weatherCode = timelineWeatherCode(rain);
    this.state.lux = lux;
    this.state.hourLocal = hour % 24;
    this.state.accelMps2 = accel;
    this.state.headingRate = clamp(4 + Math.abs(accel) * 12, 0, 90);
    this.state.windMps = 3 + rain * 2.2;
    this.state.visibility = Math.max(700, 24000 - rain * 4200);
    this.state.cloud = clamp01(rain > 0.5 ? 0.85 : rain > 0.1 ? 0.5 : 0.2);
  }
}

export const SIM_TIMELINE_DURATION_SECONDS = SIM_TIMELINE_SECONDS;
