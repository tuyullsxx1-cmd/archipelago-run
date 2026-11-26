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
    ctx.fillText(String(S.score), W - 18, 22);
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
    ctx.fillStyle = 'rgba(6, 20, 34, 0.55)';
    ctx.fillRect(0, 0, W, H);
    glassPanel(CX - 360, 150, 720, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, CX, 230);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '20px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, CX, 280 + i * 32));
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('PRESS  R  TO FLY AGAIN', CX, 362);
    ctx.restore();
  }

  /** Draw the whole overlay for flight state S. */
  function draw(S) {
    ctx.clearRect(0, 0, W, H);
    topBar(S);
    ringsAndFuel(S);
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
        'Score ' + S.score + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#ff6b6b');
    } else if (S.state === 'fuelout') {
      endCard(S, 'OUT OF FUEL', [
        'You ran dry over open water. Rings refuel you — fly through them.',
        'Score ' + S.score + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#ffb84d');
    } else if (S.state === 'timeout') {
      endCard(S, 'TIME UP', [
        'The sun set on Coral Bay before you landed.',
        'Score ' + S.score + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#ffb84d');
    } else if (S.state === 'landed') {
      endCard(S, 'TOUCHDOWN!', [
        'You landed on Coral Bay runway. The archipelago is yours.',
        'Score ' + S.score + '  •  Rings ' + S.nextRing + '/' + World.rings.length + '  •  Best ' + S.best,
      ], '#7ee787');
    }
  }

  return { draw };
})();

// Classic scripts share the global lexical scope, but main.js reaches the
// overlay through window, so publish it there too.
window.Hud = Hud;
