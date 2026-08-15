import * as Tone from "tone";
import { clamp01 } from "../mapping/features";
import type { MixState } from "../sensors/types";
import type { PaletteShape } from "./palettes";

type LayerGainNodes = {
  drums: Tone.Gain;
  bass: Tone.Gain;
  guitar: Tone.Gain;
  pad: Tone.Gain;
  lead: Tone.Gain;
  weather: Tone.Gain;
  rainHat: Tone.Gain;
};

const pick = <T>(items: readonly T[], index: number): T => {
  if (items.length === 0) {
    throw new Error("Expected non-empty musical pattern.");
  }
  return (items[index % items.length] ?? items[0]) as T;
};

export class LayerRack {
  private readonly gains: LayerGainNodes;
  private readonly kickSynth: Tone.MembraneSynth;
  private readonly snareSynth: Tone.NoiseSynth;
  private readonly hatSynth: Tone.NoiseSynth;
  private readonly rainHatSynth: Tone.NoiseSynth;
  private readonly bassSynth: Tone.MonoSynth;
  private readonly guitarSynth: Tone.PolySynth;
  private readonly guitarFilter: Tone.Filter;
  private readonly guitarDrive: Tone.Distortion;
  private readonly padSynth: Tone.PolySynth;
  private readonly leadSynth: Tone.Synth;
  private readonly weatherNoise: Tone.Noise;
  private readonly weatherFilter: Tone.Filter;
  private readonly stepLoop: Tone.Loop;
  private readonly chordLoop: Tone.Loop;
  private stepIndex = 0;
  private chordIndex = 0;
  private progressionVariant = 0;
  private activeShape: PaletteShape;
  private latestMix: MixState = {
    bpm: 92,
    energy: 0,
    density: 0,
    brightness: 0.4,
    crunch: 0,
    rain: 0,
    tunnel: 0,
    palette: "night"
  };

  constructor(rootBus: Tone.ToneAudioNode, initialShape: PaletteShape) {
    const drumsGain = new Tone.Gain(0);
    const bassGain = new Tone.Gain(0);
    const guitarGain = new Tone.Gain(0);
    const padGain = new Tone.Gain(0);
    const leadGain = new Tone.Gain(0);
    const weatherGain = new Tone.Gain(0);
    const rainHatGain = new Tone.Gain(0);

    this.gains = {
      drums: drumsGain,
      bass: bassGain,
      guitar: guitarGain,
      pad: padGain,
      lead: leadGain,
      weather: weatherGain,
      rainHat: rainHatGain
    };

    this.kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      envelope: {
        attack: 0.001,
        decay: 0.25,
        sustain: 0.01,
        release: 0.2
      }
    }).connect(drumsGain);
    this.snareSynth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0 }
    }).connect(drumsGain);
    this.hatSynth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 }
    }).connect(drumsGain);
    this.rainHatSynth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 }
    }).connect(rainHatGain);

    const bassFilter = new Tone.Filter({ type: "lowpass", frequency: 360, Q: 0.8 });
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.2 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.12,
        sustain: 0.18,
        release: 0.2,
        baseFrequency: 90,
        octaves: 2
      }
    });
    this.bassSynth.chain(bassFilter, bassGain);

    this.guitarFilter = new Tone.Filter({ type: "lowpass", frequency: 1500, Q: 1.2 });
    this.guitarDrive = new Tone.Distortion(0.3);
    this.guitarSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.24 }
    });
    this.guitarSynth.chain(this.guitarFilter, this.guitarDrive, guitarGain);

    const padFilter = new Tone.Filter({ type: "lowpass", frequency: 1800, Q: 0.6 });
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.3, decay: 0.7, sustain: 0.72, release: 1.2 }
    });
    this.padSynth.chain(padFilter, padGain);

    this.leadSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.16, sustain: 0.2, release: 0.2 }
    }).connect(leadGain);

    this.weatherFilter = new Tone.Filter({ type: "bandpass", frequency: 800, Q: 0.7 });
    this.weatherNoise = new Tone.Noise("pink");
    this.weatherNoise.chain(this.weatherFilter, weatherGain);

    drumsGain.connect(rootBus);
    rainHatGain.connect(rootBus);
    bassGain.connect(rootBus);
    guitarGain.connect(rootBus);
    padGain.connect(rootBus);
    leadGain.connect(rootBus);
    weatherGain.connect(rootBus);

    this.activeShape = initialShape;
    this.stepLoop = new Tone.Loop((time) => this.onStep(time), "8n");
    this.chordLoop = new Tone.Loop((time) => this.onChord(time), "1m");
  }

  start(): void {
    this.weatherNoise.start();
    this.stepLoop.start(0);
    this.chordLoop.start(0);
  }

  stop(): void {
    this.stepLoop.stop();
    this.chordLoop.stop();
    this.weatherNoise.stop();
  }

  dispose(): void {
    this.stop();
    this.stepLoop.dispose();
    this.chordLoop.dispose();
    this.kickSynth.dispose();
    this.snareSynth.dispose();
    this.hatSynth.dispose();
    this.rainHatSynth.dispose();
    this.bassSynth.dispose();
    this.guitarSynth.dispose();
    this.padSynth.dispose();
    this.leadSynth.dispose();
    this.weatherNoise.dispose();
    this.weatherFilter.dispose();
    this.guitarDrive.dispose();
    this.guitarFilter.dispose();
    for (const gain of Object.values(this.gains)) {
      gain.dispose();
    }
  }

  setShape(shape: PaletteShape): void {
    this.activeShape = shape;
    this.chordIndex = 0;
  }

  setMix(mix: MixState): void {
    this.latestMix = mix;

    const tunnelDuck = 1 - mix.tunnel * 0.55;
    const rainLeadCut = 1 - mix.rain * 0.28;
    this.gains.drums.gain.rampTo(clamp01(0.2 + mix.density * 0.8) * tunnelDuck, 0.1);
    this.gains.bass.gain.rampTo(clamp01(0.18 + mix.energy * 0.7) * tunnelDuck, 0.12);
    this.gains.guitar.gain.rampTo(
      mix.energy < 0.25 ? 0 : clamp01(mix.crunch * 0.75 + (mix.energy - 0.25) * 0.7) * tunnelDuck,
      0.14
    );
    this.gains.pad.gain.rampTo(clamp01(0.22 + (1 - mix.brightness) * 0.6 + mix.rain * 0.22), 0.2);
    this.gains.lead.gain.rampTo(
      mix.energy > 0.45 ? clamp01((mix.energy - 0.45) * 1.35) * rainLeadCut * tunnelDuck : 0,
      0.12
    );
    this.gains.weather.gain.rampTo(clamp01(mix.rain * 0.52), 0.2);
    this.gains.rainHat.gain.rampTo(clamp01((mix.rain - 0.12) * 0.8), 0.1);

    this.guitarDrive.distortion = clamp01(0.25 + mix.crunch * 0.7);
    this.guitarFilter.frequency.rampTo(700 + mix.brightness * 2000, 0.18);
    this.weatherFilter.frequency.rampTo(450 + mix.rain * 900, 0.22);
  }

  private onStep(time: number): void {
    const step = this.stepIndex % 8;
    const density = this.latestMix.density;
    const energy = this.latestMix.energy;
    const rain = this.latestMix.rain;

    const kickHit = step === 0 || step === 4 || (energy > 0.75 && step === 6);
    if (kickHit) {
      this.kickSynth.triggerAttackRelease("C1", "8n", time, 0.95);
      this.duckPad(time);
    }

    if (step === 2 || step === 6) {
      this.snareSynth.triggerAttackRelease("16n", time, 0.35 + energy * 0.25);
    }

    if (density > 0.35) {
      const hatVelocity = 0.12 + density * 0.12;
      this.hatSynth.triggerAttackRelease("32n", time, hatVelocity);
      if (density > 0.65) {
        this.hatSynth.triggerAttackRelease("32n", time + Tone.Time("16n").toSeconds() * 0.5, hatVelocity * 0.75);
      }
    }

    if (rain > 0.2) {
      this.rainHatSynth.triggerAttackRelease("64n", time, 0.1 + rain * 0.2);
    }

    const bassNote = pick(this.activeShape.bassPattern, step);
    this.bassSynth.triggerAttackRelease(bassNote, "8n", time, 0.52 + energy * 0.3);

    if (energy > 0.45 && density > 0.4) {
      const leadNote = pick(this.activeShape.leadPattern, step);
      this.leadSynth.triggerAttackRelease(leadNote, "16n", time, 0.25 + energy * 0.35);
    }

    if (this.latestMix.crunch > 0.4 && (step === 0 || step === 4)) {
      const progression = pick(this.activeShape.chordProgressions, this.progressionVariant);
      const chord = pick(progression, this.chordIndex);
      this.guitarSynth.triggerAttackRelease(chord, "8n", time, 0.25 + this.latestMix.crunch * 0.3);
    }

    this.stepIndex += 1;
  }

  private onChord(time: number): void {
    const progression = pick(this.activeShape.chordProgressions, this.progressionVariant);
    const chord = pick(progression, this.chordIndex);
    this.padSynth.triggerAttackRelease(chord, "2n", time, 0.45);

    this.chordIndex += 1;
    if (this.chordIndex % progression.length === 0) {
      this.progressionVariant = (this.progressionVariant + 1) % this.activeShape.chordProgressions.length;
    }
  }

  private duckPad(time: number): void {
    const padGain = this.gains.pad.gain;
    const base = Math.max(0.001, padGain.value);
    padGain.cancelScheduledValues(time);
    padGain.setValueAtTime(base, time);
    padGain.linearRampToValueAtTime(base * 0.72, time + 0.03);
    padGain.linearRampToValueAtTime(base, time + 0.2);
  }
}
