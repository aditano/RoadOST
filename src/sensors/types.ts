export type SourceState = "live" | "sim" | "missing";

export type WeatherFrame = {
  code: number;
  precipMmHr: number;
  cloud: number;
  tempC: number;
  isNight: boolean;
  windMps: number;
  visibility?: number;
};

export type FeatureFrame = {
  t: number;
  speedMps: number | null;
  accelMps2: number | null;
  headingDeg: number | null;
  headingRate: number | null;
  lux: number | null;
  hourLocal: number;
  weather: WeatherFrame | null;
  source: {
    geo: SourceState;
    motion: SourceState;
    light: SourceState;
    weather: SourceState;
  };
};

export type MixPalette = "dawn" | "day" | "dusk" | "night";
export type PaletteOverlay = "storm" | "gold";
export type Section = "intro" | "verse" | "lift" | "chorus" | "break";

export type MixState = {
  bpm: number;
  energy: number;
  density: number;
  brightness: number;
  crunch: number;
  rain: number;
  tunnel: number;
  wind: number;
  fill: number;
  thunder: number;
  section: Section;
  palette: MixPalette;
  overlay: PaletteOverlay | null;
};
