// render.js — draws Archipelago Run: golden-hour chase view over the sea,
// islands, glowing target rings, the runway island, the aircraft, and a
// lit-instrument HUD (altitude, speed, heading, fuel, rings, timer).

const Render = (() => {
  const W = 1280;
  const H = 720;
  const CX = W / 2;
  const F = 760; // projection focal length

  /** Project a world point into screen space. Null when behind camera. */
  function project(S, wx, wy, wz) {
    const dx = wx - S.x;
    const dz = wz - S.z;
    const h = S.heading;
    const rx = dx * Math.cos(h) - dz * Math.sin(h);
    const rz = dx * Math.sin(h) + dz * Math.cos(h);
    if (rz < 40) return null;
    const horizonY = 300 - S.pitch * 170;
    const sx = CX + (rx * F) / rz;
    const sy = horizonY - ((wy - S.alt) * F) / rz;
    return { sx, sy, rz, scale: F / rz };
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky(ctx, S) {
    const g = ctx.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, '#2a4a7f');
    g.addColorStop(0.45, '#7fa8c9');
    g.addColorStop(0.75, '#f7c873');
    g.addColorStop(1, '#f2a35e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 430);
    // Sun, low and warm, with a halo.
    const sunX = 980;
    const sunY = 205;
    const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
    halo.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
    halo.addColorStop(0.35, 'rgba(255, 200, 110, 0.45)');
    halo.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds(ctx, S) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const c of World.clouds) {
      const p = project(S, c.x, c.y, c.z);
      if (!p || p.sy > 330) continue;
      const s = c.s * p.scale;
      if (s < 4) continue;
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(p.sx - s * 0.5, p.sy + s * 0.06, s * 0.55, s * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(p.sx + s * 0.5, p.sy + s * 0.05, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSea(ctx, S) {
    const horizonY = 300 - S.pitch * 170;
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, '#e8955a');
    g.addColorStop(0.18, '#3d7d8c');
    g.addColorStop(0.6, '#14586e');
    g.addColorStop(1, '#0a3a52');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, W, H - horizonY);
    // Sun glitter on the water.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffd98a';
    const t = S.time;
    for (let i = 0; i < 26; i++) {
      const y = horizonY + 24 + ((i * 53 + Math.floor(t * 12)) % 380);
      const wob = Math.sin(i * 2.7 + t * 0.8) * 26;
      const w = 30 + ((i * 37) % 90);
      ctx.globalAlpha = 0.12 + ((i * 13) % 10) / 60;
      ctx.fillRect(940 + wob - w / 2, y, w, 3);
    }
    ctx.restore();
  }

  function drawIslandShape(ctx, p, r, h, hue, palms, t) {
    const rx = r * p.scale;
    if (rx < 3) return;
    const ry = rx * 0.30;
    // Soft reflection in the water.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#06283a';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy + ry * 0.9, rx * 1.05, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Sand ring.
    ctx.fillStyle = '#e9d29b';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Green interior, slightly raised.
    ctx.fillStyle = `hsl(${hue}, 42%, 34%)`;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - ry * 0.22, rx * 0.78, ry * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue + 14}, 48%, 42%)`;
    ctx.beginPath();
    ctx.ellipse(p.sx - rx * 0.12, p.sy - ry * 0.34, rx * 0.42, ry * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Palm silhouettes.
    if (rx > 14) {
      ctx.strokeStyle = '#1d4023';
      ctx.fillStyle = '#2c6b34';
      ctx.lineWidth = Math.max(1, rx * 0.02);
      for (const palm of palms) {
        const px = p.sx + palm.dx * p.scale;
        const py = p.sy - ry * 0.2 + palm.dz * p.scale * 0.3;
        const s = palm.s * p.scale * 0.9;
        if (s < 1.5) continue;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + s * 0.12, py - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px + s * 0.12, py - s, s * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    void h;
    void t;
  }

  function drawIslands(ctx, S) {
    const all = World.islands.map((i) => ({ ...i, home: false }));
    all.push({ ...World.homeIsland, palms: [], hue: 100, home: true });
    const projected = [];
    for (const isl of all) {
      const p = project(S, isl.x, isl.h * 0.4, isl.z);
      if (!p) continue;
      projected.push({ isl, p });
    }
    projected.sort((a, b) => b.p.rz - a.p.rz);
    for (const { isl, p } of projected) {
      drawIslandShape(ctx, p, isl.r, isl.h, isl.hue, isl.palms || [], S.time);
    }
  }

  function drawRunway(ctx, S) {
    const rw = World.runway;
    const z0 = rw.z - rw.length / 2;
    const z1 = rw.z + rw.length / 2;
    const hw = rw.width / 2;
    const corners = [
      project(S, rw.x - hw, rw.height, z0),
      project(S, rw.x + hw, rw.height, z0),
      project(S, rw.x + hw, rw.height, z1),
      project(S, rw.x - hw, rw.height, z1),
    ];
    if (corners.some((c) => !c)) return;
    ctx.fillStyle = '#3c4148';
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
    ctx.closePath();
    ctx.fill();
    // Edge lines.
    ctx.strokeStyle = '#f5f0dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    ctx.lineTo(corners[3].sx, corners[3].sy);
    ctx.moveTo(corners[1].sx, corners[1].sy);
    ctx.lineTo(corners[2].sx, corners[2].sy);
    ctx.stroke();
    // Centre dashes.
    ctx.fillStyle = '#ffe9a8';
    for (let d = 0; d < rw.length; d += 120) {
      const a = project(S, rw.x, rw.height + 0.5, z0 + d);
      const b = project(S, rw.x, rw.height + 0.5, z0 + d + 55);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.sx - 3 * a.scale, a.sy);
      ctx.lineTo(a.sx + 3 * a.scale, a.sy);
      ctx.lineTo(b.sx + 3 * b.scale, b.sy);
      ctx.lineTo(b.sx - 3 * b.scale, b.sy);
      ctx.closePath();
      ctx.fill();
    }
    // Threshold bars at the near end.
    ctx.fillStyle = '#ffffff';
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      const a = project(S, rw.x + k * 11 - 4, rw.height + 0.5, z0 + 12);
      const b = project(S, rw.x + k * 11 + 4, rw.height + 0.5, z0 + 12);
      const c = project(S, rw.x + k * 11 + 4, rw.height + 0.5, z0 + 42);
      const d = project(S, rw.x + k * 11 - 4, rw.height + 0.5, z0 + 42);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
      ctx.fill();
    }
    // Edge lights, warm and glowing.
    ctx.save();
    ctx.shadowColor = '#ffb84d';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd27a';
    for (let d = 0; d <= rw.length; d += 95) {
      for (const side of [-1, 1]) {
        const p = project(S, rw.x + side * hw, rw.height + 1, z0 + d);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(1.5, 3.2 * p.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // Runway label floating over the strip.
    const lp = project(S, rw.x, rw.height + 60, rw.z);
    if (lp && lp.rz < 4200) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, 1.6 - lp.rz / 2600));
      ctx.font = `bold ${Math.max(11, Math.min(26, 26 * lp.scale))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3d6';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText('CORAL BAY  •  RWY 09', lp.sx, lp.sy);
      ctx.restore();
    }
  }

  function drawRings(ctx, S) {
    const list = [];
    for (let i = 0; i < World.rings.length; i++) {
      const ring = World.rings[i];
      const p = project(S, ring.x, ring.y, ring.z);
      if (!p) continue;
      list.push({ ring, p, i });
    }
    list.sort((a, b) => b.p.rz - a.p.rz);
    for (const { ring, p, i } of list) {
      const passed = i < S.nextRing;
      const isNext = i === S.nextRing;
      const rad = ring.r * p.scale;
      if (rad < 2) continue;
      const pulse = isNext ? 1 + Math.sin(S.time * 5) * 0.12 : 1;
      ctx.save();
      ctx.globalAlpha = passed ? 0.35 : 0.95;
      ctx.strokeStyle = passed ? '#7ee787' : isNext ? '#ffb84d' : '#ffd27a';
      ctx.lineWidth = Math.max(2, rad * 0.10 * pulse);
      ctx.shadowColor = passed ? '#7ee787' : '#ff9d2e';
      ctx.shadowBlur = isNext ? 22 : 10;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, rad * pulse, rad * 0.62 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (isNext) {
        ctx.save();
        ctx.font = `bold ${Math.max(11, Math.min(20, 20 * p.scale))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff3d6';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 5;
        ctx.fillText(`RING ${i + 1}`, p.sx, p.sy - rad * 0.62 - 10);
        ctx.restore();
      }
    }
  }

  function drawPlane(ctx, S) {
    const px = CX;
    const py = 478 + Math.sin(S.time * 2.1) * 2;
    const blink = Math.sin(S.time * 6) > 0;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(S.bank * 0.85);
    // Soft shadow blob below (on the sea haze).
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#06283a';
    ctx.beginPath();
    ctx.ellipse(0, 118, 150, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Main wing.
    ctx.fillStyle = '#e8590c';
    ctx.strokeStyle = '#7a2e05';
    ctx.lineWidth = 3;
    rr(ctx, -168, -16, 336, 30, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff3d6';
    rr(ctx, -168, -16, 336, 9, 8);
    ctx.fill();
    // Fuselage: tail (near, wide) to nose (far, narrow).
    const body = ctx.createLinearGradient(-24, 0, 24, 0);
    body.addColorStop(0, '#c9d4dc');
    body.addColorStop(0.5, '#f8f4ea');
    body.addColorStop(1, '#c9d4dc');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#5b6670';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-20, 62);
    ctx.quadraticCurveTo(-26, -30, -13, -108);
    ctx.quadraticCurveTo(0, -122, 13, -108);
    ctx.quadraticCurveTo(26, -30, 20, 62);
    ctx.quadraticCurveTo(0, 72, -20, 62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Orange cheatline.
    ctx.fillStyle = '#e8590c';
    ctx.beginPath();
    ctx.moveTo(-22, 30);
    ctx.quadraticCurveTo(-24, -20, -15, -80);
    ctx.lineTo(-9, -80);
    ctx.quadraticCurveTo(-16, -20, -14, 30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 30);
    ctx.quadraticCurveTo(24, -20, 15, -80);
    ctx.lineTo(9, -80);
    ctx.quadraticCurveTo(16, -20, 14, 30);
    ctx.closePath();
    ctx.fill();
    // Canopy.
    ctx.fillStyle = '#123f52';
    ctx.beginPath();
    ctx.ellipse(0, -58, 13, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 230, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-4, -66, 5, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Tailplane + fin.
    ctx.fillStyle = '#e8590c';
    ctx.strokeStyle = '#7a2e05';
    ctx.lineWidth = 2.5;
    rr(ctx, -72, 46, 144, 16, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8590c';
    ctx.beginPath();
    ctx.moveTo(-12, 58);
    ctx.lineTo(0, 96);
    ctx.lineTo(12, 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Propeller blur at the nose.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#dfe7ec';
    ctx.beginPath();
    ctx.ellipse(0, -112, 26, 8, Math.sin(S.time * 40) * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(40, 50, 60, 0.8)';
    ctx.lineWidth = 3;
    const a = S.time * 38;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(a) * 24, -112 - Math.sin(a) * 7);
    ctx.lineTo(Math.cos(a) * 24, -112 + Math.sin(a) * 7);
    ctx.stroke();
    // Nav lights.
    if (blink) {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff4d4d';
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(-168, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#39d353';
      ctx.fillStyle = '#7ee787';
      ctx.beginPath();
      ctx.arc(168, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------- instruments

  function drawDial(ctx, x, y, r, label, valueText, frac, accent) {
    ctx.save();
    // Lit face.
    const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    face.addColorStop(0, '#2b3a2e');
    face.addColorStop(1, '#0d1a12');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Ticks.
    ctx.strokeStyle = 'rgba(230, 255, 230, 0.75)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const x1 = x + Math.cos(a) * r * 0.82;
      const y1 = y + Math.sin(a) * r * 0.82;
      const x2 = x + Math.cos(a) * r * 0.94;
      const y2 = y + Math.sin(a) * r * 0.94;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // Needle.
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
    // Labels.
    ctx.fillStyle = '#cfe8c9';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(valueText, x, y - r * 0.42);
    ctx.restore();
  }

  function drawArtificialHorizon(ctx, x, y, r, pitch, bank) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-bank * 0.9);
    const py = pitch * r * 1.1;
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
    // Fixed wings marker.
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x - r * 0.55, y - 2, r * 0.32, 4);
    ctx.fillRect(x + r * 0.23, y - 2, r * 0.32, 4);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCompassTape(ctx, S) {
    const tapeW = 420;
    const x0 = CX - tapeW / 2;
    const y = 30;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
    rr(ctx, x0 - 8, 8, tapeW + 16, 40, 8);
    ctx.fill();
    const hdg = ((S.heading * 180) / Math.PI % 360 + 360) % 360;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillStyle = '#cfe8c9';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(hdg + d);
      const norm = ((deg % 360) + 360) % 360;
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
    // Centre caret + heading readout.
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

  function drawHUD(ctx, S) {
    // Top bar.
    ctx.save();
    ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
    ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALT', 18, 20);
    ctx.fillText('SPD', 18, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${Math.round(S.alt * 10)} FT`, 62, 22);
    ctx.fillText(`${Math.round(S.speed)} KT`, 62, 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('SCORE', W - 180, 20);
    ctx.fillText('TIME', W - 180, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(String(S.score), W - 18, 22);
    const t = Math.max(0, Math.ceil(S.timeLeft));
    ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, W - 18, 44);
    ctx.restore();

    drawCompassTape(ctx, S);

    // Rings + fuel strip under the top bar.
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = S.nextRing >= World.rings.length ? '#7ee787' : '#fff3d6';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`◉ RINGS  ${S.nextRing}/${World.rings.length}`, 18, 82);
    // Fuel bar.
    const fw = 190;
    ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
    rr(ctx, 18, 92, fw, 14, 7);
    ctx.fill();
    const fuelFrac = Math.max(0, S.fuel / 100);
    ctx.fillStyle = fuelFrac < 0.25 ? '#ff6b6b' : fuelFrac < 0.5 ? '#ffb84d' : '#7ee787';
    if (fuelFrac > 0) {
      rr(ctx, 20, 94, (fw - 4) * fuelFrac, 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3d6';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('FUEL', 216, 104);
    ctx.restore();

    // Next-ring direction arrow.
    if (S.state === 'flying' && S.nextRing < World.rings.length) {
      const ring = World.rings[S.nextRing];
      const p = project(S, ring.x, ring.y, ring.z);
      if (p && (p.sx < 60 || p.sx > W - 60)) {
        ctx.save();
        ctx.fillStyle = '#ffb84d';
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.sx < 60 ? '◀ RING' : 'RING ▶', p.sx < 60 ? 70 : W - 70, 150);
        ctx.restore();
      }
    }

    // Lit instruments, bottom corners.
    drawArtificialHorizon(ctx, 92, 618, 52, S.pitch, S.bank);
    drawDial(ctx, 196, 618, 52, 'ALTITUDE', `${Math.round(S.alt * 10)}`, S.alt / 420, '#7ee787');
    drawDial(ctx, W - 196, 618, 52, 'AIRSPEED', `${Math.round(S.speed)}`, S.speed / 230, '#ffd27a');
    drawDial(ctx, W - 92, 618, 52, 'THROTTLE', `${Math.round(S.throttle * 100)}%`, S.throttle, '#ff9d2e');

    // Centre message.
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

  function panel(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 20, 34, 0.78)';
    rr(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 122, 0.55)';
    ctx.lineWidth = 1.5;
    rr(ctx, x, y, w, h, 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawTitle(ctx, S) {
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
    panel(ctx, CX - 330, 580, 660, 140);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('W / S — throttle      ↑ / ↓ — climb & dive      ← / → — bank & turn', CX, 612);
    ctx.fillText('Mouse — steer toward the pointer      Wheel — throttle      Space — brake', CX, 638);
    ctx.fillText('Fly through all 8 rings, then land on Coral Bay runway before time runs out.', CX, 664);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(S.best > 0 ? `BEST SCORE  ${S.best}      •      PRESS ENTER OR CLICK TO FLY` : 'PRESS ENTER OR CLICK TO FLY', CX, 694);
    ctx.restore();
  }

  function drawEnd(ctx, S, title, lines, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 20, 34, 0.55)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, CX - 360, 150, 720, 240);
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

  function drawPaused(ctx) {
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
  }

  /** Main entry: draw the whole frame for state S. */
  function draw(ctx, S) {
    ctx.clearRect(0, 0, W, H);
    drawSky(ctx, S);
    ctx.save();
    ctx.translate(CX, 300 - S.pitch * 170);
    ctx.rotate(-S.bank * 0.10);
    ctx.translate(-CX, -(300 - S.pitch * 170));
    drawClouds(ctx, S);
    drawSea(ctx, S);
    drawIslands(ctx, S);
    drawRunway(ctx, S);
    drawRings(ctx, S);
    ctx.restore();
    // Speed streaks at high speed.
    if (S.state === 'flying' && S.speed > 150) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, (S.speed - 150) / 220);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y = 90 + ((i * 83 + Math.floor(S.time * 900)) % 540);
        const x = (i % 2 === 0) ? 26 : W - 26;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 46);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawPlane(ctx, S);
    drawHUD(ctx, S);
    if (S.state === 'title') drawTitle(ctx, S);
    else if (S.state === 'paused') drawPaused(ctx);
    else if (S.state === 'crashed') {
      drawEnd(ctx, S, 'DITCHED!', [
        S.crashReason,
        `Score ${S.score}  •  Rings ${S.nextRing}/${World.rings.length}  •  Best ${S.best}`,
      ], '#ff6b6b');
    } else if (S.state === 'fuelout') {
      drawEnd(ctx, S, 'OUT OF FUEL', [
        'You ran dry over open water. Rings refuel you — fly through them.',
        `Score ${S.score}  •  Rings ${S.nextRing}/${World.rings.length}  •  Best ${S.best}`,
      ], '#ffb84d');
    } else if (S.state === 'timeout') {
      drawEnd(ctx, S, 'TIME UP', [
        'The sun set on Coral Bay before you landed.',
        `Score ${S.score}  •  Rings ${S.nextRing}/${World.rings.length}  •  Best ${S.best}`,
      ], '#ffb84d');
    } else if (S.state === 'landed') {
      drawEnd(ctx, S, 'TOUCHDOWN!', [
        'You landed on Coral Bay runway. The archipelago is yours.',
        `Score ${S.score}  •  Rings ${S.nextRing}/${World.rings.length}  •  Best ${S.best}`,
      ], '#7ee787');
    }
  }

  return { draw, W, H };
})();
