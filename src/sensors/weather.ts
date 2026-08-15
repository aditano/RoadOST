import { clamp01 } from "../mapping/features";
import type { SourceState, WeatherFrame } from "./types";

export type WeatherSnapshot = {
  weather: WeatherFrame | null;
  source: SourceState;
  updatedAtMs: number | null;
};

type LocationPoint = {
  latitude: number;
  longitude: number;
};

const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const WEATHER_JUMP_METERS = 3000;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const distanceMeters = (a: LocationPoint, b: LocationPoint): number => {
  const earth = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
};

const buildUrl = (latitude: number, longitude: number): string => {
  const search = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: "temperature_2m,weather_code,precipitation,cloud_cover,is_day,wind_speed_10m,visibility"
  });
  return `https://api.open-meteo.com/v1/forecast?${search.toString()}`;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    precipitation?: number;
    cloud_cover?: number;
    is_day?: number;
    wind_speed_10m?: number;
    visibility?: number;
  };
};

export class WeatherSource {
  private snapshot: WeatherSnapshot = {
    weather: null,
    source: "missing",
    updatedAtMs: null
  };
  private lastLocation: LocationPoint | null = null;
  private pendingPromise: Promise<void> | null = null;

  getSnapshot(): WeatherSnapshot {
    return { ...this.snapshot };
  }

  maybeRefresh(location: LocationPoint | null, source: SourceState): void {
    if (!location) {
      if (source === "missing") {
        this.snapshot.source = "missing";
      }
      return;
    }

    const nowMs = performance.now();
    const stale =
      this.snapshot.updatedAtMs === null ||
      nowMs - this.snapshot.updatedAtMs >= WEATHER_REFRESH_MS;
    const movedFar =
      this.lastLocation === null ||
      distanceMeters(this.lastLocation, location) >= WEATHER_JUMP_METERS;

    if (!stale && !movedFar) {
      return;
    }

    if (this.pendingPromise) {
      return;
    }

    this.pendingPromise = this.fetchWeather(location, source).finally(() => {
      this.pendingPromise = null;
    });
  }

  private async fetchWeather(location: LocationPoint, source: SourceState): Promise<void> {
    try {
      const response = await fetch(buildUrl(location.latitude, location.longitude));
      if (!response.ok) {
        throw new Error(`Weather request failed: ${response.status}`);
      }

      const payload = (await response.json()) as OpenMeteoResponse;
      const current = payload.current;
      if (!current) {
        throw new Error("Missing weather.current in Open-Meteo payload");
      }

      this.snapshot = {
        weather: {
          code: Number.isFinite(current.weather_code) ? current.weather_code ?? 0 : 0,
          precipMmHr: Number.isFinite(current.precipitation) ? current.precipitation ?? 0 : 0,
          cloud: clamp01((current.cloud_cover ?? 0) / 100),
          tempC: Number.isFinite(current.temperature_2m) ? current.temperature_2m ?? 0 : 0,
          isNight: current.is_day === 0,
          windMps: Number.isFinite(current.wind_speed_10m)
            ? Math.max(0, current.wind_speed_10m ?? 0) / 3.6
            : 0,
          visibility: Number.isFinite(current.visibility)
            ? Math.max(0, current.visibility ?? 0)
            : undefined
        },
        source,
        updatedAtMs: performance.now()
      };

      this.lastLocation = location;
    } catch {
      this.snapshot.source = "missing";
    }
  }
}
