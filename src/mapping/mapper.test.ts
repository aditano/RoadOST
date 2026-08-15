import { describe, expect, test } from "vitest";
import type { FeatureFrame } from "../sensors/types";
import { Mapper } from "./mapper";

const baseFrame = (overrides: Partial<FeatureFrame> = {}): FeatureFrame => ({
  t: 0,
  speedMps: 0,
  accelMps2: 0,
  headingDeg: 0,
  lux: 500,
  hourLocal: 12,
  weather: {
    code: 0,
    precipMmHr: 0,
    cloud: 0.05,
    tempC: 20,
    isNight: false
  },
  source: {
    geo: "sim",
    motion: "sim",
    light: "sim",
    weather: "sim"
  },
  ...overrides
});

describe("Mapper", () => {
  test("0 m/s maps near low bpm with low energy", () => {
    const mapper = new Mapper();
    const mix = mapper.update(baseFrame({ speedMps: 0, accelMps2: 0, t: 0 }));

    expect(mix.bpm).toBeCloseTo(92, 3);
    expect(mix.energy).toBeLessThan(0.2);
  });

  test("33 m/s maps near high bpm", () => {
    const mapper = new Mapper();
    const mix = mapper.update(baseFrame({ speedMps: 33, accelMps2: 1, t: 0 }));

    expect(mix.bpm).toBeCloseTo(164, 3);
  });

  test("rain weather code maps rain over 0.5", () => {
    const mapper = new Mapper();
    const mix = mapper.update(
      baseFrame({
        weather: {
          code: 81,
          precipMmHr: 0.4,
          cloud: 0.8,
          tempC: 12,
          isNight: false
        }
      })
    );

    expect(mix.rain).toBeGreaterThan(0.5);
  });

  test("night palette lowers brightness versus noon clear", () => {
    const mapper = new Mapper();
    const noon = mapper.update(baseFrame({ hourLocal: 12 }));

    const mapperNight = new Mapper();
    const night = mapperNight.update(
      baseFrame({
        hourLocal: 23,
        weather: { code: 0, precipMmHr: 0, cloud: 0.05, tempC: 14, isNight: true }
      })
    );

    expect(noon.palette).toBe("day");
    expect(night.palette).toBe("night");
    expect(night.brightness).toBeLessThan(noon.brightness);
  });

  test("tunnel spikes on fast lux drop then decays", () => {
    const mapper = new Mapper();
    mapper.update(baseFrame({ t: 0, lux: 1000 }));

    const spike = mapper.update(baseFrame({ t: 900, lux: 200 }));
    expect(spike.tunnel).toBeGreaterThan(0.95);

    const decayed = mapper.update(baseFrame({ t: 9000, lux: 220 }));
    expect(decayed.tunnel).toBeLessThan(spike.tunnel);
    expect(decayed.tunnel).toBeGreaterThan(0);
  });

  test("null sensors do not produce NaN", () => {
    const mapper = new Mapper();
    const mix = mapper.update(
      baseFrame({
        speedMps: null,
        accelMps2: null,
        headingDeg: null,
        lux: null,
        weather: null,
        source: {
          geo: "missing",
          motion: "missing",
          light: "missing",
          weather: "missing"
        }
      })
    );

    for (const value of Object.values(mix)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
