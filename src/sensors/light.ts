import type { SourceState } from "./types";

export type LightSnapshot = {
  lux: number | null;
  source: SourceState;
};

type AmbientSensorLike = EventTarget & {
  illuminance?: number;
  start: () => void;
  stop: () => void;
  onerror: ((this: EventTarget, ev: Event) => void) | null;
};

type WindowWithAmbientLightSensor = Window & {
  AmbientLightSensor?: new () => AmbientSensorLike;
};

export const estimateLuxFromHourAndCloud = (hour: number, cloud: number): number => {
  const dayWave = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const clearSkyLux = 40 + dayWave * 35000;
  const cloudFactor = 1 - Math.min(1, Math.max(0, cloud)) * 0.7;
  return clearSkyLux * cloudFactor;
};

export class LightSource {
  private sensor: AmbientSensorLike | null = null;
  private snapshot: LightSnapshot = { lux: null, source: "missing" };

  start(): void {
    const ambientCtor = (window as WindowWithAmbientLightSensor).AmbientLightSensor;
    if (!ambientCtor) {
      this.snapshot.source = "missing";
      return;
    }

    try {
      this.sensor = new ambientCtor();
      this.sensor.addEventListener("reading", () => {
        const value = this.sensor?.illuminance;
        this.snapshot = {
          lux: typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null,
          source: "live"
        };
      });
      this.sensor.onerror = () => {
        this.snapshot.source = "missing";
      };
      this.sensor.start();
    } catch {
      this.snapshot.source = "missing";
      this.sensor = null;
    }
  }

  stop(): void {
    this.sensor?.stop();
    this.sensor = null;
  }

  getSnapshot(): LightSnapshot {
    return { ...this.snapshot };
  }
}
