// hud.js — the 2D overlay for Archipelago Run: lit instruments + HUD.
//
// The 3D world is WebGL (render3d.js); this canvas sits on top of it and
// draws everything that reads like a cockpit: the top bar (ALT / SPD /
// HDG / score / timer), the compass tape, the rings + fuel strip, the
// artificial horizon, the altitude / airspeed / throttle dials, centre
// messages, and the title / pause / end panels. All numbers come straight
// from the flight state S, so the instruments always agree with the 3D
// flight model.

const Hud = (() => {
  const cv = document.getElementById('hud');
  const ctx = cv.getContext('2d');
  const W = 1280;
  const H = 720;
  const CX = W / 2;

  function headingDeg(S) {
    return ((S.heading * 180 / Math.PI) % 360 + 360) % 360;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glassPanel(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 20, 34, 0.78)';
    roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 122, 0.55)';
    ctx.lineWidth = 1.5;
    roundRect(x, y, w, h, 14);
    ctx.stroke();
    ctx.restore();
  }

  // A lit round dial: glowing rim, tick ring, needle, digital readout.
  function gauge(x, y, r, label, readout, frac, rim) {
    ctx.save();
    const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    face.addColorStop(0, '#2b3a2e');
    face.addColorStop(1, '#0d1a12');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.shadowColor = rim;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(230, 255, 230, 0.75)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
      ctx.lineTo(x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94);
      ctx.stroke();
    }
    const na = Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(na) * r * 0.72, y + Math.sin(na) * r * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cfe8c9';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(readout, x, y - r * 0.42);
    ctx.restore();
  }

  // Artificial horizon: sky / ground split that rolls with the bank.
  function horizon(x, y, r, S) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-S.bank * 0.9);
    const py = S.pitch * r * 1.1;
    ctx.fillStyle = '#7fb6d9';
    ctx.fillRect(-r, -r + py - r, r * 2, r * 2);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-r, py, r * 2, r * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, py);
    ctx.lineTo(r, py);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x - r * 0.55, y - 2, r * 0.32, 4);
    ctx.fillRect(x + r * 0.23, y - 2, r * 0.32, 4);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function compassTape(S) {
    const tapeW = 420;
    const x0 = CX - tapeW / 2;
    const y = 30;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
    roundRect(x0 - 8, 8, tapeW + 16, 40, 8);
    ctx.fill();
    const hdg = headingDeg(S);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillStyle = '#cfe8c9';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 5) {
      const norm = ((Math.round(hdg + d) % 360) + 360) % 360;
      const sx = CX + (d / 60) * (tapeW / 2);
      const major = norm % 30 === 0;
      ctx.beginPath();
      ctx.moveTo(sx, y + 8);
      ctx.lineTo(sx, y + (major ? 20 : 14));
      ctx.stroke();
      if (major) {
        const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm);
        ctx.fillText(label, sx, y + 32);
      }
    }
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.moveTo(CX - 7, 8);
    ctx.lineTo(CX + 7, 8);
    ctx.lineTo(CX, 18);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(Math.round(hdg)).padStart(3, '0') + '°', CX, 46);
    ctx.restore();
  }

  function topBar(S) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
    ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALT', 18, 20);
    ctx.fillText('SPD', 18, 42);
    ctx.fillText('HDG', 430, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(Math.round(S.alt * 10) + ' FT', 62, 22);
    ctx.fillText(Math.round(S.speed) + ' KT', 62, 44);
    ctx.fillText(String(Math.round(headingDeg(S))).padStart(3, '0') + '°', 478, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('SCORE', W - 180, 20);
    ctx.fillText('TIME', W - 180, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    // v6: the score accumulates fractions in flight; the readout is whole.
    ctx.fillText(String(Math.round(S.score)), W - 18, 22);
    const t = Math.max(0, Math.ceil(S.timeLeft));
    ctx.fillText(Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), W - 18, 44);
    ctx.restore();
    compassTape(S);
  }

  function ringsAndFuel(S) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = S.nextRing >= World.rings.length ? '#7ee787' : '#fff3d6';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText('◉ RINGS  ' + S.nextRing + '/' + World.rings.length, 18, 82);
    const fw = 190;
    ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
    roundRect(18, 92, fw, 14, 7);
    ctx.fill();
    const f = Math.max(0, S.fuel / 100);
    ctx.fillStyle = f < 0.25 ? '#ff6b6b' : f < 0.5 ? '#ffb84d' : '#7ee787';
    if (f > 0) {
      roundRect(20, 94, (fw - 4) * f, 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3d6';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('FUEL', 216, 104);
    // v6 combo badge: the chain is the score engine, so it reads loud.
    if (S.combo >= 2) {
      ctx.save();
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffb84d';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText('COMBO ×' + S.combo + '  +' + ((S.combo - 1) * 50) + ' BONUS', 18, 132);
      ctx.restore();
    }
    ctx.restore();
  }

  // v6 next-ring beacon: project the next ring to the screen and point
  // at it, so the pilot always knows where to go next. Off-screen, the
  // arrow hugs the screen edge with the distance in metres.
  function drawRingBeacon(S) {
    if (S.state !== 'flying' || S.nextRing >= World.rings.length) return;
    if (!window.Render3D || !window.Render3D.project) return;
    const ring = World.rings[S.nextRing];
    const p = window.Render3D.project(ring.x, ring.y, ring.z);
    const distM = Math.max(0, Math.round((ring.z - S.z) * 10));
    ctx.save();
    ctx.textAlign = 'center';
    if (p.behind || p.x < 40 || p.x > W - 40 || p.y < 70 || p.y > H - 60) {
      // Off-screen: clamp to the edge and draw a pointing chevron.
      const cx = Math.max(50, Math.min(W - 50, p.x));
      const cy = Math.max(80, Math.min(H - 70, p.y));
      const ang = Math.atan2(p.y - cy, p.x - cx);
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ff8c1a';
      ctx.shadowColor = '#ff8c1a';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -13);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 13);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-ang);
      ctx.fillStyle = '#fff3d6';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText('RING ' + (S.nextRing + 1) + '  •  ' + distM + ' M', 0, 42);
    } else {
      // On-screen: a pulsing diamond over the ring + its distance.
      const pulse = 1 + Math.sin(S.time * 5) * 0.15;
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ff8c1a';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff8c1a';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 22);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#ff8c1a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.scale(1 / pulse, 1 / pulse);
      ctx.fillStyle = '#fff3d6';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText('RING ' + (S.nextRing + 1) + '  •  ' + distM + ' M', 0, -34);
    }
    ctx.restore();
  }

  // v6 score popup: the points just earned rise and fade above centre.
  function drawScorePopup(S) {
    if (!S.popup || S.popupT <= 0) return;
    const t = S.popupT / 1.2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    ctx.fillText(S.popup, CX, 230 - (1 - t) * 46);
    ctx.restore();
  }

  // v6 speed streaks: at high speed, faint streaks race in from the
  // screen edges so velocity reads even in a still frame.
  function drawSpeedStreaks(S) {
    if (S.state !== 'flying' || S.speed < 165) return;
    const k = Math.min(1, (S.speed - 165) / 60);
    ctx.save();
    ctx.globalAlpha = 0.28 * k;
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 2;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + S.time * 0.15;
      const r0 = 480 + ((i * 137) % 120);
      const r1 = r0 + 60 + k * 90;
      const x0 = CX + Math.cos(a) * r0;
      const y0 = 360 + Math.sin(a) * r0 * 0.62;
      const x1 = CX + Math.cos(a) * r1;
      const y1 = 360 + Math.sin(a) * r1 * 0.62;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function centreNotices(S) {
    if (S.msg && S.msgT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.msgT);
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3d6';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.fillText(S.msg, CX, 150);
      ctx.restore();
    }
    if (S.state === 'flying' && S.fuel < 25) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(S.time * 6) * 0.4;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('⚠ LOW FUEL — FLY A RING TO REFUEL', CX, 190);
      ctx.restore();
    }
  }

  function instruments(S) {
    horizon(92, 618, 52, S);
    gauge(196, 618, 52, 'ALTITUDE', String(Math.round(S.alt * 10)), S.alt / 420, '#7ee787');
    gauge(W - 196, 618, 52, 'AIRSPEED', String(Math.round(S.speed)), S.speed / 230, '#ffd27a');
    gauge(W - 92, 618, 52, 'THROTTLE', Math.round(S.throttle * 100) + '%', S.throttle, '#ff9d2e');
  }

  function titleCard(S) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 520, 0, H);
    g.addColorStop(0, 'rgba(6, 20, 34, 0)');
    g.addColorStop(1, 'rgba(6, 20, 34, 0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 520, W, H - 520);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3d6';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('ARCHIPELAGO RUN', CX, 210);
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('Fly the rings. Land the runway. Mind the fuel.', CX, 250);
    ctx.shadowBlur = 0;
    glassPanel(CX - 330, 580, 660, 140);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('W / S — throttle      ↑ / ↓ — climb & dive      ← / → — bank & turn', CX, 612);
    ctx.fillText('Mouse — steer toward the pointer      Wheel — throttle      Space — brake', CX, 638);
    ctx.fillText('Fly through all 8 rings, then land on Coral Bay runway before time runs out.', CX, 664);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(S.best > 0
      ? 'BEST SCORE  ' + S.best + '      •      PRESS ENTER OR CLICK TO FLY'
      : 'PRESS ENTER OR CLICK TO FLY', CX, 694);
    ctx.restore();
  }

  function endCard(S, title, lines, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 20, 34, 0.32)';
    ctx.fillRect(0, 0, W, H);
    glassPanel(CX - 280, 120, 560, 190);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title, CX, 188);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '18px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, CX, 232 + i * 30));
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('PRESS  R  TO FLY AGAIN', CX, 288);
    ctx.restore();
  }

  /** Draw the whole overlay for flight state S. */
  function draw(S) {
    ctx.clearRect(0, 0, W, H);
    drawSpeedStreaks(S);
    topBar(S);
    ringsAndFuel(S);
    drawRingBeacon(S);
    drawScorePopup(S);
    centreNotices(S);
    instruments(S);
    if (S.state === 'title') titleCard(S);
    else if (S.state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(6, 20, 34, 0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3d6';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.fillText('PAUSED', CX, 350);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText('Press P to keep flying', CX, 392);
      ctx.restore();
    } else if (S.state === 'crashed') {
      endCard(S, 'DITCHED!', [
        S.crashReason,
        'Score ' + Math.round(S.score) + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#ff6b6b');
    } else if (S.state === 'fuelout') {
      endCard(S, 'OUT OF FUEL', [
        'You ran dry over open water. Rings refuel you — fly through them.',
        'Score ' + Math.round(S.score) + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#ffb84d');
    } else if (S.state === 'timeout') {
      endCard(S, 'TIME UP', [
        'The sun set on Coral Bay before you landed.',
        'Score ' + Math.round(S.score) + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#ffb84d');
    } else if (S.state === 'landed') {
      endCard(S, 'TOUCHDOWN!', [
        'You landed on Coral Bay runway. The archipelago is yours.',
        'Score ' + Math.round(S.score) + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#7ee787');
    }
  }

  return { draw };
})();

// Classic scripts share the global lexical scope, but main.js reaches the
// overlay through window, so publish it there too.
window.Hud = Hud;
