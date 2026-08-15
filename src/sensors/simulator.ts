import { clamp, clamp01 } from "../mapping/features";
import type { FeatureFrame, WeatherFrame } from "./types";

export type SimulatorPresetId =
  | "night-rain-highway"
  | "sunny-neighborhood"
  | "dawn-commute"
  | "tunnel-blast"
  | "storm-crawl";

export type SimulatorState = {
  speedMps: number;
  accelMps2: number;
  headingDeg: number;
  lux: number;
  hourLocal: number;
  precipMmHr: number;
  cloud: number;
  tempC: number;
  weatherCode: number;
  timelineSec: number;
  timelinePlaying: boolean;
};

type PresetDefinition = {
  speedMps: number;
  accelMps2: number;
  headingDeg: number;
  lux: number;
  hourLocal: number;
  precipMmHr: number;
  cloud: number;
  tempC: number;
  weatherCode: number;
};

const SIM_TIMELINE_SECONDS = 90;

const PRESETS: Record<SimulatorPresetId, PresetDefinition> = {
  "night-rain-highway": {
    speedMps: 31.3,
    accelMps2: 1.8,
    headingDeg: 250,
    lux: 40,
    hourLocal: 22.5,
    precipMmHr: 5.8,
    cloud: 0.95,
    tempC: 8,
    weatherCode: 82
  },
  "sunny-neighborhood": {
    speedMps: 11.2,
    accelMps2: 0.45,
    headingDeg: 100,
    lux: 28000,
    hourLocal: 13.5,
    precipMmHr: 0,
    cloud: 0.1,
    tempC: 24,
    weatherCode: 0
  },
  "dawn-commute": {
    speedMps: 21,
    accelMps2: 0.9,
    headingDeg: 80,
    lux: 4200,
    hourLocal: 6.5,
    precipMmHr: 0.1,
    cloud: 0.35,
    tempC: 14,
    weatherCode: 2
  },
  "tunnel-blast": {
    speedMps: 26.8,
    accelMps2: 1.2,
    headingDeg: 190,
    lux: 16000,
    hourLocal: 15,
    precipMmHr: 0,
    cloud: 0.2,
    tempC: 19,
    weatherCode: 1
  },
  "storm-crawl": {
    speedMps: 6.7,
    accelMps2: 0.5,
    headingDeg: 320,
    lux: 350,
    hourLocal: 19.2,
    precipMmHr: 3.4,
    cloud: 1,
    tempC: 10,
    weatherCode: 95
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
    timelineSec: 0,
    timelinePlaying: false
  };
  private tunnelLuxOverride: { activeUntilMs: number; preLux: number } | null = null;
  private lastFrameTimeMs = performance.now();

  getState(): SimulatorState {
    return { ...this.state };
  }

  listPresetIds(): SimulatorPresetId[] {
    return Object.keys(PRESETS) as SimulatorPresetId[];
  }

  applyPreset(id: SimulatorPresetId): void {
    const preset = PRESETS[id];
    this.state = {
      ...this.state,
      ...preset
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
      isNight: this.state.hourLocal < 5 || this.state.hourLocal >= 21
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
      { t: 0, v: 8 },
      { t: 16, v: 20 },
      { t: 30, v: 31 },
      { t: 48, v: 12 },
      { t: 60, v: 26 },
      { t: 78, v: 33 },
      { t: 90, v: 17 }
    ]);
    const rain = envelope(sec, [
      { t: 0, v: 0 },
      { t: 20, v: 1.2 },
      { t: 36, v: 4.8 },
      { t: 56, v: 2.1 },
      { t: 76, v: 0.3 },
      { t: 90, v: 0.8 }
    ]);
    const lux = envelope(sec, [
      { t: 0, v: 25000 },
      { t: 26, v: 14000 },
      { t: 40, v: 600 },
      { t: 52, v: 80 },
      { t: 67, v: 9000 },
      { t: 90, v: 18000 }
    ]);
    const hour = envelope(sec, [
      { t: 0, v: 15.4 },
      { t: 26, v: 18.2 },
      { t: 52, v: 21.5 },
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
    this.state.cloud = clamp01(rain > 0.5 ? 0.85 : rain > 0.1 ? 0.5 : 0.2);
  }
}

export const SIM_TIMELINE_DURATION_SECONDS = SIM_TIMELINE_SECONDS;
