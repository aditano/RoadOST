import { getHourLocal } from "./clock";
import { GeolocationSource } from "./geolocation";
import { LightSource, estimateLuxFromHourAndCloud } from "./light";
import { MotionSource } from "./motion";
import { type SimulatorController } from "./simulator";
import type { FeatureFrame } from "./types";
import { WeatherSource } from "./weather";

export type BusMode = "live" | "sim";
type FrameSubscriber = (frame: FeatureFrame) => void;

const TICK_MS = 50;

export class FeatureBus {
  private readonly geo = new GeolocationSource();
  private readonly motion = new MotionSource();
  private readonly light = new LightSource();
  private readonly weather = new WeatherSource();
  private readonly subscribers = new Set<FrameSubscriber>();
  private mode: BusMode = "sim";
  private latestFrame: FeatureFrame;
  private timer: number | null = null;

  constructor(private readonly simulator: SimulatorController) {
    const now = performance.now();
    this.latestFrame = simulator.getFeatureFrame(now);
  }

  start(initialMode: BusMode): void {
    this.mode = initialMode;
    this.geo.start();
    this.motion.start();
    this.light.start();
    this.stopTicker();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    this.stopTicker();
    this.geo.stop();
    this.motion.stop();
    this.light.stop();
  }

  setMode(mode: BusMode): void {
    this.mode = mode;
    this.tick();
  }

  getMode(): BusMode {
    return this.mode;
  }

  getLatestFrame(): FeatureFrame {
    return this.latestFrame;
  }

  async requestMotionPermission(): Promise<boolean> {
    return MotionSource.requestPermissionIfNeeded();
  }

  subscribe(subscriber: FrameSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.latestFrame);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private tick(): void {
    const nowMs = performance.now();
    const frame =
      this.mode === "sim" ? this.simulator.getFeatureFrame(nowMs) : this.getLiveFrame(nowMs);
    this.latestFrame = frame;
    for (const subscriber of this.subscribers) {
      subscriber(frame);
    }
  }

  private getLiveFrame(nowMs: number): FeatureFrame {
    const geoSnapshot = this.geo.getSnapshot();
    const motionSnapshot = this.motion.getSnapshot();
    const lightSnapshot = this.light.getSnapshot();

    const location =
      geoSnapshot.latitude !== null && geoSnapshot.longitude !== null
        ? { latitude: geoSnapshot.latitude, longitude: geoSnapshot.longitude }
        : null;
    this.weather.maybeRefresh(location, geoSnapshot.source === "live" ? "live" : "missing");
    const weatherSnapshot = this.weather.getSnapshot();
    const weather = weatherSnapshot.weather;
    const hourLocal = getHourLocal();
    const computedLux =
      lightSnapshot.lux ??
      estimateLuxFromHourAndCloud(hourLocal, weather?.cloud ?? 0.4);

    return {
      t: nowMs,
      speedMps: geoSnapshot.speedMps,
      accelMps2: motionSnapshot.accelRmsMps2,
      headingDeg: geoSnapshot.headingDeg,
      headingRate: geoSnapshot.headingRate,
      lux: computedLux,
      hourLocal,
      weather,
      source: {
        geo: geoSnapshot.source,
        motion: motionSnapshot.source,
        light: lightSnapshot.source,
        weather: weatherSnapshot.source
      }
    };
  }

  private stopTicker(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
