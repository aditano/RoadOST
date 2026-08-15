import { clamp } from "../mapping/features";
import type { SourceState } from "./types";

export type GeoSnapshot = {
  speedMps: number | null;
  headingDeg: number | null;
  headingRate: number | null;
  latitude: number | null;
  longitude: number | null;
  source: SourceState;
};

type GeoPosition = {
  lat: number;
  lon: number;
  tMs: number;
};

const EARTH_RADIUS_M = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

const haversineMeters = (a: GeoPosition, b: GeoPosition): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

export class GeolocationSource {
  private watchId: number | null = null;
  private previousPosition: GeoPosition | null = null;
  private snapshot: GeoSnapshot = {
    speedMps: null,
    headingDeg: null,
    headingRate: null,
    latitude: null,
    longitude: null,
    source: "missing"
  };
  private previousHeading: { headingDeg: number; tMs: number } | null = null;

  start(): void {
    if (!("geolocation" in navigator)) {
      this.snapshot.source = "missing";
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      () => {
        this.snapshot.source = "missing";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );
  }

  stop(): void {
    if (this.watchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getSnapshot(): GeoSnapshot {
    return { ...this.snapshot };
  }

  private handlePosition(position: GeolocationPosition): void {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const tMs = position.timestamp;
    const headingDeg = Number.isFinite(position.coords.heading) ? position.coords.heading : null;
    let headingRate: number | null = null;
    if (headingDeg !== null && this.previousHeading) {
      const dt = (tMs - this.previousHeading.tMs) / 1000;
      if (dt > 0) {
        const rawDelta = Math.abs(headingDeg - this.previousHeading.headingDeg);
        headingRate = Math.min(rawDelta, 360 - rawDelta) / dt;
      }
    }
    if (headingDeg !== null) {
      this.previousHeading = { headingDeg, tMs };
    }

    const liveSpeed = Number.isFinite(position.coords.speed) ? position.coords.speed : null;
    let derivedSpeed = liveSpeed;

    if (derivedSpeed === null && this.previousPosition) {
      const dt = (tMs - this.previousPosition.tMs) / 1000;
      if (dt > 0) {
        const distance = haversineMeters(this.previousPosition, { lat, lon, tMs });
        derivedSpeed = distance / dt;
      }
    }

    this.previousPosition = { lat, lon, tMs };

    this.snapshot = {
      speedMps: derivedSpeed === null ? null : clamp(derivedSpeed, 0, 50),
      headingDeg,
      headingRate,
      latitude: lat,
      longitude: lon,
      source: "live"
    };
  }
}
