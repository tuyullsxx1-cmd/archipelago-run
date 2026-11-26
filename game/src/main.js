// main.js — Archipelago Run: flight model, state machine and game loop.
// States: title → flying → (paused) → landed / crashed / fuelout / timeout.
// Fly through all 8 rings, then land on Coral Bay runway before the
// timer runs out. Rings refuel you; the sea and the islands do not forgive.

const Game = (() => {
  // The 3D world is WebGL (window.Render3D, a module) and the instruments
  // are a 2D overlay (window.Hud); both are drawn every frame below.
  const START = {
    x: 0, z: 0, alt: 230, speed: 0, throttle: 0.55,
    pitch: 0, bank: 0, heading: 0, fuel: 100, score: 0,
    rings: 0, timeLeft: 240, msg: '', msgT: 0,
  };

  const S = {
    state: 'title',
    time: 0,
    x: 0, z: 2600, alt: 260, speed: 130, throttle: 0.6,
    pitch: 0, bank: 0, heading: 0, fuel: 100, score: 0,
    nextRing: 0, timeLeft: 240, msg: '', msgT: 0,
    crashReason: '', best: 0, shot: false,
  };

  try {
    S.best = Number(localStorage.getItem('archipelago-run-best') || 0) || 0;
  } catch (_e) { S.best = 0; }

  function saveBest() {
    if (S.score > S.best) {
      S.best = S.score;
      try { localStorage.setItem('archipelago-run-best', String(S.best)); } catch (_e) { /* no storage */ }
    }
  }

  function reset() {
    Object.assign(S, START, { state: 'flying', nextRing: 0, crashReason: '' });
    S.speed = 90;
  }

  function start() {
    reset();
    AudioKit.ensure();
    AudioKit.setEngine(S.throttle, true);
  }

  function showMsg(text, seconds) {
    S.msg = text;
    S.msgT = seconds || 2.2;
  }

  function endFlight(state, reason) {
    S.state = state;
    if (reason) S.crashReason = reason;
    saveBest();
    AudioKit.setEngine(0, false);
    if (state === 'crashed' || state === 'fuelout') AudioKit.thud();
    if (state === 'landed') AudioKit.fanfare();
  }

  // ------------------------------------------------------------ poses

  /** Deterministic poses used by shots.js (?shot=N) for screenshots. */
  function poseTitle() {
    Object.assign(S, {
      state: 'title', shot: true, x: 0, z: 500, alt: 260, speed: 130,
      throttle: 0.6, pitch: 0.06, bank: 0.08, heading: 0, fuel: 100,
      score: 0, nextRing: 0, timeLeft: 240, msg: '', msgT: 0,
    });
  }
  function poseRing() {
    const ring = World.rings[2];
    Object.assign(S, {
      state: 'flying', shot: true, x: ring.x - 40, z: ring.z - 420,
      alt: ring.y + 40, speed: 175, throttle: 0.8, pitch: 0.02, bank: 0.06,
      heading: Math.atan2(40, 420), fuel: 82, score: 520, nextRing: 2,
      timeLeft: 187, msg: '', msgT: 0,
    });
  }
  function poseApproach() {
    Object.assign(S, {
      state: 'flying', shot: true, x: -30, z: World.runway.z - 900,
      alt: 80, speed: 120, throttle: 0.5, pitch: -0.08, bank: 0.03,
      heading: Math.atan2(30, 900), fuel: 46, score: 2140, nextRing: 8,
      timeLeft: 64, msg: 'FINAL — LAND ON CORAL BAY', msgT: 99,
    });
  }
  function poseLanded() {
    Object.assign(S, {
      state: 'landed', shot: true, x: 0, z: World.runway.z + 60,
      alt: World.runway.height, speed: 0, throttle: 0, pitch: 0,
      bank: 0, heading: 0, fuel: 38, score: 3240, nextRing: 8,
      timeLeft: 41, msg: '', msgT: 0,
    });
  }

  // ------------------------------------------------------------ update

  function steer(dt) {
    // Throttle: W/S keys, mouse wheel.
    if (Input.pressed('KeyW')) S.throttle = Math.min(1, S.throttle + dt * 0.6);
    if (Input.pressed('KeyS')) S.throttle = Math.max(0, S.throttle - dt * 0.6);
    const wheel = Input.takeWheel();
    if (wheel !== 0) S.throttle = Math.max(0, Math.min(1, S.throttle - wheel * 0.0004));

    // Bank: arrow/A-D keys; mouse steers when no key is held.
    let bankTarget = 0;
    if (Input.pressed('ArrowLeft') || Input.pressed('KeyA')) bankTarget = -0.9;
    else if (Input.pressed('ArrowRight') || Input.pressed('KeyD')) bankTarget = 0.9;
    else if (Input.mouse.inside) bankTarget = Math.max(-0.9, Math.min(0.9, (Input.mouse.x - 640) / 640 * 1.1));
    S.bank += (bankTarget - S.bank) * Math.min(1, dt * 4);

    // Pitch: arrows; mouse steers when no key is held.
    let pitchTarget = 0;
    if (Input.pressed('ArrowUp')) pitchTarget = 0.85;
    else if (Input.pressed('ArrowDown')) pitchTarget = -0.85;
    else if (Input.mouse.inside) pitchTarget = Math.max(-0.85, Math.min(0.85, (360 - Input.mouse.y) / 360 * 1.1));
    S.pitch += (pitchTarget - S.pitch) * Math.min(1, dt * 3.2);

    // Speed chases the throttle; Space is the brake.
    let targetSpeed = 40 + S.throttle * 185;
    if (Input.pressed('Space')) targetSpeed = Math.max(30, targetSpeed - 70);
    S.speed += (targetSpeed - S.speed) * Math.min(1, dt * 0.55);
  }

  function fly(dt) {
    steer(dt);
    S.heading += S.bank * (0.35 + S.speed / 480) * dt;
    const worldSpeed = S.speed * 0.9;
    const prevZ = S.z;
    S.z += Math.cos(S.heading) * worldSpeed * dt;
    S.x += Math.sin(S.heading) * worldSpeed * dt;
    S.alt += S.pitch * S.speed * 0.55 * dt;
    if (S.alt > 420) S.alt = 420;
    if (S.alt < 6) S.alt = 6;
    S.score += dt * S.speed * 0.05;
    S.fuel -= dt * (0.35 + S.throttle * 0.9);
    S.timeLeft -= dt;
    AudioKit.setEngine(S.throttle, true);

    // Rings.
    if (S.nextRing < World.rings.length) {
      const ring = World.rings[S.nextRing];
      if (prevZ < ring.z && S.z >= ring.z) {
        const dx = S.x - ring.x;
        const dy = S.alt - ring.y;
        if (Math.hypot(dx, dy) < ring.r) {
          S.score += 250 + Math.round(S.speed / 10);
          S.fuel = Math.min(100, S.fuel + 14);
          S.nextRing += 1;
          showMsg(`RING ${S.nextRing}/8  +${250 + Math.round(S.speed / 10)}`);
          AudioKit.chime();
        } else {
          S.nextRing += 1;
          showMsg(`MISSED RING ${S.nextRing}/8`);
          AudioKit.warn();
        }
      }
    }

    // Landing: on the strip, slow, all rings flown for the full bonus.
    const rw = World.runway;
    const onStrip =
      S.z >= rw.z - rw.length / 2 - 40 && S.z <= rw.z + rw.length / 2 &&
      Math.abs(S.x - rw.x) < rw.width / 2 + 14 &&
      S.alt <= rw.height + 14;
    if (onStrip && S.speed < 165) {
      S.alt = rw.height;
      S.score += S.nextRing >= World.rings.length ? 1000 : 200;
      endFlight('landed');
      return;
    }

    // Terrain / sea.
    const ground = World.terrainHeightAt(S.x, S.z);
    if (S.alt <= ground + 6) {
      endFlight('crashed', ground > 4
        ? 'You clipped an island ridge. The runway was so close.'
        : 'You ditched into the sea. Keep your altitude above the waves.');
      return;
    }
    if (S.fuel <= 0) {
      S.fuel = 0;
      endFlight('fuelout');
      return;
    }
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      endFlight('timeout');
      return;
    }
    if (S.z > World.COURSE_END) {
      endFlight('crashed', 'You flew past Coral Bay and out over empty ocean.');
    }
  }

  function update(dt) {
    S.time += dt;
    if (S.msgT > 0) S.msgT -= dt;
    if (S.shot) return; // screenshot pose: frozen frame, live animation only
    if (S.state === 'title') {
      // Gentle autopilot drift behind the title card.
      S.z += 95 * dt;
      if (S.z > 9000) S.z = 400;
      S.alt = 250 + Math.sin(S.time * 0.4) * 22;
      S.bank = Math.sin(S.time * 0.3) * 0.12;
      S.pitch = 0.05;
      S.speed = 130;
      return;
    }
    if (S.state === 'flying') fly(dt);
  }

  // ------------------------------------------------------------ loop

  let last = 0;
  let prevMouseDown = false;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    const mouseClicked = Input.mouse.down && !prevMouseDown;
    prevMouseDown = Input.mouse.down;

    if (S.state === 'title' && (Input.consume('Enter') || mouseClicked)) start();
    else if ((S.state === 'crashed' || S.state === 'fuelout' || S.state === 'timeout' || S.state === 'landed') && Input.consume('KeyR')) start();
    else if (S.state === 'flying' && Input.consume('KeyP')) S.state = 'paused';
    else if (S.state === 'paused' && (Input.consume('KeyP') || Input.consume('Enter'))) S.state = 'flying';

    update(dt);
    if (window.Render3D) window.Render3D.draw(S);
    if (window.Hud) window.Hud.draw(S);
    requestAnimationFrame(frame);
  }

  Input.attach();
  requestAnimationFrame(frame);

  return { S, start, poseTitle, poseRing, poseApproach, poseLanded };
})();
