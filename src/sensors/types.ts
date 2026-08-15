export type SourceState = "live" | "sim" | "missing";

export type WeatherFrame = {
  code: number;
  precipMmHr: number;
  cloud: number;
  tempC: number;
  isNight: boolean;
};

export type FeatureFrame = {
  t: number;
  speedMps: number | null;
  accelMps2: number | null;
  headingDeg: number | null;
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

export type MixState = {
  bpm: number;
  energy: number;
  density: number;
  brightness: number;
  crunch: number;
  rain: number;
  tunnel: number;
  palette: MixPalette;
};
