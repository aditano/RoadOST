import type { FeatureFrame, MixPalette, MixState, Section } from "../sensors/types";

export const RECAP_STORAGE_KEY = "roadost.recaps.v1";

export type SectionRecap = {
  section: Section;
  bars: number;
};

export type DriveRecap = {
  id: string;
  createdAt: string;
  durationSec: number;
  avgSpeedMps: number;
  peakSpeedMps: number;
  peakEnergy: number;
  dominantPalette: MixPalette;
  rainFraction: number;
  sections: SectionRecap[];
};

type MutableSection = {
  section: Section;
  bars: number;
};

export class RecapTracker {
  private startedAtMs = 0;
  private lastSampleMs = 0;
  private weightedSpeed = 0;
  private sampledSeconds = 0;
  private peakSpeedMps = 0;
  private peakEnergy = 0;
  private rainSeconds = 0;
  private readonly paletteSeconds: Record<MixPalette, number> = {
    dawn: 0,
    day: 0,
    dusk: 0,
    night: 0
  };
  private readonly sections: MutableSection[] = [];
  private active = false;

  start(frame: FeatureFrame, mix: MixState, nowMs = performance.now()): void {
    this.reset();
    this.active = true;
    this.startedAtMs = nowMs;
    this.lastSampleMs = nowMs;
    this.sections.push({ section: mix.section, bars: 0 });
    this.peakSpeedMps = Math.max(0, frame.speedMps ?? 0);
    this.peakEnergy = mix.energy;
  }

  sample(frame: FeatureFrame, mix: MixState, nowMs = performance.now()): void {
    if (!this.active) {
      return;
    }
    const dt = Math.max(0, Math.min(0.5, (nowMs - this.lastSampleMs) / 1000));
    this.lastSampleMs = nowMs;
    const speed = Math.max(0, frame.speedMps ?? 0);
    this.weightedSpeed += speed * dt;
    this.sampledSeconds += dt;
    this.peakSpeedMps = Math.max(this.peakSpeedMps, speed);
    this.peakEnergy = Math.max(this.peakEnergy, mix.energy);
    this.paletteSeconds[mix.palette] += dt;
    if (mix.rain > 0.45) {
      this.rainSeconds += dt;
    }

    let current = this.sections[this.sections.length - 1];
    if (!current || current.section !== mix.section) {
      current = { section: mix.section, bars: 0 };
      this.sections.push(current);
    }
    current.bars += (dt * mix.bpm) / 240;
  }

  snapshot(frame: FeatureFrame, mix: MixState, nowMs = performance.now()): DriveRecap {
    this.sample(frame, mix, nowMs);
    const dominantPalette = (Object.entries(this.paletteSeconds) as Array<
      [MixPalette, number]
    >).reduce((winner, entry) => (entry[1] > winner[1] ? entry : winner), [
      mix.palette,
      -1
    ])[0];

    return {
      id: `${Date.now()}-${Math.round(this.peakSpeedMps * 10)}`,
      createdAt: new Date().toISOString(),
      durationSec: Math.max(0, (nowMs - this.startedAtMs) / 1000),
      avgSpeedMps: this.sampledSeconds > 0 ? this.weightedSpeed / this.sampledSeconds : 0,
      peakSpeedMps: this.peakSpeedMps,
      peakEnergy: this.peakEnergy,
      dominantPalette,
      rainFraction: this.sampledSeconds > 0 ? this.rainSeconds / this.sampledSeconds : 0,
      sections: this.sections.map((section) => ({
        section: section.section,
        bars: Math.max(1, Math.round(section.bars))
      }))
    };
  }

  finish(frame: FeatureFrame, mix: MixState, nowMs = performance.now()): DriveRecap {
    const recap = this.snapshot(frame, mix, nowMs);
    this.active = false;
    return recap;
  }

  private reset(): void {
    this.weightedSpeed = 0;
    this.sampledSeconds = 0;
    this.peakSpeedMps = 0;
    this.peakEnergy = 0;
    this.rainSeconds = 0;
    this.paletteSeconds.dawn = 0;
    this.paletteSeconds.day = 0;
    this.paletteSeconds.dusk = 0;
    this.paletteSeconds.night = 0;
    this.sections.length = 0;
  }
}

export const persistRecap = (recap: DriveRecap): void => {
  try {
    const existing = JSON.parse(localStorage.getItem(RECAP_STORAGE_KEY) ?? "[]") as unknown;
    const recaps = Array.isArray(existing) ? existing : [];
    localStorage.setItem(RECAP_STORAGE_KEY, JSON.stringify([recap, ...recaps].slice(0, 10)));
  } catch {
    // Local storage can be unavailable in private or locked-down browsing modes.
  }
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
};

export const recapToText = (recap: DriveRecap): string =>
  [
    "My RoadOST drive",
    `Duration: ${formatDuration(recap.durationSec)}`,
    `Average speed: ${(recap.avgSpeedMps * 2.23694).toFixed(0)} mph`,
    `Peak speed: ${(recap.peakSpeedMps * 2.23694).toFixed(0)} mph`,
    `Peak energy: ${Math.round(recap.peakEnergy * 100)}%`,
    `Palette: ${recap.dominantPalette}`,
    `Rain time: ${Math.round(recap.rainFraction * 100)}%`,
    `Arrangement: ${recap.sections.map((item) => `${item.section} ${item.bars} ${item.bars === 1 ? "bar" : "bars"}`).join(", ")}`
  ].join("\n");

export const formatRecapDuration = formatDuration;
