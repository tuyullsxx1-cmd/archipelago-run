// shots.js — deterministic screenshot poses for Archipelago Run.
// Open game/index.html?shot=N and the game freezes in a composed frame:
//   1 — v6 instant hook: airborne at 195 kt, ring 1 dead ahead, the
//       objective banner on screen (the cover — action, not the menu)
//   2 — v6 payoff: ring 3 just burst, combo ×3, score popup rising,
//       gold sparks frozen mid-bloom
//   3 — final approach to Coral Bay runway
//   4 — touchdown on the runway, mission complete
// Used only to take the entry's screenshots; the game itself never reads it.

(function () {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (!shot) return;

  function apply() {
    if (typeof Game === 'undefined') {
      setTimeout(apply, 50);
      return;
    }
    const poses = {
      1: Game.poseAction,
      2: Game.poseBurst,
      3: Game.poseApproach,
      4: Game.poseLanded,
    };
    const pose = poses[shot];
    if (pose) pose();
    document.title = 'archipelago-run-shot-' + shot;
  }
  apply();
})();
