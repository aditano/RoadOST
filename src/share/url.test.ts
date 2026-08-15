import { describe, expect, test } from "vitest";
import { parseRoadOstUrl, serializeRoadOstUrl } from "./url";

describe("RoadOST share URLs", () => {
  test("defaults to the landing view", () => {
    expect(parseRoadOstUrl("https://example.com/RoadOST/")).toEqual({
      view: "landing",
      sim: false,
      preset: null,
      demo: false
    });
  });

  test("simulator and preset flags restore the studio", () => {
    expect(
      parseRoadOstUrl(
        "https://example.com/RoadOST/?sim=1&preset=night-rain-highway"
      )
    ).toEqual({
      view: "studio",
      sim: true,
      preset: "night-rain-highway",
      demo: false
    });
  });

  test("serializes only compact view state", () => {
    const url = serializeRoadOstUrl(
      {
        view: "studio",
        sim: true,
        preset: "blizzard",
        demo: false
      },
      "https://aditano.github.io/RoadOST/?old=1#studio"
    );
    expect(url).toBe(
      "https://aditano.github.io/RoadOST/?view=studio&sim=1&preset=blizzard"
    );
  });

  test("ignores unknown presets and supports the studio hash", () => {
    const state = parseRoadOstUrl(
      "https://example.com/RoadOST/?preset=unknown#studio"
    );
    expect(state.view).toBe("studio");
    expect(state.preset).toBeNull();
  });
});
