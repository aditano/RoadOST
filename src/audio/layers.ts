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
  sub: Tone.Gain;
  fill: Tone.Gain;
  riser: Tone.Gain;
  wind: Tone.Gain;
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
  private readonly subSynth: Tone.Synth;
  private readonly guitarSynth: Tone.PolySynth;
  private readonly guitarFilter: Tone.Filter;
  private readonly guitarDrive: Tone.Distortion;
  private readonly guitarPanner: Tone.Panner;
  private readonly padSynth: Tone.PolySynth;
  private readonly padFilter: Tone.Filter;
  private readonly leadSynth: Tone.Synth;
  private readonly leadPanner: Tone.Panner;
  private readonly tomSynth: Tone.MembraneSynth;
  private readonly crashSynth: Tone.NoiseSynth;
  private readonly riserSynth: Tone.Synth;
  private readonly riserFilter: Tone.Filter;
  private readonly thunderSynth: Tone.MembraneSynth;
  private readonly weatherNoise: Tone.Noise;
  private readonly weatherFilter: Tone.Filter;
  private readonly windNoise: Tone.Noise;
  private readonly windFilter: Tone.Filter;
  private readonly stepLoop: Tone.Loop;
  private readonly chordLoop: Tone.Loop;
  private stepIndex = 0;
  private chordIndex = 0;
  private progressionVariant = 0;
  private riserPending = false;
  private activeShape: PaletteShape;
  private latestMix: MixState = {
    bpm: 92,
    energy: 0,
    density: 0,
    brightness: 0.4,
    crunch: 0,
    rain: 0,
    tunnel: 0,
    wind: 0,
    fill: 0,
    thunder: 0,
    section: "intro",
    palette: "night",
    overlay: null
  };

  constructor(rootBus: Tone.ToneAudioNode, initialShape: PaletteShape) {
    const drumsGain = new Tone.Gain(0);
    const bassGain = new Tone.Gain(0);
    const guitarGain = new Tone.Gain(0);
    const padGain = new Tone.Gain(0);
    const leadGain = new Tone.Gain(0);
    const weatherGain = new Tone.Gain(0);
    const rainHatGain = new Tone.Gain(0);
    const subGain = new Tone.Gain(0);
    const fillGain = new Tone.Gain(0);
    const riserGain = new Tone.Gain(0);
    const windGain = new Tone.Gain(0);

    this.gains = {
      drums: drumsGain,
      bass: bassGain,
      guitar: guitarGain,
      pad: padGain,
      lead: leadGain,
      weather: weatherGain,
      rainHat: rainHatGain,
      sub: subGain,
      fill: fillGain,
      riser: riserGain,
      wind: windGain
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
    this.subSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.18, sustain: 0.35, release: 0.28 }
    }).connect(subGain);

    this.guitarFilter = new Tone.Filter({ type: "lowpass", frequency: 1500, Q: 1.2 });
    this.guitarDrive = new Tone.Distortion(0.3);
    this.guitarPanner = new Tone.Panner(0);
    this.guitarSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.24 }
    });
    this.guitarSynth.chain(this.guitarFilter, this.guitarDrive, this.guitarPanner, guitarGain);

    this.padFilter = new Tone.Filter({ type: "lowpass", frequency: 1800, Q: 0.6 });
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.3, decay: 0.7, sustain: 0.72, release: 1.2 }
    });
    this.padSynth.chain(this.padFilter, padGain);

    this.leadPanner = new Tone.Panner(0);
    this.leadSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.16, sustain: 0.2, release: 0.2 }
    }).chain(this.leadPanner, leadGain);

    this.tomSynth = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 2,
      envelope: { attack: 0.002, decay: 0.22, sustain: 0.02, release: 0.18 }
    }).connect(fillGain);
    this.crashSynth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.18 }
    }).connect(fillGain);
    this.riserFilter = new Tone.Filter({ type: "bandpass", frequency: 900, Q: 0.8 });
    this.riserSynth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.18, decay: 0.7, sustain: 0.2, release: 0.5 }
    });
    this.riserSynth.chain(this.riserFilter, riserGain);
    this.thunderSynth = new Tone.MembraneSynth({
      pitchDecay: 0.48,
      octaves: 5,
      envelope: { attack: 0.01, decay: 0.7, sustain: 0.02, release: 0.8 }
    }).connect(weatherGain);

    this.weatherFilter = new Tone.Filter({ type: "bandpass", frequency: 800, Q: 0.7 });
    this.weatherNoise = new Tone.Noise("pink");
    this.weatherNoise.chain(this.weatherFilter, weatherGain);
    this.windFilter = new Tone.Filter({ type: "lowpass", frequency: 620, Q: 0.5 });
    this.windNoise = new Tone.Noise("brown");
    this.windNoise.chain(this.windFilter, windGain);

    drumsGain.connect(rootBus);
    rainHatGain.connect(rootBus);
    bassGain.connect(rootBus);
    guitarGain.connect(rootBus);
    padGain.connect(rootBus);
    leadGain.connect(rootBus);
    weatherGain.connect(rootBus);
    subGain.connect(rootBus);
    fillGain.connect(rootBus);
    riserGain.connect(rootBus);
    windGain.connect(rootBus);

    this.activeShape = initialShape;
    this.stepLoop = new Tone.Loop((time) => this.onStep(time), "8n");
    this.chordLoop = new Tone.Loop((time) => this.onChord(time), "1m");
  }

  start(): void {
    this.weatherNoise.start();
    this.windNoise.start();
    this.stepLoop.start(0);
    this.chordLoop.start(0);
  }

  stop(): void {
    this.stepLoop.stop();
    this.chordLoop.stop();
    this.weatherNoise.stop();
    this.windNoise.stop();
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
    this.subSynth.dispose();
    this.guitarSynth.dispose();
    this.padSynth.dispose();
    this.leadSynth.dispose();
    this.tomSynth.dispose();
    this.crashSynth.dispose();
    this.riserSynth.dispose();
    this.thunderSynth.dispose();
    this.weatherNoise.dispose();
    this.weatherFilter.dispose();
    this.windNoise.dispose();
    this.windFilter.dispose();
    this.riserFilter.dispose();
    this.guitarDrive.dispose();
    this.guitarFilter.dispose();
    this.guitarPanner.dispose();
    this.leadPanner.dispose();
    this.padFilter.dispose();
    for (const gain of Object.values(this.gains)) {
      gain.dispose();
    }
  }

  setShape(shape: PaletteShape): void {
    this.activeShape = shape;
    this.chordIndex = 0;
  }

  setMix(mix: MixState): void {
    if (mix.section === "chorus" && this.latestMix.section !== "chorus") {
      this.riserPending = true;
    }
    this.latestMix = mix;

    const tunnelDuck = 1 - mix.tunnel * 0.55;
    const rainLeadCut = 1 - (mix.rain > 0.45 ? mix.rain * 0.42 : mix.rain * 0.2);
    const sectionDrive = {
      intro: 0.55,
      verse: 0.78,
      lift: 0.94,
      chorus: 1,
      break: 0.28
    }[mix.section];
    const stormDrive = mix.overlay === "storm" ? 1.08 : 1;
    this.gains.drums.gain.rampTo(
      clamp01((0.16 + mix.density * 0.68) * sectionDrive) * tunnelDuck,
      0.1
    );
    this.gains.bass.gain.rampTo(
      clamp01((0.14 + mix.energy * 0.58) * Math.max(0.5, sectionDrive)) * tunnelDuck,
      0.12
    );
    this.gains.guitar.gain.rampTo(
      mix.energy < 0.25 || mix.section === "break"
        ? 0
        : clamp01((mix.crunch * 0.62 + (mix.energy - 0.25) * 0.62) * sectionDrive) *
          tunnelDuck,
      0.14
    );
    this.gains.pad.gain.rampTo(
      clamp01(0.16 + (1 - mix.brightness) * 0.48 + mix.rain * 0.18 + mix.tunnel * 0.22),
      0.2
    );
    this.gains.lead.gain.rampTo(
      mix.energy > 0.45 && mix.section !== "intro" && mix.section !== "break"
        ? clamp01((mix.energy - 0.45) * 1.12 * sectionDrive) * rainLeadCut * tunnelDuck
        : 0,
      0.12
    );
    this.gains.weather.gain.rampTo(clamp01(mix.rain * 0.34 + mix.thunder * 0.05), 0.24);
    this.gains.rainHat.gain.rampTo(clamp01((mix.rain - 0.12) * 0.62), 0.1);
    const subEnabled = mix.section === "chorus" || mix.bpm > 145;
    this.gains.sub.gain.rampTo(subEnabled ? clamp01(0.1 + mix.energy * 0.28) : 0, 0.16);
    this.gains.fill.gain.rampTo(clamp01(mix.fill * 0.6), 0.08);
    this.gains.riser.gain.rampTo(mix.section === "chorus" ? 0.16 : 0.08, 0.16);
    this.gains.wind.gain.rampTo(clamp01(mix.wind * 0.24), 0.3);

    this.guitarDrive.distortion = clamp01((0.22 + mix.crunch * 0.64) * stormDrive);
    this.guitarFilter.frequency.rampTo(700 + mix.brightness * 2000, 0.18);
    this.padFilter.frequency.rampTo(720 + mix.brightness * 1500 + mix.tunnel * 1050, 0.24);
    this.weatherFilter.frequency.rampTo(450 + mix.rain * 900, 0.22);
    this.windFilter.frequency.rampTo(280 + mix.wind * 720, 0.3);
    const stereoMotion = clamp01(mix.fill) * (this.stepIndex % 2 === 0 ? 0.42 : -0.42);
    this.leadPanner.pan.rampTo(stereoMotion, 0.12);
    this.guitarPanner.pan.rampTo(-stereoMotion * 0.6, 0.12);
  }

  private onStep(time: number): void {
    const step = this.stepIndex % 8;
    const density = this.latestMix.density;
    const energy = this.latestMix.energy;
    const rain = this.latestMix.rain;
    const section = this.latestMix.section;
    const phraseOffset = Math.floor(this.stepIndex / 32) * 2;

    const kickHit =
      step === 0 ||
      (section !== "break" && step === 4) ||
      (section === "chorus" && energy > 0.75 && step === 6);
    if (kickHit) {
      this.kickSynth.triggerAttackRelease("C1", "8n", time, 0.95);
      this.duckPad(time);
    }

    if (section !== "break" && (step === 2 || step === 6)) {
      this.snareSynth.triggerAttackRelease("16n", time, 0.35 + energy * 0.25);
    }

    if (density > 0.35 && section !== "break") {
      const hatVelocity = 0.12 + density * 0.12;
      this.hatSynth.triggerAttackRelease("32n", time, hatVelocity);
      if (density > 0.65) {
        this.hatSynth.triggerAttackRelease("32n", time + Tone.Time("16n").toSeconds() * 0.5, hatVelocity * 0.75);
      }
    }

    if (rain > 0.2) {
      this.rainHatSynth.triggerAttackRelease("64n", time, 0.1 + rain * 0.2);
      if (rain > 0.45 && step % 2 === 1) {
        this.rainHatSynth.triggerAttackRelease("64n", time + 0.025, 0.08 + rain * 0.16);
      }
    }

    const bassNote = pick(this.activeShape.bassPattern, step + phraseOffset);
    if (section !== "break" || step === 0) {
      this.bassSynth.triggerAttackRelease(bassNote, "8n", time, 0.42 + energy * 0.25);
    }
    if ((section === "chorus" || this.latestMix.bpm > 145) && (step === 0 || step === 4)) {
      const subNote = Tone.Frequency(bassNote).transpose(-12).toNote();
      this.subSynth.triggerAttackRelease(subNote, "4n", time, 0.38 + energy * 0.2);
    }

    if (energy > 0.45 && density > 0.4 && section !== "intro" && section !== "break") {
      const leadNote = pick(this.activeShape.leadPattern, step + phraseOffset);
      this.leadSynth.triggerAttackRelease(leadNote, "16n", time, 0.25 + energy * 0.35);
    }

    if (this.latestMix.crunch > 0.4 && (step === 0 || step === 4)) {
      const progression = pick(this.activeShape.chordProgressions, this.progressionVariant);
      const chord = pick(progression, this.chordIndex);
      this.guitarSynth.triggerAttackRelease(chord, "8n", time, 0.25 + this.latestMix.crunch * 0.3);
    }

    if (this.latestMix.fill > 0.45 && step >= 4) {
      const tomNotes = ["C2", "G1", "D2", "A1"];
      this.tomSynth.triggerAttackRelease(pick(tomNotes, step - 4), "16n", time, 0.42);
      if (step === 7) {
        this.crashSynth.triggerAttackRelease("4n", time, 0.24);
      }
    }

    if (this.latestMix.thunder > 0.5 && this.stepIndex % 64 === 29) {
      this.thunderSynth.triggerAttackRelease("C0", "2n", time, 0.22);
    }

    this.stepIndex += 1;
  }

  private onChord(time: number): void {
    const progression = pick(this.activeShape.chordProgressions, this.progressionVariant);
    const chord = pick(progression, this.chordIndex);
    const padVelocity = this.latestMix.section === "break" ? 0.52 : 0.38;
    this.padSynth.triggerAttackRelease(chord, "2n", time, padVelocity);

    if (this.riserPending) {
      this.riserPending = false;
      this.riserFilter.frequency.cancelScheduledValues(time);
      this.riserFilter.frequency.setValueAtTime(240, time);
      this.riserFilter.frequency.exponentialRampToValueAtTime(2600, time + Tone.Time("1m").toSeconds());
      this.riserSynth.triggerAttackRelease(pick(this.activeShape.bassPattern, 0), "1m", time, 0.16);
    }

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
