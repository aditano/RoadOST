import { describe, expect, test } from "vitest";
import { Mapper } from "../mapping/mapper";
import { SimulatorController, type SimulatorPresetId } from "./simulator";

const mappedPreset = (id: SimulatorPresetId) => {
  const simulator = new SimulatorController();
  const mapper = new Mapper();
  simulator.applyPreset(id);
  let mix = mapper.update(simulator.getFeatureFrame(0));
  for (let t = 100; t <= 24000; t += 100) {
    mix = mapper.update(simulator.getFeatureFrame(t));
  }
  return mix;
};

describe("simulator presets", () => {
  test("night highway, sunny neighborhood, and blizzard map differently", () => {
    const highway = mappedPreset("night-rain-highway");
    const sunny = mappedPreset("sunny-neighborhood");
    const blizzard = mappedPreset("blizzard");

    expect(highway.bpm).toBeGreaterThan(sunny.bpm + 30);
    expect(highway.rain).toBeGreaterThan(sunny.rain + 0.5);
    expect(blizzard.brightness).toBeLessThan(sunny.brightness - 0.3);
    expect(blizzard.wind).toBeGreaterThan(highway.wind);
    expect(new Set([highway.overlay, sunny.overlay, blizzard.overlay]).size).toBeGreaterThan(1);
    expect(highway.section).not.toBe(sunny.section);
    expect(highway.section).not.toBe("intro");
    expect(sunny.section).not.toBe("intro");
  });
});
