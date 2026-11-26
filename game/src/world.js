// world.js — the archipelago: seeded islands, target rings, the runway
// island and the terrain height query the flight model flies against.
// One fixed seed, so every run (and every screenshot) sees the same sea.

const World = (() => {
  /** Deterministic PRNG: mulberry32. */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(20261126);

  /** Islands scattered along the 10 km course. y is ground height. */
  const islands = [];
  const ISLAND_SPOTS = [
    // z,   x,    r,   h
    [500, -420, 210, 46], [780, 430, 260, 60], [1150, -120, 170, 38],
    [1500, 520, 300, 74], [1900, -560, 240, 52], [2250, 140, 190, 44],
    [2650, -300, 330, 82], [3050, 480, 210, 50], [3450, -640, 260, 58],
    [3850, 90, 180, 40], [4250, -260, 300, 70], [4650, 560, 240, 55],
    [5050, -480, 200, 48], [5450, 180, 340, 86], [5850, -140, 220, 52],
    [6250, 620, 280, 64], [6650, -560, 230, 50], [7050, 260, 300, 76],
    [7450, -320, 190, 42], [7850, 480, 260, 60], [8250, -180, 320, 80],
    [8650, 380, 220, 54],
  ];
  for (const [z, x, r, h] of ISLAND_SPOTS) {
    const palms = [];
    const n = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      palms.push({ dx: (rng() - 0.5) * r * 1.1, dz: (rng() - 0.5) * r * 0.7, s: 0.7 + rng() * 0.7 });
    }
    islands.push({ z, x, r, h, palms, hue: 96 + Math.floor(rng() * 22) });
  }

  /** The eight target rings of the course. */
  const rings = [
    { z: 900, x: -260, y: 190, r: 55 },
    { z: 1850, x: 220, y: 250, r: 55 },
    { z: 2800, x: -140, y: 160, r: 50 },
    { z: 3750, x: 300, y: 270, r: 55 },
    { z: 4700, x: -320, y: 210, r: 50 },
    { z: 5650, x: 120, y: 290, r: 55 },
    { z: 6600, x: -80, y: 180, r: 50 },
    { z: 7550, x: 40, y: 150, r: 55 },
  ];

  /** The runway island at the end of the course. */
  const runway = { z: 9300, x: 0, length: 760, width: 96, height: 26 };

  /** Home island the runway sits on: wide, flat-topped, unmistakable. */
  const homeIsland = { z: 9300, x: 0, r: 640, h: 26 };

  /** Slow clouds for the sky — plus a bank over the approach corridor
   *  and a few low ones on the horizon, so the final-approach sky is
   *  never one flat orange band. */
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    clouds.push({
      x: (rng() - 0.5) * 2600,
      y: 420 + rng() * 260,
      z: 300 + rng() * 9000,
      s: 60 + rng() * 130,
    });
  }
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: (rng() - 0.5) * 1100,
      y: 380 + rng() * 260,
      z: 8600 + rng() * 1300,
      s: 90 + rng() * 90,
    });
  }
  for (let i = 0; i < 3; i++) {
    clouds.push({
      x: (rng() - 0.5) * 1800,
      y: 220 + rng() * 90,
      z: 8800 + rng() * 900,
      s: 70 + rng() * 60,
    });
  }

  const COURSE_END = 9680;

  /** Ground height at (x, z). 0 is sea level. */
  function terrainHeightAt(x, z) {
    let h = 0;
    for (const isl of islands) {
      const dx = (x - isl.x) / isl.r;
      const dz = (z - isl.z) / (isl.r * 0.72);
      const d2 = dx * dx + dz * dz;
      if (d2 < 1) h = Math.max(h, isl.h * (1 - d2) * (1 - d2 * 0.4));
    }
    const hx = (x - homeIsland.x) / homeIsland.r;
    const hz = (z - homeIsland.z) / (homeIsland.r * 0.72);
    const hd2 = hx * hx + hz * hz;
    if (hd2 < 1) h = Math.max(h, homeIsland.h * (1 - hd2 * 0.35));
    return h;
  }

  /** Height of the runway surface (flat). */
  function runwayHeight() { return runway.height; }

  return {
    islands, rings, runway, homeIsland, clouds, COURSE_END,
    terrainHeightAt, runwayHeight,
  };
})();
