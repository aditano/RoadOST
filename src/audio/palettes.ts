import type { MixPalette, PaletteOverlay } from "../sensors/types";

export type PaletteShape = {
  keyLabel: string;
  bassPattern: string[];
  leadPattern: string[];
  chordProgressions: string[][][];
};

const PALETTES: Record<MixPalette, PaletteShape> = {
  dawn: {
    keyLabel: "A minor",
    bassPattern: ["A2", "A2", "C3", "E3", "A2", "G2", "E3", "C3"],
    leadPattern: ["A4", "C5", "E5", "G5", "E5", "C5", "A4", "G4"],
    chordProgressions: [
      [
        ["A3", "C4", "E4"],
        ["F3", "A3", "C4"],
        ["C4", "E4", "G4"],
        ["G3", "B3", "D4"]
      ],
      [
        ["A3", "C4", "E4"],
        ["G3", "B3", "D4"],
        ["F3", "A3", "C4"],
        ["G3", "B3", "D4"]
      ]
    ]
  },
  day: {
    keyLabel: "E minor",
    bassPattern: ["E2", "E2", "G2", "B2", "E2", "D2", "B2", "G2"],
    leadPattern: ["E4", "G4", "B4", "D5", "B4", "G4", "E4", "D4"],
    chordProgressions: [
      [
        ["E3", "G3", "B3"],
        ["C3", "E3", "G3"],
        ["G3", "B3", "D4"],
        ["D3", "F#3", "A3"]
      ],
      [
        ["E3", "G3", "B3"],
        ["D3", "F#3", "A3"],
        ["C3", "E3", "G3"],
        ["D3", "F#3", "A3"]
      ]
    ]
  },
  dusk: {
    keyLabel: "F# minor",
    bassPattern: ["F#2", "F#2", "A2", "C#3", "F#2", "E2", "C#3", "A2"],
    leadPattern: ["F#4", "A4", "C#5", "E5", "C#5", "A4", "F#4", "E4"],
    chordProgressions: [
      [
        ["F#3", "A3", "C#4"],
        ["D3", "F#3", "A3"],
        ["A3", "C#4", "E4"],
        ["E3", "G#3", "B3"]
      ],
      [
        ["F#3", "A3", "C#4"],
        ["E3", "G#3", "B3"],
        ["D3", "F#3", "A3"],
        ["E3", "G#3", "B3"]
      ]
    ]
  },
  night: {
    keyLabel: "D minor",
    bassPattern: ["D2", "D2", "F2", "A2", "D2", "C2", "A2", "F2"],
    leadPattern: ["D4", "F4", "A4", "C5", "A4", "F4", "D4", "C4"],
    chordProgressions: [
      [
        ["D3", "F3", "A3"],
        ["Bb2", "D3", "F3"],
        ["F3", "A3", "C4"],
        ["C3", "E3", "G3"]
      ],
      [
        ["D3", "F3", "A3"],
        ["C3", "E3", "G3"],
        ["Bb2", "D3", "F3"],
        ["C3", "E3", "G3"]
      ]
    ]
  }
};

const rotate = <T>(values: T[], amount: number): T[] => [
  ...values.slice(amount),
  ...values.slice(0, amount)
];

export const getPaletteShape = (
  palette: MixPalette,
  overlay: PaletteOverlay | null = null
): PaletteShape => {
  const base = PALETTES[palette];
  if (!overlay) {
    return base;
  }

  if (overlay === "storm") {
    return {
      keyLabel: `${base.keyLabel}, storm`,
      bassPattern: rotate(base.bassPattern, 4),
      leadPattern: [...base.leadPattern].reverse(),
      chordProgressions: [...base.chordProgressions].reverse()
    };
  }

  return {
    keyLabel: `${base.keyLabel}, gold`,
    bassPattern: rotate(base.bassPattern, 2),
    leadPattern: rotate(base.leadPattern, 3),
    chordProgressions: base.chordProgressions.map((progression) => rotate(progression, 1))
  };
};
