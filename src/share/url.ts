import {
  SIMULATOR_PRESET_IDS,
  type SimulatorPresetId
} from "../sensors/simulator";

export type RoadOstView = "landing" | "studio";

export type RoadOstUrlState = {
  view: RoadOstView;
  sim: boolean;
  preset: SimulatorPresetId | null;
  demo: boolean;
};

const isPresetId = (value: string | null): value is SimulatorPresetId =>
  value !== null && SIMULATOR_PRESET_IDS.some((id) => id === value);

export const parseRoadOstUrl = (input: string | URL): RoadOstUrlState => {
  const url = input instanceof URL ? input : new URL(input, "https://roadost.local/RoadOST/");
  const presetValue = url.searchParams.get("preset");
  const preset = isPresetId(presetValue) ? presetValue : null;
  const sim = url.searchParams.get("sim") === "1";
  const demo = url.searchParams.get("demo") === "1";
  const studioRequested =
    url.searchParams.get("view") === "studio" ||
    url.hash === "#studio" ||
    sim ||
    preset !== null ||
    demo;

  return {
    view: studioRequested ? "studio" : "landing",
    sim,
    preset,
    demo
  };
};

export const serializeRoadOstUrl = (
  state: RoadOstUrlState,
  baseUrl: string | URL
): string => {
  const url = baseUrl instanceof URL ? new URL(baseUrl.href) : new URL(baseUrl);
  url.search = "";
  url.hash = "";
  if (state.view === "studio") {
    url.searchParams.set("view", "studio");
  }
  if (state.sim) {
    url.searchParams.set("sim", "1");
  }
  if (state.preset) {
    url.searchParams.set("preset", state.preset);
  }
  if (state.demo) {
    url.searchParams.set("demo", "1");
  }
  return url.toString();
};
