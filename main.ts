// main.ts — hands Archipelago Run in to make.fun.
//
// Copies game/ and screenshots/ from this repository into the output
// directory, then writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts (copied unchanged from the kit).
//
// The game is real 3D WebGL: game/src/render3d.js builds the archipelago,
// the bush plane, the rings and the runway with three.js 0.160.0, vendored
// as game/vendor/three.module.min.js (MIT) and loaded from a local
// import map — the game makes zero network requests at runtime. The lit
// instruments and HUD are a 2D overlay in game/src/hud.js.
//
// v3 realism pass (user: "Flight game bikin 3d realistis" / "Perbaiki yg
// bikin lu engga pede"): the plane is a detailed bush aircraft instead of
// bare primitives, the terrain carries a procedural texture, palms grow
// layered fronds, clouds are voluminous and fill the approach sky, the
// runway reads brighter, and the chase camera sits a touch off-centre so
// the nose and prop read in frame. Gameplay, controls and HUD are
// unchanged from v2.
//
// v4 rebuild (user: "Rebuild tutupin sisa gap nya"): closes the four
// gaps the parent verified in the v3 screenshots — the plane wears a
// painted panel-line skin with registration, a pilot in the canopy and a
// prop blur disc; the terrain colours by slope with rock faces, dirt
// clearing by the strip and micro-relief; the sea carries scrolling wave
// normals, sun glint and foam rings at every shoreline; the clouds are
// soft dissolving billboards with cirrus streaks, under a hazier sky.
// Gameplay, controls and HUD are unchanged from v3.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
// Node 22, standard library only; deterministic: the same repository
// always writes the same bytes.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) return resolve(fromEnv);
  return '/output';
}

async function mustExist(path: string, what: string): Promise<void> {
  let info;
  try {
    info = await stat(path);
  } catch {
    throw new Error(`archipelago-run: ${what} missing at ${path}`);
  }
  if (!info.isDirectory()) throw new Error(`archipelago-run: ${what} at ${path} is not a directory`);
}

async function handIn(): Promise<void> {
  const out = outputDir();
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');

  await mustExist(gameDir, 'game/');
  await mustExist(shotsDir, 'screenshots/');

  // The 3D renderer needs its vendored engine: three.js 0.160.0, loaded
  // from a local import map. Fail loudly here rather than handing in a
  // game whose WebGL scene cannot start.
  await mustExist(join(gameDir, 'vendor'), 'game/vendor/ (vendored three.js)');

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  // The whole game, then the screenshots, copied as-is.
  await cp(gameDir, join(out, 'game'), { recursive: true });
  await cp(shotsDir, join(out, 'screenshots'), { recursive: true });

  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  await writeFile(join(out, 'dossier.json'), dossier);

  const dossierText = await readFile(join(out, 'dossier.json'), 'utf8');
  const shotCount = (await readdir(join(out, 'screenshots'))).length;
  console.log(`archipelago-run v4: wrote ${out} (dossier.json ${dossierText.length} chars, ${shotCount} screenshots)`);
}

await handIn();
