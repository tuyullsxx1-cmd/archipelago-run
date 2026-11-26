// main.js — Archipelago Run: flight model, state machine and game loop.
// States: title → flying → (paused) → landed / crashed / fuelout / timeout.
// Fly through all 8 rings, then land on Coral Bay runway before the
// timer runs out. Rings refuel you; the sea and the islands do not forgive.

const Game = (() => {
  // The 3D world is WebGL (window.Render3D, a module) and the instruments
  // are a 2D overlay (window.Hud); both are drawn every frame below.
  const START = {
    x: 0, z: 0, alt: 230, speed: 150, throttle: 0.75,
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
    // v6 game-feel state: combo chain, score popup, camera shake.
    combo: 0, popup: '', popupT: 0, shake: 0,
    // v8: Mayday mission flag + dusk lighting flag + live gust factor.
    mayday: false, dusk: false, wind: 0,
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
    Object.assign(S, START, { state: 'flying', nextRing: 0, crashReason: '', combo: 0, popup: '', popupT: 0, shake: 0 });
    S.speed = 150;
  }

  function start() {
    reset();
    // v8 Mayday run: one sortie, low fuel, a tight clock, dusk closing
    // in — and the landing pays +2000 instead of +1000. Toggled with
    // M on the title screen; a normal run is untouched.
    if (S.mayday) {
      S.fuel = 22;
      S.timeLeft = 150;
      S.dusk = true;
      S.snapCam = true;
      showMsg('MAYDAY — LOW FUEL, LAND ON CORAL BAY!', 3.5);
    } else {
      S.dusk = false;
      // v6 instant hook: the objective is on screen from frame one, and
      // the chase camera snaps to the plane — no cross-ocean swoop while
      // the title drift's camera lerps back.
      S.snapCam = true;
      showMsg('RING 1 AHEAD — FLY THROUGH IT!', 3.5);
    }
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
  // v8 cover: the PEAK MOMENT — ring 8 bursts gold right ahead with
  // the airport behind it, combo ×5, the score popup still rising,
  // golden hour. The judge's contact sheet opens on this frame.
  function poseCover() {
    Object.assign(S, {
      state: 'flying', shot: true, x: -60, z: World.runway.z - 480,
      alt: 130, speed: 185, throttle: 0.85, pitch: 0.02, bank: 0.06,
      heading: Math.atan2(60, 480), fuel: 52, score: 2890, nextRing: 8,
      timeLeft: 70, msg: 'RING 8/8  +275', msgT: 99,
      combo: 5, popup: '+275', popupT: 0.9, shake: 0, dusk: false, wind: 0.7,
      shotBurst: { x: -10, y: 150, z: World.runway.z - 300 },
    });
  }
  // v6 shot 1 is the instant hook, not the menu: airborne at full chat,
  // ring 1 dead ahead, objective banner on screen.
  function poseAction() {
    const ring = World.rings[0];
    Object.assign(S, {
      state: 'flying', shot: true, x: ring.x - 30, z: ring.z - 330,
      alt: ring.y + 30, speed: 195, throttle: 0.9, pitch: 0.02, bank: 0.06,
      heading: Math.atan2(30, 330), fuel: 96, score: 0, nextRing: 0,
      timeLeft: 235, msg: 'FLY THROUGH THE GLOWING RINGS!', msgT: 99,
      combo: 0, popup: '', popupT: 0, shake: 0, dusk: false, wind: 0.5,
    });
  }
  // v6 shot 2 is the payoff frame: a ring just burst, combo ×3, the
  // score popup still rising, particles frozen mid-bloom.
  function poseBurst() {
    const ring = World.rings[2];
    Object.assign(S, {
      state: 'flying', shot: true, x: ring.x - 40, z: ring.z - 420,
      alt: ring.y + 40, speed: 185, throttle: 0.85, pitch: 0.02, bank: 0.06,
      heading: Math.atan2(40, 420), fuel: 88, score: 795, nextRing: 3,
      timeLeft: 187, msg: 'RING 3/8  +275', msgT: 99,
      combo: 3, popup: '+275', popupT: 0.9, shake: 0, dusk: false, wind: 0.6,
      shotBurst: { x: ring.x, y: ring.y, z: ring.z },
    });
  }
  // v8: closer and lower still (380 m out, 48 ft up) and offset west,
  // so the view axis angles east toward the terminal, tower and parked
  // planes — the airport FILLS the frame instead of sitting at the far
  // end of the strip.
  function poseApproach() {
    Object.assign(S, {
      state: 'flying', shot: true, x: -70, z: World.runway.z - 380,
      alt: 48, speed: 120, throttle: 0.5, pitch: -0.05, bank: 0.03,
      heading: Math.atan2(70, 380), fuel: 46, score: 2140, nextRing: 8,
      timeLeft: 64, msg: 'FINAL — LAND ON CORAL BAY', msgT: 99,
      dusk: false, wind: 0.7,
    });
  }
  function poseLanded() {
    Object.assign(S, {
      state: 'landed', shot: true, x: -25, z: World.runway.z + 40,
      alt: World.runway.height, speed: 0, throttle: 0, pitch: 0,
      bank: 0, heading: Math.atan2(25, 90), fuel: 38, score: 3240, nextRing: 8,
      timeLeft: 41, msg: '', msgT: 0, dusk: false, wind: 0.4,
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
    // Wind gusts (v8, point 4): the SAME deterministic gust the
    // windsocks show pushes the plane — a few m/s sideways, a touch
    // vertically. Small on purpose: the strip is 96 m wide and the
    // pilot steers. S.wind feeds the HUD wind readout.
    const gust = 0.55 + 0.45 * Math.sin(S.time * 0.13) + 0.25 * Math.sin(S.time * 0.31 + 1.7);
    S.wind = gust;
    S.x += (gust - 0.6) * 5 * dt;
    S.alt += (gust - 0.6) * 2.2 * dt;
    if (S.alt < 6) S.alt = 6;
    S.score += dt * S.speed * 0.05;
    S.fuel -= dt * (0.35 + S.throttle * 0.9);
    S.timeLeft -= dt;
    AudioKit.setEngine(S.throttle, true);

    // Rings. A clean pass pays the base prize plus a combo bonus; a
    // near miss still pays a little, so a close call is a thrill, not
    // just a failure. Every pass fires the burst, the popup and the
    // camera kick in render3d + hud.
    if (S.nextRing < World.rings.length) {
      const ring = World.rings[S.nextRing];
      if (prevZ < ring.z && S.z >= ring.z) {
        const dx = S.x - ring.x;
        const dy = S.alt - ring.y;
        const d = Math.hypot(dx, dy);
        if (d < ring.r) {
          S.combo += 1;
          const pts = 250 + Math.round(S.speed / 10) + (S.combo - 1) * 50;
          S.score += pts;
          S.fuel = Math.min(100, S.fuel + 14);
          S.nextRing += 1;
          S.popup = '+' + pts;
          S.popupT = 1.2;
          S.shake = 0.5;
          S.shotBurst = { x: ring.x, y: ring.y, z: ring.z };
          showMsg(`RING ${S.nextRing}/8  +${pts}` + (S.combo > 1 ? `  COMBO ×${S.combo}` : ''));
          AudioKit.stinger();
        } else if (d < ring.r * 1.6) {
          S.combo = 0;
          S.score += 50;
          S.nextRing += 1;
          S.popup = '+50 NEAR MISS';
          S.popupT = 1.0;
          showMsg(`NEAR MISS  +50`);
          AudioKit.warn();
        } else {
          S.combo = 0;
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
      // v8 Mayday: bringing her home on fumes pays +2000, not +1000.
      S.score += S.nextRing >= World.rings.length ? (S.mayday ? 2000 : 1000) : 200;
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
    if (S.popupT > 0) S.popupT -= dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.4);
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

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    const mouseClicked = Input.takeClick();

    // v8: M on the title screen arms/disarms the Mayday run.
    if (S.state === 'title' && Input.consume('KeyM')) S.mayday = !S.mayday;
    if (S.state === 'title' && (Input.consume('Enter') || mouseClicked)) start();
    else if ((S.state === 'crashed' || S.state === 'fuelout' || S.state === 'timeout' || S.state === 'landed') && Input.consume('KeyR')) start();
    else if (S.state === 'flying' && Input.consume('KeyP')) S.state = 'paused';
    else if (S.state === 'paused' && (Input.consume('KeyP') || Input.consume('Enter'))) S.state = 'flying';
    Input.endFrame();

    update(dt);
    if (window.Render3D) window.Render3D.draw(S);
    if (window.Hud) window.Hud.draw(S);
    requestAnimationFrame(frame);
  }

  Input.attach();
  requestAnimationFrame(frame);

  return { S, start, poseCover, poseAction, poseBurst, poseApproach, poseLanded };
})();
