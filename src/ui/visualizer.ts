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
    this.canvas.width = 960;
    this.canvas.height = 120;
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Visualizer canvas context unavailable");
    }
    this.ctx = ctx;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  render(frame: FeatureFrame, mix: MixState): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const bars = [
      { key: "Energy", value: mix.energy, color: "#71f5cc" },
      { key: "Density", value: mix.density, color: "#50b7ff" },
      { key: "Rain", value: mix.rain, color: "#7a89ff" },
      { key: "Crunch", value: mix.crunch, color: "#ff7e67" },
      { key: "Tunnel", value: mix.tunnel, color: "#ffd166" },
      { key: "Speed", value: clamp01((frame.speedMps ?? 0) / 33), color: "#bf93ff" }
    ];

    const barWidth = width / bars.length;
    this.phase += this.reducedMotion ? 0 : 0.03;

    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "bottom";

    bars.forEach((bar, index) => {
      const x = index * barWidth + 14;
      const maxHeight = 78;
      const pulse = this.reducedMotion ? 0 : Math.sin(this.phase + index * 0.7) * 0.03;
      const normalized = clamp01(bar.value + pulse);
      const barHeight = maxHeight * normalized;
      const y = 96 - barHeight;

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, 18, barWidth - 28, maxHeight);

      ctx.fillStyle = bar.color;
      ctx.fillRect(x, y, barWidth - 28, barHeight);

      ctx.fillStyle = "#cdd9ff";
      ctx.fillText(bar.key, x, 116);
    });
  }
}
