// main.ts — hands Archipelago Run in to make.fun.
//
// Copies game/ and screenshots/ from this repository into the output
// directory, then writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts (copied unchanged from the kit).
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
  console.log(`archipelago-run: wrote ${out} (dossier.json ${dossierText.length} chars, ${shotCount} screenshots)`);
}

await handIn();
