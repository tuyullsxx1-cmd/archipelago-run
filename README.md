# Archipelago Run — Best Flight Game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tuyullsxx1-cmd/archipelago-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tuyullsxx1-cmd/archipelago-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete golden-hour flight game: fly a bush plane over a tropical
archipelago, thread all 8 glowing target rings, watch your fuel, and land
on the Coral Bay runway before the timer runs out.

## What's new in v7

Coral Bay is a real airport now: a terminal with a lit glass front and a CORAL BAY sign, a control tower with a blinking beacon, two arched hangars, parked planes on the apron, a taxiway, a fuel truck and drums, a windsock, runway numbers (36/18), PAPI lights and a perimeter road with cars. All real 3D geometry — the strip, the landing zone and the touchdown rule are unchanged, and so is the v6 feel (195 kt start, combo, burst, beacon).

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

## What's new in v6

Round 1 judged v5 at rank 2027/6,258 (~55.6% win rate), so v6 is a
game-feel pass aimed at the first seconds: the game starts airborne at
195 kt with ring 1 dead ahead and the objective on screen; every ring
pass pays off with a gold particle burst, a floating score popup, a
combo chain (+50 per chained ring) and a camera kick; near misses pay
+50 instead of nothing; the HUD points at the next ring with a beacon
(arrow + distance) and shows speed streaks at high speed; the chase
camera sits closer and the FOV kicks harder with speed. The v3/v4
realism and the working systems are unchanged.

## What is in the frame

- Chase view over recognisable terrain: a sun-glitter sea with foam-ringed
  shorelines, sand-ringed islands with slope-coloured rock faces, dirt
  clearings and procedurally textured grass, layered-frond palms, and the
  Coral Bay runway island
- The aircraft in frame: a detailed bush plane with painted panel-line
  skin and registration, a pilot under the framed canopy, livery band,
  wing struts, wheel fairings, nav lights, wingtip strobes and a prop
  blur disc at cruise RPM, filmed from a slightly off-centre chase angle
- Soft dissolving clouds with high cirrus streaks under a hazy
  golden-hour sky with a glowing sun
- Lit instruments: altimeter, airspeed and throttle dials, artificial
  horizon, compass tape — plus altitude, speed and heading on the HUD
- A target ring (or the runway) ahead at all times

## Layout

- `game/index.html` — the page; `game/src/` — one job per file:
  `main.js` (flight model + states + combo/score popups), `world.js`
  (seeded archipelago, rings, runway), `render3d.js` (chase view, plane,
  sea, terrain, clouds, ring bursts, screen projection), `hud.js` (lit
  instruments, ring beacon, speed streaks), `input.js` (keyboard +
  mouse), `audio.js` (synthesised WebAudio sounds, ring stinger),
  `shots.js` (deterministic `?shot=N` poses for the screenshots)
- `screenshots/` — 4 real renders of the game's own code
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with `buildDossier`
- `vendor/makefun-game.ts` — the kit's library, unchanged

## License

MIT — see `LICENSE`.
