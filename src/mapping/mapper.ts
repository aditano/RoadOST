import type { FeatureFrame, MixState } from "../sensors/types";
import {
  brightnessFromFrame,
  clamp01,
  lerp,
  normalizedAccel,
  normalizedSpeed,
  paletteFromHour,
  rainFromWeather,
  smoothstep
} from "./features";

const ATTACK_SECONDS = 0.6;
const RELEASE_SECONDS = 2.4;
const TUNNEL_DECAY_SECONDS = 8;
const TUNNEL_DROP_RATIO = 0.3;
const TUNNEL_WINDOW_SECONDS = 1.5;

const mapTunnelDecay = (current: number, dtSec: number): number => {
  if (current <= 0 || dtSec <= 0) {
    return Math.max(0, current);
  }
  return current * Math.exp(-dtSec / TUNNEL_DECAY_SECONDS);
};

export class Mapper {
  private energy = 0;
  private tunnel = 0;
  private lastTimeMs: number | null = null;
  private lastLux: number | null = null;
  private lastLuxTimeMs: number | null = null;

  update(frame: FeatureFrame): MixState {
    const nowMs = Number.isFinite(frame.t) ? frame.t : performance.now();
    const dtSec =
      this.lastTimeMs === null ? 0.05 : Math.max(0.001, Math.min(0.5, (nowMs - this.lastTimeMs) / 1000));
    this.lastTimeMs = nowMs;

    const speedNorm = normalizedSpeed(frame.speedMps);
    const accelNorm = normalizedAccel(frame.accelMps2);
    const rain = rainFromWeather(frame.weather);

    const rawEnergy = clamp01(speedNorm * 0.7 + accelNorm * 0.3);
    const tau = rawEnergy > this.energy ? ATTACK_SECONDS : RELEASE_SECONDS;
    const alpha = 1 - Math.exp(-dtSec / tau);
    this.energy = this.energy + (rawEnergy - this.energy) * alpha;

    const palette = paletteFromHour(frame.hourLocal);
    const brightness = brightnessFromFrame(frame, palette, rain);

    const density = clamp01(this.energy + rain * 0.15);
    const overdrivePush = smoothstep(this.energy, 0.7, 1);
    const crunch = clamp01(accelNorm * 0.72 + overdrivePush * 0.46);

    this.tunnel = mapTunnelDecay(this.tunnel, dtSec);
    this.detectTunnel(frame, nowMs);

    return {
      bpm: lerp(92, 164, smoothstep(frame.speedMps ?? 0, 4, 33)),
      energy: this.energy,
      density,
      brightness,
      crunch,
      rain,
      tunnel: this.tunnel,
      palette
    };
  }

  private detectTunnel(frame: FeatureFrame, nowMs: number): void {
    const currentLux = typeof frame.lux === "number" && Number.isFinite(frame.lux) ? Math.max(0, frame.lux) : null;
    if (currentLux === null) {
      return;
    }

    if (this.lastLux !== null && this.lastLux > 0 && this.lastLuxTimeMs !== null) {
      const dtSec = (nowMs - this.lastLuxTimeMs) / 1000;
      const ratio = currentLux / this.lastLux;
      if (dtSec <= TUNNEL_WINDOW_SECONDS && ratio <= TUNNEL_DROP_RATIO) {
        this.tunnel = 1;
      }
    }

    this.lastLux = currentLux;
    this.lastLuxTimeMs = nowMs;
  }
}

export const createMapper = (): Mapper => new Mapper();
