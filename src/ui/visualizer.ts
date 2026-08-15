import { clamp01 } from "../mapping/features";
import type { FeatureFrame, MixState } from "../sensors/types";

export class Visualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
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
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const speed = clamp01((frame.speedMps ?? 0) / 33);
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
    ctx.moveTo(0, horizon + 25);
    for (let x = 0; x <= width; x += 80) {
      const ridge = Math.sin(x * 0.021 + 1.4) * 18 + Math.sin(x * 0.008) * 26;
      ctx.lineTo(x, horizon - 2 - ridge);
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

    ctx.strokeStyle = "rgba(211,222,255,0.7)";
    ctx.lineWidth = 4;
    for (let index = 0; index < 7; index += 1) {
      const progress = (index / 7 + this.phase) % 1;
      const eased = progress * progress;
      const y = horizon + eased * (height - horizon);
      const nextProgress = Math.min(1, progress + 0.075);
      const nextY = horizon + nextProgress * nextProgress * (height - horizon);
      const x = width * 0.5 + (progress - 0.5) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(width * 0.5, nextY);
      ctx.stroke();
    }

    const rainDrops = Math.round(mix.rain * 34);
    ctx.strokeStyle = `rgba(151,190,255,${0.2 + mix.rain * 0.48})`;
    ctx.lineWidth = 2;
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

    ctx.fillStyle = "rgba(4,7,14,0.64)";
    ctx.fillRect(24, 22, 260, 66);
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 27px system-ui, sans-serif";
    ctx.fillText(`${Math.round((frame.speedMps ?? 0) * 2.23694)} MPH`, 42, 60);
    ctx.fillStyle = "#9fb3d5";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(`${mix.section.toUpperCase()} · ${Math.round(mix.bpm)} BPM`, 42, 82);
  }
}
