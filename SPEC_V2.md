# RoadOST v0.2 — website product pass

Codex: implement this entire spec in the existing repo. Do all of the work. Do not stop at a plan.

## Context

RoadOST is already a **browser app** on GitHub Pages (`https://aditano.github.io/RoadOST/`). People should never need to download a native app or visit an app store. v0.1 is a working stem mixer with a cramped single-screen UI.

v0.2 makes it feel like a real **website product**: landing page, deeper music engine, richer sensors/mapping, recap + share, mobile-first drive studio.

## Hard rules

1. Stay a static website. No backend, no accounts, no API keys, no app store, no Capacitor/React Native.
2. Keep the stack: Vite 6 + TypeScript strict + vanilla TS + Tone.js + Vitest.
3. Do **not** add Suno/MusicGen/live song generation.
4. Taste stays classic/hard rock + 80s cinema + Halo-like score. Catchy. No rap. No soft pop. No spa/lofi.
5. No em dashes in user-facing copy.
6. Keep `base: '/RoadOST/'` for GitHub Pages.
7. HTTPS + user gesture still required for audio and sensors.
8. Do not commit secrets or `node_modules`.
9. Do not push. Leave changes uncommitted or commit locally only if asked. Joy will push.

## Product shape (SPA)

Two views in the same site:

### 1. Landing `/` (default)

A real marketing/product page, not the raw mixer.

Must include:

- Wordmark **RoadOST**
- One-line: "Your drive writes the score."
- Short explanation: opens in the browser, no app to install, Bluetooth to the car
- What it is / what it is not (not a song generator)
- How it works: sensors → mapper → live stem mix
- Three feature cards (live mix, simulator, save/share)
- Big **Open the drive studio** button
- Secondary **Play a 90s demo** that jumps into studio with `night-rain-highway` + timeline playing
- Footer: MIT, GitHub link `https://github.com/aditano/RoadOST`, sensor honesty

Mobile-first. Dark cinematic. Glanceable.

### 2. Drive studio `/#studio` or `?view=studio`

The existing mixer, redesigned:

- Giant Start / Stop
- Mode: Live | Simulator
- HUD chips
- Visualizer (horizon / rain / speed, not a toy)
- Simulator presets + sliders + 90s timeline
- Settings collapsed by default
- After Stop: **Drive recap** panel

URL flags:

- `?sim=1` → studio + simulator
- `?preset=night-rain-highway` → load that preset
- `?view=studio` → skip landing
- `?demo=1` → studio + autoplay timeline after first Start (do not autoplay audio without a gesture)

## Music depth (the important part)

Keep Tone.js synthesized layers. Expand the arrangement so two drives do not sound like the same 8-bar loop.

Add an **arrangement engine** (`src/audio/arrange.ts`):

`Section = "intro" | "verse" | "lift" | "chorus" | "break"`

Rules (unit-test these):

1. Session starts in `intro` for 8 bars.
2. `energy < 0.28` → stay verse/break. `energy 0.28–0.55` → verse. `0.55–0.75` → lift. `> 0.75` → chorus.
3. Hold a section at least 4 bars unless tunnel spikes (then break for 2 bars).
4. Every 8 bars, if `|dEnergy| > 0.18` over the last 2 bars, fire a **fill** (toms + crash, 1 bar).
5. Rain > 0.45 brings extra hats + weather bed, mutes a bit of lead clutter.
6. Tunnel > 0.6 ducks brightness/lead and opens a filtered pad.

New or upgraded layers in `layers.ts`:

- Sub bass (chorus/highway only)
- Tom fill voice
- Riser into chorus (short filtered noise / saw, 1–2 bars)
- Distinct thunder tick for weather codes 95–99 (rare, not constant)
- Wind bed from Open-Meteo wind if present, else 0

Add palettes **storm** and **gold** (sunset heat) as optional overlays, but keep the four time palettes as the key center.

Master still limited. No clipping. All gains ramped.

## Sensors / mapping depth

Extend `FeatureFrame` + `MixState` additively (do not break existing mapper tests; update them if signatures change, keep old guarantees).

Add:

- `windMps` from Open-Meteo `current=wind_speed_10m` (convert to m/s)
- `visibility` optional if Open-Meteo provides it without a key
- `headingRate` (abs deg/s, from heading delta) → small fill bias / stereo motion
- `section` on MixState
- `fill` 0–1
- `wind` 0–1

Weather fetch should request wind. Fail soft if the field is missing.

More simulator presets (keep the original five, add these):

- midnight-city
- mountain-descent
- heatwave
- blizzard
- late-ferry

Each must produce a measurably different MixState (bpm / rain / brightness / section tendency). Add a test that compares at least 3 presets.

## Recap + share

When the user hits Stop (or Save):

Compute a recap:

- duration
- avg / peak speed
- peak energy
- dominant palette
- rain time fraction
- section timeline (list of sections with bar counts)

Show it in the studio. Persist last 10 recaps in `localStorage` key `roadost.recaps.v1`. Local only.

Share:

- Copy link button that encodes view + preset + sim (`URLSearchParams`, no giant blobs)
- Optional recap text block the user can copy

Export audio still works (`Save this drive`).

## Website polish

- Open Graph + Twitter meta tags (title, description, `/RoadOST/og.png` or svg fallback)
- Correct favicon path under Pages base
- `manifest.webmanifest` that says it is a website / browser app. **Do not** add an install-to-homescreen hard sell. If you add a manifest, keep `display: browser` or `minimal-ui`, not a fake native app.
- localStorage for volume, hold-key, reduced-motion, last view
- Keyboard: Space start/stop (when not in an input), `1`–`9` presets in simulator, `L`/`S` live/sim, `Esc` back to landing
- First-visit onboarding (3 short steps, dismissible, stored)
- Driving safety: hide settings + landing chrome while `speed > 4` and live; giant Stop only
- Mobile CSS: one column, 44px targets, no horizontal scroll, visualizer shorter on small screens
- Reduced motion: disable horizon streaks

## Tests (must pass)

Keep and extend:

- Existing mapper tests (bpm, rain, night brightness, tunnel, null sensors)
- New `src/audio/arrange.test.ts` for section rules
- New `src/share/url.test.ts` for query parse/serialize
- New preset differentiation test

`npm test` and `npm run build` must pass.

## README

Update the real README:

- Lead with "it is a website, open the demo, no app to install"
- Landing vs studio
- New mapping / arrangement table
- URL flags
- Local run
- Honest sensor notes

## Acceptance

Done only when:

1. Landing exists and is the default page
2. Studio is one click away and still mixes audio
3. Night rain highway vs sunny neighborhood vs blizzard are audibly/structurally different
4. Recap appears after Stop
5. Share URL restores preset + view
6. Tests + build pass
7. Mobile layout does not overflow 390px width
8. No song-generation API
9. User-facing copy has no em dashes
