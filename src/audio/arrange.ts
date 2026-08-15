import { clamp01 } from "../mapping/features";
import type { Section } from "../sensors/types";

export type ArrangementState = {
  section: Section;
  fill: number;
  totalBars: number;
  sectionBars: number;
};

export type ArrangementInput = {
  energy: number;
  tunnel: number;
};

export const sectionForEnergy = (energy: number, current: Section): Section => {
  const normalized = clamp01(energy);
  if (normalized > 0.75) {
    return "chorus";
  }
  if (normalized >= 0.55) {
    return "lift";
  }
  if (normalized >= 0.28) {
    return "verse";
  }
  return current === "verse" || current === "break" ? current : "break";
};

export class ArrangementEngine {
  private section: Section = "intro";
  private fill = 0;
  private totalBars = 0;
  private sectionBars = 0;
  private energyHistory: number[] = [];
  private tunnelLatched = false;
  private forcedBreakBarsRemaining = 0;
  private lastTimeMs: number | null = null;
  private barProgress = 0;

  update(tMs: number, bpm: number, input: ArrangementInput): ArrangementState {
    const safeTime = Number.isFinite(tMs) ? tMs : 0;
    if (this.lastTimeMs === null) {
      this.lastTimeMs = safeTime;
      return this.getState();
    }

    const dtSeconds = Math.max(0, Math.min(10, (safeTime - this.lastTimeMs) / 1000));
    this.lastTimeMs = safeTime;
    this.barProgress += (dtSeconds * Math.max(1, bpm)) / 240;

    while (this.barProgress >= 1) {
      this.barProgress -= 1;
      this.advanceBar(input);
    }

    return this.getState();
  }

  advanceBar(input: ArrangementInput): ArrangementState {
    const energy = clamp01(input.energy);
    const tunnel = clamp01(input.tunnel);
    this.totalBars += 1;
    this.sectionBars += 1;
    this.fill = 0;

    this.energyHistory.push(energy);
    if (this.energyHistory.length > 10) {
      this.energyHistory.shift();
    }

    if (this.totalBars % 8 === 0 && this.energyHistory.length >= 3) {
      const current = this.energyHistory[this.energyHistory.length - 1] ?? energy;
      const twoBarsAgo = this.energyHistory[this.energyHistory.length - 3] ?? current;
      if (Math.abs(current - twoBarsAgo) > 0.18) {
        this.fill = 1;
      }
    }

    if (tunnel < 0.35) {
      this.tunnelLatched = false;
    }

    if (this.forcedBreakBarsRemaining > 0) {
      this.forcedBreakBarsRemaining -= 1;
      if (this.forcedBreakBarsRemaining > 0) {
        return this.getState();
      }
      this.changeSection(this.totalBars < 8 ? "intro" : sectionForEnergy(energy, "verse"));
      return this.getState();
    }

    if (tunnel > 0.6 && !this.tunnelLatched) {
      this.tunnelLatched = true;
      this.forcedBreakBarsRemaining = 2;
      this.changeSection("break");
      return this.getState();
    }

    if (this.totalBars < 8) {
      if (this.section !== "intro") {
        this.changeSection("intro");
      }
      return this.getState();
    }

    const target = sectionForEnergy(energy, this.section);
    if (target !== this.section && this.sectionBars >= 4) {
      this.changeSection(target);
    }

    return this.getState();
  }

  getState(): ArrangementState {
    return {
      section: this.section,
      fill: this.fill,
      totalBars: this.totalBars,
      sectionBars: this.sectionBars
    };
  }

  private changeSection(section: Section): void {
    if (section === this.section) {
      return;
    }
    this.section = section;
    this.sectionBars = 0;
  }
}
