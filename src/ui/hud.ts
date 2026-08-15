import type { FeatureFrame, MixState } from "../sensors/types";

const CHIP_KEYS = [
  "speed",
  "energy",
  "rain",
  "light",
  "weather",
  "bpm",
  "palette",
  "section",
  "wind"
] as const;
type ChipKey = (typeof CHIP_KEYS)[number];

type ChipElementMap = Record<ChipKey, HTMLElement>;

const sourceBadge = (source: string): string => source.toUpperCase();

export class Hud {
  private readonly chips: ChipElementMap;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add("hud");
    this.container.innerHTML = CHIP_KEYS.map(
      (key) => `
      <article class="chip" data-chip="${key}">
        <div class="chip-key">${key.toUpperCase()}</div>
        <div class="chip-value">–</div>
      </article>
    `
    ).join("");

    const chips = {} as Partial<ChipElementMap>;
    for (const key of CHIP_KEYS) {
      const el = this.container.querySelector<HTMLElement>(`[data-chip="${key}"] .chip-value`);
      if (!el) {
        throw new Error(`Missing HUD chip ${key}`);
      }
      chips[key] = el;
    }
    this.chips = chips as ChipElementMap;
  }

  render(frame: FeatureFrame, mix: MixState): void {
    this.chips.speed.textContent = `${((frame.speedMps ?? 0) * 2.23694).toFixed(0)} mph · ${sourceBadge(frame.source.geo)}`;
    this.chips.energy.textContent = `${mix.energy.toFixed(2)} · ${sourceBadge(frame.source.motion)}`;
    this.chips.rain.textContent = `${mix.rain.toFixed(2)} · ${sourceBadge(frame.source.weather)}`;
    this.chips.light.textContent = `${(frame.lux ?? 0).toFixed(0)} lux · ${sourceBadge(frame.source.light)}`;
    this.chips.weather.textContent = frame.weather
      ? `code ${frame.weather.code} ${frame.weather.tempC.toFixed(0)}C`
      : "missing";
    this.chips.bpm.textContent = `${mix.bpm.toFixed(0)} bpm`;
    this.chips.palette.textContent = mix.palette;
    this.chips.section.textContent = mix.section;
    this.chips.wind.textContent = `${(frame.weather?.windMps ?? 0).toFixed(1)} m/s`;
  }
}
