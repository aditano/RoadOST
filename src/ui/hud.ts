import { getPaletteShape } from "../audio/palettes";
import type { FeatureFrame, MixState, SourceState } from "../sensors/types";

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

type ChipView = {
  root: HTMLElement;
  value: HTMLElement;
  unit: HTMLElement;
  source: HTMLElement;
};

const CHIP_LABELS: Record<ChipKey, string> = {
  speed: "Speed",
  energy: "Energy",
  rain: "Rain",
  light: "Light",
  weather: "Weather",
  bpm: "Tempo",
  palette: "Palette",
  section: "Section",
  wind: "Wind"
};

const sourceLabel = (source: SourceState): string => {
  switch (source) {
    case "live":
      return "Live";
    case "sim":
      return "Sim";
    case "missing":
      return "Missing";
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
};

const weatherName = (code: number): string => {
  if (code === 0) {
    return "Clear";
  }
  if (code <= 2) {
    return "Fair";
  }
  if (code === 3) {
    return "Cloudy";
  }
  if (code === 45 || code === 48) {
    return "Fog";
  }
  if (code >= 51 && code <= 67) {
    return "Rain";
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return "Snow";
  }
  if (code >= 80 && code <= 82) {
    return "Showers";
  }
  if (code >= 95) {
    return "Thunder";
  }
  return `Code ${code}`;
};

const formatLux = (lux: number): string => {
  if (lux >= 10000) {
    return `${Math.round(lux / 1000)}k`;
  }
  if (lux >= 1000) {
    return `${(lux / 1000).toFixed(1)}k`;
  }
  return Math.round(lux).toString();
};

export class Hud {
  private readonly chips: Record<ChipKey, ChipView>;

  constructor(container: HTMLElement) {
    container.classList.add("hud");
    container.innerHTML = CHIP_KEYS.map(
      (key) => `
      <article class="chip" data-chip="${key}">
        <div class="chip-key">${CHIP_LABELS[key]}</div>
        <div class="chip-source"></div>
        <div class="chip-readout">
          <span class="chip-value">0</span>
          <span class="chip-unit"></span>
        </div>
      </article>
    `
    ).join("");

    const chips = {} as Record<ChipKey, ChipView>;
    for (const key of CHIP_KEYS) {
      const root = container.querySelector<HTMLElement>(`[data-chip="${key}"]`);
      const value = root?.querySelector<HTMLElement>(".chip-value");
      const unit = root?.querySelector<HTMLElement>(".chip-unit");
      const source = root?.querySelector<HTMLElement>(".chip-source");
      if (!root || !value || !unit || !source) {
        throw new Error(`Missing HUD chip ${key}`);
      }
      chips[key] = { root, value, unit, source };
    }
    this.chips = chips;
  }

  render(frame: FeatureFrame, mix: MixState): void {
    const speed = frame.speedMps;
    this.setChip(
      "speed",
      speed === null ? "n/a" : Math.round(speed * 2.23694).toString(),
      speed === null ? "" : "mph",
      frame.source.geo
    );
    this.setChip("energy", Math.round(mix.energy * 100).toString(), "%", frame.source.motion);
    this.setChip("rain", Math.round(mix.rain * 100).toString(), "%", frame.source.weather);
    this.setChip(
      "light",
      frame.lux === null ? "n/a" : formatLux(frame.lux),
      frame.lux === null ? "" : "lux",
      frame.source.light
    );
    this.setChip(
      "weather",
      frame.weather ? weatherName(frame.weather.code) : "n/a",
      frame.weather ? `${Math.round(frame.weather.tempC)}°C` : "",
      frame.source.weather
    );
    this.setChip("bpm", Math.round(mix.bpm).toString(), "bpm", null);
    this.setChip("palette", mix.palette, getPaletteShape(mix.palette, mix.overlay).keyLabel, null);
    this.setChip("section", mix.section, mix.tunnel > 0.35 ? "Tunnel" : "", null);
    this.setChip(
      "wind",
      frame.weather ? frame.weather.windMps.toFixed(1) : "n/a",
      frame.weather ? "m/s" : "",
      frame.source.weather
    );
  }

  private setChip(key: ChipKey, value: string, unit: string, source: SourceState | null): void {
    const chip = this.chips[key];
    chip.value.textContent = value;
    chip.unit.textContent = unit;
    chip.source.textContent = source ? sourceLabel(source) : "";
    if (source) {
      chip.root.dataset.source = source;
    } else {
      delete chip.root.dataset.source;
    }
  }
}
