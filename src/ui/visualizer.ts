import { clamp01 } from "../mapping/features";
import type { FeatureFrame, MixState } from "../sensors/types";

const METER_KEYS = ["energy", "density", "crunch", "rain", "brightness"] as const;

const METER_LABELS: Record<(typeof METER_KEYS)[number], string> = {
  energy: "Energy",
  density: "Density",
  crunch: "Crunch",
  rain: "Rain",
  brightness: "Bright"
};

export class Visualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly meters: Record<(typeof METER_KEYS)[number], HTMLElement>;
  private reducedMotion = false;
  private phase = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "viz";
    this.canvas.width = 1200;
    this.canvas.height = 300;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "Live road horizon responding to speed and weather");
    container.appendChild(this.canvas);

    const meters = document.createElement("div");
    meters.className = "mix-meters";
    meters.setAttribute("aria-hidden", "true");
    meters.innerHTML = METER_KEYS.map(
      (key) =>
        `<label><span>${METER_LABELS[key]}</span><span class="meter"><i data-meter="${key}"></i></span></label>`
    ).join("");
    container.appendChild(meters);

    const meterMap = {} as Record<(typeof METER_KEYS)[number], HTMLElement>;
    for (const key of METER_KEYS) {
      const bar = meters.querySelector<HTMLElement>(`[data-meter="${key}"]`);
      if (!bar) {
        throw new Error(`Missing mix meter ${key}`);
      }
      meterMap[key] = bar;
    }
    this.meters = meterMap;

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Visualizer canvas context unavailable");
    }
    this.ctx = context;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  render(frame: FeatureFrame, mix: MixState): void {
    this.meters.energy.style.width = `${Math.round(clamp01(mix.energy) * 100)}%`;
    this.meters.density.style.width = `${Math.round(clamp01(mix.density) * 100)}%`;
    this.meters.crunch.style.width = `${Math.round(clamp01(mix.crunch) * 100)}%`;
    this.meters.rain.style.width = `${Math.round(clamp01(mix.rain) * 100)}%`;
    this.meters.brightness.style.width = `${Math.round(clamp01(mix.brightness) * 100)}%`;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.ctx;
    const speed = clamp01((frame.speedMps ?? 0) / 33);
    const unit = width / 1200;
    const horizon = height * (0.47 + mix.tunnel * 0.04);
    if (!this.reducedMotion) {
      this.phase = (this.phase + 0.012 + speed * 0.055) % 1;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    const storm = mix.overlay === "storm";
    const gold = mix.overlay === "gold";
    sky.addColorStop(0, storm ? "#080b18" : gold ? "#53271e" : mix.palette === "night" ? "#071126" : "#19355b");
    sky.addColorStop(1, gold ? "#e8783f" : storm ? "#263048" : mix.palette === "dawn" ? "#a44f65" : "#4d7194");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);

    const glow = ctx.createRadialGradient(width * 0.5, horizon, 0, width * 0.5, horizon, width * 0.38);
    glow.addColorStop(0, gold ? "rgba(255,192,91,0.55)" : "rgba(107,154,255,0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.moveTo(0, horizon + 25 * unit);
    for (let x = 0; x <= width; x += Math.max(20, 80 * unit)) {
      const ridge =
        Math.sin(x / unit * 0.021 + 1.4) * 18 * unit + Math.sin(x / unit * 0.008) * 26 * unit;
      ctx.lineTo(x, horizon - 2 * unit - ridge);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#11141c";
    ctx.beginPath();
    ctx.moveTo(width * 0.43, horizon);
    ctx.lineTo(width * 0.06, height);
    ctx.lineTo(width * 0.94, height);
    ctx.lineTo(width * 0.57, horizon);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(226, 232, 244, 0.28)";
    ctx.lineWidth = Math.max(1, 2 * unit);
    ctx.beginPath();
    ctx.moveTo(width * 0.43, horizon);
    ctx.lineTo(width * 0.06, height);
    ctx.moveTo(width * 0.57, horizon);
    ctx.lineTo(width * 0.94, height);
    ctx.stroke();

    ctx.strokeStyle = "rgba(211,222,255,0.7)";
    for (let index = 0; index < 7; index += 1) {
      const progress = (index / 7 + this.phase) % 1;
      const eased = progress * progress;
      const y = horizon + eased * (height - horizon);
      const nextProgress = Math.min(1, progress + 0.075);
      const nextY = horizon + nextProgress * nextProgress * (height - horizon);
      ctx.lineWidth = Math.max(1, (1.4 + eased * 5.5) * unit);
      ctx.beginPath();
      ctx.moveTo(width * 0.5, y);
      ctx.lineTo(width * 0.5, nextY);
      ctx.stroke();
    }

    const rainDrops = Math.round(mix.rain * 34);
    ctx.strokeStyle = `rgba(151,190,255,${0.2 + mix.rain * 0.48})`;
    ctx.lineWidth = Math.max(1, 2 * unit);
    for (let index = 0; index < rainDrops; index += 1) {
      const seed = (index * 83.13) % 997;
      const x = (seed / 997) * width;
      const y = ((index * 47 + this.phase * height * 4) % height) - 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 9 - speed * 16, y + 25 + speed * 24);
      ctx.stroke();
    }

    const shade = clamp01(mix.tunnel * 0.78);
    if (shade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${shade})`;
      ctx.fillRect(0, 0, width, height);
    }
  }
}
