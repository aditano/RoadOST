import type {
  FeatureFrame,
  MixPalette,
  PaletteOverlay,
  WeatherFrame
} from "../sensors/types";

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;

export const smoothstep = (value: number, edge0: number, edge1: number): number => {
  if (edge1 === edge0) {
    return value >= edge1 ? 1 : 0;
  }

  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

export const paletteFromHour = (hour: number): MixPalette => {
  if (hour >= 5 && hour < 8) {
    return "dawn";
  }
  if (hour >= 8 && hour < 17) {
    return "day";
  }
  if (hour >= 17 && hour < 21) {
    return "dusk";
  }
  return "night";
};

const rainCodes = new Set<number>([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99
]);

const darkWeatherCodes = new Set<number>([
  45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 95,
  96, 99
]);

export const isRainCode = (code: number | null | undefined): boolean => {
  if (typeof code !== "number" || Number.isNaN(code)) {
    return false;
  }
  return rainCodes.has(code);
};

export const isDarkWeatherCode = (code: number | null | undefined): boolean => {
  if (typeof code !== "number" || Number.isNaN(code)) {
    return false;
  }
  return darkWeatherCodes.has(code);
};

export const rainFromWeather = (weather: WeatherFrame | null): number => {
  if (!weather) {
    return 0;
  }

  const precipComponent = smoothstep(weather.precipMmHr, 0, 7);
  const codeBoost = isRainCode(weather.code) ? 0.62 : 0;
  return clamp01(Math.max(precipComponent, codeBoost));
};

export const windFromWeather = (weather: WeatherFrame | null): number =>
  smoothstep(weather?.windMps ?? 0, 2, 20);

export const overlayFromFrame = (
  frame: FeatureFrame,
  palette: MixPalette,
  rain: number,
  wind: number
): PaletteOverlay | null => {
  const code = frame.weather?.code ?? 0;
  const snow = code >= 71 && code <= 77;
  if (rain > 0.55 || snow || code >= 95 || (wind > 0.7 && (frame.weather?.cloud ?? 0) > 0.7)) {
    return "storm";
  }
  if (
    palette === "dusk" &&
    rain < 0.2 &&
    (frame.weather?.tempC ?? 0) >= 26
  ) {
    return "gold";
  }
  return null;
};

export const brightnessFromFrame = (
  frame: FeatureFrame,
  palette: MixPalette,
  rain: number
): number => {
  const weather = frame.weather;
  const cloud = weather ? clamp01(weather.cloud) : 0.25;
  const darkWeatherPenalty = weather && isDarkWeatherCode(weather.code) ? 0.16 : 0;

  const baseByPalette: Record<MixPalette, number> = {
    dawn: 0.64,
    day: 0.86,
    dusk: 0.5,
    night: 0.28
  };

  const clearBoost = palette === "day" && cloud < 0.25 ? 0.06 : 0;
  const nightPenalty = palette === "night" ? 0.12 : 0;
  const rainPenalty = rain * 0.2;
  const cloudPenalty = cloud * 0.22;

  return clamp01(
    baseByPalette[palette] + clearBoost - cloudPenalty - darkWeatherPenalty - rainPenalty - nightPenalty
  );
};

export const normalizedSpeed = (speedMps: number | null): number => {
  if (typeof speedMps !== "number" || Number.isNaN(speedMps)) {
    return 0;
  }
  return clamp01(speedMps / 33);
};

export const normalizedAccel = (accelMps2: number | null): number => {
  if (typeof accelMps2 !== "number" || Number.isNaN(accelMps2)) {
    return 0;
  }
  return smoothstep(Math.abs(accelMps2), 0.15, 4.25);
};
