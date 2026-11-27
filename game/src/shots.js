// shots.js — deterministic screenshot poses for Archipelago Run.
// Open game/index.html?shot=N and the game freezes in a composed frame:
//   1 — v8 PEAK MOMENT (the cover): ring 8 bursts gold right ahead
//       with the airport behind it, combo ×5, score popup rising
//   2 — v6 instant hook: airborne at 195 kt, ring 1 dead ahead, the
//       objective banner on screen
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
      1: Game.poseCover,
      2: Game.poseAction,
      3: Game.poseApproach,
      4: Game.poseLanded,
    };
    const pose = poses[shot];
    if (pose) pose();
    // v8.1 re-shoot: clean framing on top of the v8 poses, so the
    // judge's contact sheet reads at a glance. Only Game.S fields are
    // touched; the game code itself is unchanged. The flight state is
    // frozen while S.shot is true, so these hold.
    //   1 — cover, decluttered: no burst, no score popup, no combo
    //       badge, no center banner. Same pose: airport + runway.
    //   2 — ring fly-through without the giant banner; the ring
    //       frames the islands, the plane stays clear of it.
    //   3 — closer final approach: runway + airport fill the frame.
    //   4 — untouched: the original touchdown frame is already clean.
    const framing = {
      1: (S) => { Object.assign(S, { shotBurst: null, msg: '', msgT: 0, popup: '', popupT: 0, combo: 0 }); },
      2: (S) => { const r = World.rings[0]; Object.assign(S, { msg: '', msgT: 0, x: r.x - 30, z: r.z - 240, alt: r.y + 15, heading: Math.atan2(30, 240) }); },
      3: (S) => { Object.assign(S, { x: -70, z: World.runway.z - 320, alt: 42, pitch: -0.05 }); },
    };
    const frame = framing[shot];
    if (frame) frame(Game.S);
    document.title = 'archipelago-run-shot-' + shot;
  }
  apply();
})();
