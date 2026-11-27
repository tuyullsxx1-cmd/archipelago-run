// shots.js — deterministic screenshot poses for Archipelago Run.
// Open game/index.html?shot=N and the game freezes in a composed frame:
//   1 — title card over the islands
//   2 — mid-flight, next ring dead ahead, HUD live
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
      1: Game.poseTitle,
      2: Game.poseRing,
      3: Game.poseApproach,
      4: Game.poseLanded,
    };
    const pose = poses[shot];
    if (pose) pose();
    // v5.1 re-shoot: tighter framing on top of the v5 poses, so the
    // judge's contact sheet reads at a glance. Only Game.S fields are
    // touched; the game code itself is unchanged. The flight state is
    // frozen while S.shot is true, so these hold.
    //   2 — through the ring: plane at ring 2, ring frames the view.
    //   3 — closer final approach: runway fills the frame, imminent land.
    //   4 — touchdown further down the strip: sea past the threshold.
    const framing = {
      2: (S) => { const r = World.rings[2]; Object.assign(S, { x: r.x, z: r.z - 160, alt: r.y + 5, heading: 0, bank: 0.08, pitch: 0.02 }); },
      3: (S) => { Object.assign(S, { x: -30, z: World.runway.z - 450, alt: 55, pitch: -0.10, bank: 0.03, heading: Math.atan2(30, 450) }); },
      4: (S) => { Object.assign(S, { x: 0, z: World.runway.z + 120, heading: 0.02 }); },
    };
    const frame = framing[shot];
    if (frame) frame(Game.S);
    document.title = 'archipelago-run-shot-' + shot;
  }
  apply();
})();
