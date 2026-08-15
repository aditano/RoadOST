# RoadOST — build spec (Cursor: implement this, do not invent a different product)

You are building **RoadOST**, a browser app that turns a drive into a live rock / cinematic **score**.

This is **not** a live Suno/MusicGen song generator. Full song models are too slow and too random for a moving car. The live engine is a **game-audio stem mixer**: a small bank of layers (drums, bass, guitar, pad, lead) that swell, thin out, brighten, and distort from sensor features.

## Product rules

1. Pure software. No native iOS app in v1. No backend. No API keys.
2. Works on a laptop in **Simulator** mode (required for development and GitHub Pages demo).
3. Works on a phone in a car over Bluetooth: one **Start score** tap, then zero required taps.
4. Taste: classic/hard rock + 80s cinema + Halo-like score energy. Immediately catchy. No rap. No soft pop. No spa/lofi/ambient wellness.
5. Honest about sensors. If a sensor is missing, degrade and show it. Never fake GPS speed as if it were live.
6. Safety: while `driving` is true, hide settings, ignore accidental taps except **Stop**. Giant Stop target.
7. MIT license. No copyrighted stems, no artist names in the audio engine, no trademarked Halo assets.

## Stack (do not substitute)

- Vite 6 + TypeScript (strict)
- Vanilla TS, no React/Vue/Svelte
- Web Audio API via **Tone.js** (latest stable)
- Vitest for unit tests
- GitHub Actions: `npm test` + `npm run build` on push
- GitHub Pages deploy from `main` (`npm run build`, publish `dist`)
- No CSS framework. Custom dark cinematic UI. One `src/styles.css`.
- No analytics. No cookies. No accounts.

## Repo layout

```
index.html
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
.github/workflows/ci.yml
src/
  main.ts                 # boot
  app.ts                  # wiring
  audio/
    engine.ts             # Tone.js graph, start/stop, export
    layers.ts             # synth/sample layers + how they respond
    palettes.ts           # night / dawn / day / dusk instrument palettes
  sensors/
    types.ts
    bus.ts                # fused FeatureFrame @ ~20 Hz
    geolocation.ts
    motion.ts
    light.ts
    clock.ts
    weather.ts            # Open-Meteo, no key
    simulator.ts          # desktop scenario player
  mapping/
    features.ts           # raw sensors → FeatureFrame
    mapper.ts             # FeatureFrame → MixState
    mapper.test.ts
  ui/
    hud.ts
    controls.ts
    visualizer.ts         # canvas: bars for energy / rain / speed, not a phone-staring toy
  export/
    recorder.ts           # MediaRecorder on the audio destination
  styles.css
public/
  favicon.svg
```

Keep modules small. No 1,500-line files.

## Feature fusion

`FeatureFrame` (update ~20 Hz, weather can be slower):

```ts
type FeatureFrame = {
  t: number                 // performance.now()
  speedMps: number | null   // GPS or simulator
  accelMps2: number | null  // high-passed / derived, not raw gravity
  headingDeg: number | null
  lux: number | null        // Ambient Light Sensor if present
  hourLocal: number         // 0-23.99
  weather: {
    code: number            // WMO weathercode
    precipMmHr: number
    cloud: number           // 0-1
    tempC: number
    isNight: boolean        // from Open-Meteo or sun calc
  } | null
  source: {
    geo: "live" | "sim" | "missing"
    motion: "live" | "sim" | "missing"
    light: "live" | "sim" | "missing"
    weather: "live" | "sim" | "missing"
  }
}
```

### Sensor notes

- **GPS:** `watchPosition` with `enableHighAccuracy`. Derive speed from `coords.speed` when finite; else compute from successive lat/lon + time. Clamp 0–50 m/s.
- **Motion:** `devicemotion`. Subtract gravity. Use RMS of linear acceleration over 0.6 s. iOS needs a user-gesture permission; request on Start.
- **Light:** `AmbientLightSensor` if available (mostly Chromium). Else estimate from hour + weather cloud cover + a manual override in Simulator.
- **Weather:** Open-Meteo `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,weather_code,precipitation,cloud_cover,is_day`. Refresh every 5 minutes or on big location jumps. If geo missing, use a default lat/lon only in Simulator (Pittsburgh 40.44, -79.99) and label it SIM.
- **Time:** local clock. Always available.

## Mapping (the product)

`MixState`:

```ts
type MixState = {
  bpm: number               // 88–168
  energy: number            // 0-1 overall intensity
  density: number           // 0-1 how many layers audible
  brightness: number        // 0-1 filter / scale major-ish vs dark
  crunch: number            // 0-1 distortion / guitar drive
  rain: number              // 0-1 wet texture
  tunnel: number            // 0-1 sudden dark duck (light drop)
  palette: "dawn" | "day" | "dusk" | "night"
}
```

Rules (implement exactly, then unit-test):

1. `bpm = lerp(92, 164, smoothstep(speedMps, 4, 33))` (about 9–74 mph)
2. `energy` from speed (70%) + accel RMS (30%), smoothed with attack 0.6 s / release 2.4 s
3. `density` follows energy, but rain adds +0.15 hats/texture and subtracts a bit of lead clutter
4. `brightness`: high when day + clear; low at night; lower still if `weather.code` is rain/thunder/fog. Hour palettes:
   - 5–8 dawn, 8–17 day, 17–21 dusk, else night
5. `crunch` from accel RMS and from energy above 0.7 (highway push)
6. `rain` from `precipMmHr` and weather codes 51–67, 80–82, 95–99
7. `tunnel`: if lux drops > 70% in < 1.5 s, spike tunnel to 1 and decay over 8 s (also triggerable in Simulator)
8. Never hard-cut layers. All gains have 80–400 ms ramps.

## Audio engine

Use Tone.js.

Layers (all synthesized, no external sample packs required):

1. **Pulse / kick-snare kit** — gated, dry, rock. Follows bpm. Density brings in hats; rain adds filtered noise hats.
2. **Bass** — square/sine hybrid, root motion in a minor pentatonic or Dorian that matches palette.
3. **Crunch guitar** — heavily filtered saw stack + distortion. Gain from `crunch`. Mute at energy < 0.25.
4. **Pad / strings** — cinematic, louder at night and in rain.
5. **Lead hook** — short pentatonic ostinato, catchy, not shred. Enters above energy 0.45.
6. **Weather bed** — subtle filtered noise for rain, almost silent when dry. Not a rain app.

Musical constraints:

- Stick to one key per session, chosen from palette (night = D minor, day = E minor, dawn = A minor, dusk = F# minor). Optional "hold key" so it does not jump.
- Chord pad: i–VI–III–VII or i–VII–VI–VII, 4 bars, locked to bpm.
- Sidechain-ish duck of pad on kick (subtle).
- Master limiter. No clipping.
- Start() must be called from a user gesture.

If you want one-shot noise bursts or impulses, generate them in code.

## Simulator (required, first-class)

Desktop demo must be great without a car.

Scenarios (preset buttons):

- **Night rain highway** — 70 mph, heavy rain, dark, high energy
- **Sunny neighborhood** — 25 mph, clear, day, low crunch
- **Dawn commute** — 45–60 mph oscillating, light clouds
- **Tunnel blast** — 60 mph then lux collapse
- **Storm crawl** — 15 mph, thunder code, high rain

Also: sliders for speed, rain, lux, hour. A **timeline scrub** that plays a 90 s fake drive (speed/rain/light envelopes) so a recruiter can watch the mix move.

URL flag `?sim=1` starts in simulator. GitHub Pages should default to simulator if geolocation is denied.

## UI

Dark, cinematic, one screen.

- Wordmark: **RoadOST**
- One sentence: "Your drive writes the score."
- Big **Start score** / **Stop**
- Mode: Live sensors | Simulator
- HUD chips: SPEED, ENERGY, RAIN, LIGHT, WEATHER, BPM, PALETTE, each showing live/sim/missing
- Thin visualizer (spectrum or layer gain meters). Must work as a glance, not a game.
- Export: **Save this drive** → download `roadost-YYYYMMDD-HHMM.webm` (or wav if you can do it without a huge dependency). Use MediaRecorder on a captured MediaStreamDestination.
- Settings (hidden while driving): master volume, "hold key", "reduced motion"

Copy voice: short, confident, no corporate, no em dashes.

## Tests (must exist and pass)

`src/mapping/mapper.test.ts` at minimum:

- 0 m/s → bpm near 92, energy low
- 33 m/s → bpm near 164
- rain weather code → rain > 0.5
- night hour → palette night, brightness lower than noon clear
- tunnel lux drop → tunnel spikes then decays
- null sensors do not NaN MixState

## README (replace the license-only README)

Must include:

- What it is / what it is not
- Live demo link `https://aditano.github.io/RoadOST/`
- How to run locally
- Sensor permission notes (iOS motion, HTTPS required for geo)
- Architecture diagram in mermaid
- Taste / mapping table
- License MIT

## Acceptance

You are done when:

1. `npm test` passes
2. `npm run build` succeeds
3. `npm run dev` serves a working Simulator: Night rain highway sounds clearly different from Sunny neighborhood (different bpm, density, rain bed)
4. Start/Stop works, export downloads a file
5. README is honest and complete
6. CI workflow is valid YAML
7. No secrets, no `node_modules` committed, no em dashes in user-facing copy

Do the whole implementation. Do not stop at a stub. Do not add a song-generation API.
