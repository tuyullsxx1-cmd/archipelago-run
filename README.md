# Archipelago Run — Best Flight Game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tuyullsxx1-cmd/archipelago-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tuyullsxx1-cmd/archipelago-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete golden-hour flight game: fly a bush plane over a tropical
archipelago, thread all 8 glowing target rings, watch your fuel, and land
on the Coral Bay runway before the timer runs out.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network requests, no build step.

- **W / S** — throttle
- **↑ / ↓** — climb & dive
- **← / →** (or **A / D**) — bank & turn
- **Mouse** — steer toward the pointer · **Wheel** — throttle · **Space** — brake
- **Enter** — start · **P** — pause · **R** — fly again

Rings score points and refuel you (+14 fuel each). Land on the runway with
all 8 rings flown for the full +1000 touchdown bonus. Clip an island, ditch
in the sea, run dry, or let the timer hit zero and the sortie is over.

## What is in the frame

- Chase view over recognisable terrain: sea, sand-ringed islands with
  procedurally textured grass, sand and highland, layered-frond palms,
  and the Coral Bay runway island
- The aircraft in frame: a detailed bush plane with framed canopy, livery
  band, wing struts, wheel fairings, nav lights and a spinning prop,
  filmed from a slightly off-centre chase angle
- Lit instruments: altimeter, airspeed and throttle dials, artificial
  horizon, compass tape — plus altitude, speed and heading on the HUD
- A target ring (or the runway) ahead at all times

## Layout

- `game/index.html` — the page; `game/src/` — one job per file:
  `main.js` (flight model + states), `world.js` (seeded archipelago,
  rings, runway), `render.js` (chase view, plane, HUD, instruments),
  `input.js` (keyboard + mouse), `audio.js` (synthesised WebAudio sounds),
  `shots.js` (deterministic `?shot=N` poses for the screenshots)
- `screenshots/` — 4 real renders of the game's own code
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with `buildDossier`
- `vendor/makefun-game.ts` — the kit's library, unchanged

## License

MIT — see `LICENSE`.
