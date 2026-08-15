import type { SourceState } from "./types";

type MotionSample = {
  tMs: number;
  linearAccelMag: number;
};

export type MotionSnapshot = {
  accelRmsMps2: number | null;
  source: SourceState;
};

const WINDOW_MS = 600;

const getLinearAccelerationMagnitude = (event: DeviceMotionEvent): number | null => {
  const linear = event.acceleration;
  if (linear?.x != null && linear.y != null && linear.z != null) {
    return Math.sqrt(linear.x ** 2 + linear.y ** 2 + linear.z ** 2);
  }

  const accel = event.accelerationIncludingGravity;
  if (accel?.x == null || accel.y == null || accel.z == null) {
    return null;
  }

  // Fallback estimation by subtracting gravity from total acceleration.
  const g = 9.81;
  const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  return Math.max(0, Math.abs(mag - g));
};

export class MotionSource {
  private samples: MotionSample[] = [];
  private snapshot: MotionSnapshot = { accelRmsMps2: null, source: "missing" };
  private boundHandler = (event: DeviceMotionEvent): void => this.onMotion(event);
  private started = false;

  static async requestPermissionIfNeeded(): Promise<boolean> {
    const constructorRef = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof constructorRef.requestPermission === "function") {
      try {
        const result = await constructorRef.requestPermission();
        return result === "granted";
      } catch {
        return false;
      }
    }

    return true;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    window.addEventListener("devicemotion", this.boundHandler, { passive: true });
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    window.removeEventListener("devicemotion", this.boundHandler);
  }

  getSnapshot(): MotionSnapshot {
    return { ...this.snapshot };
  }

  private onMotion(event: DeviceMotionEvent): void {
    const value = getLinearAccelerationMagnitude(event);
    if (value === null || !Number.isFinite(value)) {
      return;
    }

    const nowMs = performance.now();
    this.samples.push({ tMs: nowMs, linearAccelMag: value });
    this.samples = this.samples.filter((sample) => nowMs - sample.tMs <= WINDOW_MS);

    const meanSquares =
      this.samples.reduce((sum, sample) => sum + sample.linearAccelMag ** 2, 0) /
      this.samples.length;

    this.snapshot = {
      accelRmsMps2: Math.sqrt(meanSquares),
      source: "live"
    };
  }
}
