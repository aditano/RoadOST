import { describe, expect, test } from "vitest";
import { ArrangementEngine, sectionForEnergy } from "./arrange";

describe("ArrangementEngine", () => {
  test("holds the intro for eight bars", () => {
    const arrange = new ArrangementEngine();
    for (let bar = 0; bar < 7; bar += 1) {
      expect(arrange.advanceBar({ energy: 0.9, tunnel: 0 }).section).toBe("intro");
    }
    expect(arrange.advanceBar({ energy: 0.9, tunnel: 0 }).section).toBe("chorus");
  });

  test("maps energy bands to verse, lift, and chorus", () => {
    expect(sectionForEnergy(0.4, "intro")).toBe("verse");
    expect(sectionForEnergy(0.62, "verse")).toBe("lift");
    expect(sectionForEnergy(0.8, "lift")).toBe("chorus");
    expect(sectionForEnergy(0.2, "verse")).toBe("verse");
    expect(sectionForEnergy(0.2, "chorus")).toBe("break");
  });

  test("holds a section for four bars before changing", () => {
    const arrange = new ArrangementEngine();
    for (let bar = 0; bar < 8; bar += 1) {
      arrange.advanceBar({ energy: 0.82, tunnel: 0 });
    }
    expect(arrange.getState().section).toBe("chorus");

    for (let bar = 0; bar < 3; bar += 1) {
      expect(arrange.advanceBar({ energy: 0.4, tunnel: 0 }).section).toBe("chorus");
    }
    expect(arrange.advanceBar({ energy: 0.4, tunnel: 0 }).section).toBe("verse");
  });

  test("tunnel spikes force a two bar break", () => {
    const arrange = new ArrangementEngine();
    for (let bar = 0; bar < 8; bar += 1) {
      arrange.advanceBar({ energy: 0.82, tunnel: 0 });
    }

    expect(arrange.advanceBar({ energy: 0.82, tunnel: 0.9 }).section).toBe("break");
    expect(arrange.advanceBar({ energy: 0.82, tunnel: 0.5 }).section).toBe("break");
    expect(arrange.advanceBar({ energy: 0.82, tunnel: 0.3 }).section).toBe("chorus");
  });

  test("fires a one bar fill on an eight bar energy swing", () => {
    const arrange = new ArrangementEngine();
    for (let bar = 0; bar < 6; bar += 1) {
      arrange.advanceBar({ energy: 0.2, tunnel: 0 });
    }
    arrange.advanceBar({ energy: 0.45, tunnel: 0 });
    const eighth = arrange.advanceBar({ energy: 0.85, tunnel: 0 });
    expect(eighth.fill).toBe(1);

    const ninth = arrange.advanceBar({ energy: 0.85, tunnel: 0 });
    expect(ninth.fill).toBe(0);
  });
});
