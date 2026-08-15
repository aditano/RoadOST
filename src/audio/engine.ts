import * as Tone from "tone";
import type { MixPalette, MixState } from "../sensors/types";
import { LayerRack } from "./layers";
import { getPaletteShape } from "./palettes";

export type EngineSettings = {
  holdKey: boolean;
  masterVolume: number;
  reducedMotion: boolean;
};

const DEFAULT_SETTINGS: EngineSettings = {
  holdKey: false,
  masterVolume: 0.85,
  reducedMotion: false
};

export class RoadOstEngine {
  private readonly masterGain = new Tone.Gain(DEFAULT_SETTINGS.masterVolume);
  private readonly limiter = new Tone.Limiter(-0.8);
  private readonly captureDestination: MediaStreamAudioDestinationNode;
  private readonly layers = new LayerRack(this.masterGain, getPaletteShape("night"));
  private settings: EngineSettings = { ...DEFAULT_SETTINGS };
  private started = false;
  private sessionPalette: MixPalette = "night";
  private activeShapeId = "night:none";
  private firstMix = true;

  constructor() {
    this.masterGain.chain(this.limiter, Tone.Destination);
    const rawContext = Tone.getContext().rawContext as AudioContext;
    this.captureDestination = rawContext.createMediaStreamDestination();
    this.limiter.connect(this.captureDestination);
  }

  async start(): Promise<void> {
    await Tone.start();
    if (this.started) {
      return;
    }
    this.layers.start();
    Tone.Transport.start("+0.05");
    this.started = true;
    this.firstMix = true;
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.layers.stop();
    this.started = false;
  }

  applyMix(mix: MixState): void {
    if (this.firstMix) {
      this.sessionPalette = mix.palette;
      this.firstMix = false;
    }
    const palette = this.settings.holdKey ? this.sessionPalette : mix.palette;
    if (!this.settings.holdKey) {
      this.sessionPalette = mix.palette;
    }

    const shapeId = `${palette}:${mix.overlay ?? "none"}`;
    if (shapeId !== this.activeShapeId) {
      this.layers.setShape(getPaletteShape(palette, mix.overlay));
      this.activeShapeId = shapeId;
    }
    this.layers.setMix({ ...mix, palette });
    Tone.Transport.bpm.rampTo(mix.bpm, 0.3);
  }

  updateSettings(nextSettings: Partial<EngineSettings>): void {
    this.settings = { ...this.settings, ...nextSettings };
    this.masterGain.gain.rampTo(this.settings.masterVolume, 0.12);
  }

  getCaptureStream(): MediaStream {
    return this.captureDestination.stream;
  }

  dispose(): void {
    this.stop();
    this.layers.dispose();
    this.masterGain.dispose();
    this.limiter.dispose();
  }
}
