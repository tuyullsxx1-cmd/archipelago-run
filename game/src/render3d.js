// render3d.js — Archipelago Run in real 3D (WebGL via vendored three.js).
//
// Vendored engine: three.js 0.160.0 (three.module.min.js, MIT License,
// Copyright 2010-2023 Three.js Authors), loaded from game/vendor/ — no
// network at runtime. Everything below is this game's own scene code.
//
// Scene: a seeded tropical archipelago built from the same World the
// flight model flies against — heightmap terrain with sand beaches and
// green highlands, a sun-glitter sea, golden-hour sky dome + sun, drifting
// clouds, instanced palm trees, the Coral Bay runway with lit edges, eight
// glowing target rings, and a bush plane built from primitives, filmed by
// a smoothed chase camera. The 2D HUD/instruments live in hud.js.

import * as THREE from 'three';

const GLCanvas = document.getElementById('gl');

// ------------------------------------------------------------------ setup

const renderer = new THREE.WebGLRenderer({ canvas: GLCanvas, antialias: true });
renderer.setSize(1280, 720, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8a86a, 950, 6200);

const camera = new THREE.PerspectiveCamera(64, 1280 / 720, 0.5, 22000);
camera.position.set(0, 275, -60);

// Golden-hour sun, low behind and to the left of the course, so the
// chase camera sees the aircraft's tail lit.
const SUN_DIR = new THREE.Vector3(-0.50, 0.42, -0.76).normalize();

const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -380;
sun.shadow.camera.right = 380;
sun.shadow.camera.top = 380;
sun.shadow.camera.bottom = -380;
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 2600;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0x9fc3e0, 0x51604a, 1.2);
scene.add(hemi);

// ------------------------------------------------------------------ sky

function buildSky() {
  const geo = new THREE.SphereGeometry(9800, 32, 18);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a4a7f) },
      mid: { value: new THREE.Color(0x7fa8c9) },
      low: { value: new THREE.Color(0xf7c873) },
      bottom: { value: new THREE.Color(0xe8955a) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 bottom;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.28 ? mix(mid, top, smoothstep(0.28, 0.75, h))
          : h > 0.02 ? mix(low, mid, smoothstep(0.02, 0.28, h))
          : mix(bottom, low, smoothstep(-0.12, 0.02, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);

  // Sun disc + halo, parked far away on the horizon ahead-left of the
  // course (a sky element; the lighting sun stays behind the chase view
  // so the aircraft's tail reads lit).
  const DISC_DIR = new THREE.Vector3(-0.30, 0.09, 0.95).normalize();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(260, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
  );
  disc.position.copy(DISC_DIR).multiplyScalar(9200);
  disc.lookAt(0, 0, 0);
  scene.add(disc);
  // (No hard halo disc: its rim read as a flat tan circle against the
  // sky. The soft glow sprite below does that job.)

  // Soft sun glow so the horizon never reads as a flat orange band.
  const glowCv = document.createElement('canvas');
  glowCv.width = 256; glowCv.height = 256;
  const gg = glowCv.getContext('2d');
  const grad = gg.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,240,200,0.85)');
  grad.addColorStop(0.4, 'rgba(255,200,110,0.35)');
  grad.addColorStop(1, 'rgba(255,180,90,0)');
  gg.fillStyle = grad;
  gg.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCv);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true }));
  glow.position.copy(DISC_DIR).multiplyScalar(9150);
  glow.scale.set(6800, 6800, 1);
  scene.add(glow);
  // Hot core: a smaller, denser glow so the sun has a bright heart
  // inside the wide haze instead of one flat wash.
  const coreCv = document.createElement('canvas');
  coreCv.width = 128; coreCv.height = 128;
  const cg = coreCv.getContext('2d');
  const cgrad = cg.createRadialGradient(64, 64, 2, 64, 64, 64);
  cgrad.addColorStop(0, 'rgba(255,252,230,0.95)');
  cgrad.addColorStop(0.5, 'rgba(255,230,160,0.5)');
  cgrad.addColorStop(1, 'rgba(255,210,120,0)');
  cg.fillStyle = cgrad;
  cg.fillRect(0, 0, 128, 128);
  const coreTex = new THREE.CanvasTexture(coreCv);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, fog: false, depthWrite: false, transparent: true }));
  core.position.copy(DISC_DIR).multiplyScalar(9100);
  core.scale.set(2600, 2600, 1);
  scene.add(core);
}

// ------------------------------------------------------------------ sea

let seaMat = null;
let seaNormalTex = null;
let foamMat = null;
const foamRings = [];

/** Procedural wave normal map: a tiled sine-field encoded as RGB
 *  normals, so the sun glints off moving water instead of a flat sheet. */
function makeSeaNormalTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const img = g.createImageData(S, S);
  const hAt = (x, y) => {
    const u = x / S * Math.PI * 2, v = y / S * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.6 + Math.sin(u * 5 - v * 3) * 0.35
      + Math.sin((u + v) * 7) * 0.25;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (hAt((x + 1) % S, y) - hAt((x + S - 1) % S, y)) * 0.55;
      const dy = (hAt(x, (y + 1) % S) - hAt(x, (y + S - 1) % S)) * 0.55;
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 127;
      img.data[i + 1] = 128 + dy * 127;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(56, 56);
  return tex;
}

function buildSea() {
  const geo = new THREE.PlaneGeometry(24000, 24000, 1, 1);
  seaNormalTex = makeSeaNormalTexture();
  seaMat = new THREE.MeshPhongMaterial({
    color: 0x14586e,
    specular: 0xcfe6f2,
    shininess: 110,
    normalMap: seaNormalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
  });
  const sea = new THREE.Mesh(geo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.4, 5000);
  sea.receiveShadow = true;
  scene.add(sea);

  // Foam rings where the sea meets each island, so the shoreline reads
  // as surf instead of a hard green/blue edge.
  foamMat = new THREE.MeshBasicMaterial({
    color: 0xf2fbff, transparent: true, opacity: 0.20, side: THREE.DoubleSide,
  });
  const addFoam = (x, z, r) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.97, r * 1.03, 40), foamMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.75, z);
    scene.add(ring);
    foamRings.push({ mesh: ring, base: 1, phase: hashJitter(x, z) * Math.PI * 2 });
  };
  for (const isl of World.islands) addFoam(isl.x, isl.z, isl.r);
  addFoam(World.homeIsland.x, World.homeIsland.z, World.homeIsland.r);
}

// ---------------------------------------------------------------- terrain

/** Small deterministic jitter so neighbouring vertices don't shade flat. */
function hashJitter(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 2D value noise from the deterministic hash: no more flat blobs. */
function valueNoise(x, z, cell) {
  const xi = Math.floor(x / cell), zi = Math.floor(z / cell);
  const xf = x / cell - xi, zf = z / cell - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(zf);
  const h00 = hashJitter(xi, zi), h10 = hashJitter(xi + 1, zi);
  const h01 = hashJitter(xi, zi + 1), h11 = hashJitter(xi + 1, zi + 1);
  return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
}

function terrainColour(h, x, z, slope) {
  const sand = new THREE.Color(0xe9d29b);
  const wet = new THREE.Color(0xc7a06b);
  const grass = new THREE.Color(0x55873f);
  const grass2 = new THREE.Color(0x6d9a45);
  const deep = new THREE.Color(0x356636);
  const rock = new THREE.Color(0x6b6258);
  const dirt = new THREE.Color(0x9a7d4f);
  const c = new THREE.Color();
  // Large + medium patch noise so no island reads as one flat colour.
  const n1 = valueNoise(x, z, 260);
  const n2 = valueNoise(x + 900, z - 400, 90);
  const n3 = valueNoise(x - 500, z + 700, 34);
  if (h < 1.0) c.copy(wet); // wet sand at the waterline
  else if (h < 1.5) c.copy(sand);
  else if (h < 9) c.copy(sand).lerp(grass, (h - 1.5) / 7.5);
  else if (h < 46) c.copy(grass).lerp(grass2, n1).lerp(deep, (h - 9) / 37);
  else c.copy(deep).lerp(rock, Math.min(1, (h - 46) / 40));
  // Steep ground is bare rock, whatever its height: ridges and cliffs
  // read as rock faces instead of green slopes.
  if (slope > 0.55) c.lerp(rock, Math.min(1, (slope - 0.55) * 2.2));
  // Grass mottling: dry yellow-green patches break the flat green.
  c.lerp(new THREE.Color(0x8aa04e), Math.max(0, n3 - 0.62) * 1.6);
  // Dirt clearing around the Coral Bay strip.
  const rw = World.runway;
  if (Math.abs(x - rw.x) < 150 && Math.abs(z - rw.z) < 520 && h > 20 && h < 32) {
    c.lerp(dirt, 0.55);
  }
  const j = 0.90 + n2 * 0.20;
  c.multiplyScalar(j);
  return c;
}

/** Procedural grain for the terrain: coloured patches (grass, dirt,
 *  rock grit) plus fine speckle, drawn once from the seeded hash so
 *  every run matches. */
function makeTerrainTexture() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  // Soft large blotches, tinted: grass yellow, dirt tan, rock grey.
  const tints = ['rgba(120,140,40,0.10)', 'rgba(150,110,50,0.10)', 'rgba(110,105,95,0.10)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.05)'];
  for (let i = 0; i < 520; i++) {
    const x = hashJitter(i * 3.7, 11) * S, y = hashJitter(23, i * 5.1) * S;
    const r = 12 + hashJitter(i, i * 2.3) * 60;
    g.fillStyle = tints[Math.floor(hashJitter(i * 7.7, i * 1.9) * tints.length)];
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Fine speckle.
  for (let i = 0; i < 12000; i++) {
    const x = hashJitter(i * 1.31, 7.7) * S, y = hashJitter(3.3, i * 1.77) * S;
    const v = hashJitter(i * 9.1, i * 4.4);
    g.fillStyle = v < 0.33 ? 'rgba(0,0,0,0.10)' : v < 0.66 ? 'rgba(255,255,255,0.10)' : 'rgba(120,90,40,0.08)';
    g.fillRect(x, y, 1.6, 1.6);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = 4;
  return tex;
}

function buildTerrain() {
  const W = 3400, L = 11400, SX = 150, SZ = 220;
  const geo = new THREE.PlaneGeometry(W, L, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const rw = World.runway;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + 4900; // plane is centred; course runs z -800..10600
    const h = World.terrainHeightAt(x, z);
    // Slope from finite differences: steep ground reads as rock.
    const d = 14;
    const gx = (World.terrainHeightAt(x + d, z) - World.terrainHeightAt(x - d, z)) / (2 * d);
    const gz = (World.terrainHeightAt(x, z + d) - World.terrainHeightAt(x, z - d)) / (2 * d);
    const slope = Math.hypot(gx, gz);
    // Micro-relief so ridges are never perfectly smooth cones — kept
    // off the runway island's flat top and under a metre, so the flight
    // model's collision height still matches what the eye sees.
    let bump = 0;
    const nearRunway = Math.abs(x - rw.x) < 520 && Math.abs(z - rw.z) < 620;
    if (h > 8 && !nearRunway) bump = (valueNoise(x, z, 55) - 0.5) * 1.6;
    // Sink the open-sea floor well below the water plane: at kilometre
    // distances the depth buffer cannot separate two surfaces 0.4 apart,
    // and they shimmer through each other. The beach (h >= 0.5) is kept.
    pos.setY(i, h < 0.5 ? h - 2.5 : h + bump);
    pos.setZ(i, z);
    const c = terrainColour(h, x, z, slope);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: makeTerrainTexture() });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);
}

// ------------------------------------------------------------- vegetation

function buildPalms() {
  const spots = [];
  for (const isl of World.islands) {
    for (const p of isl.palms) {
      spots.push({ x: isl.x + p.dx, z: isl.z + p.dz, s: p.s });
    }
  }
  // Home island gets its own palm ring so Coral Bay reads as inhabited.
  const rng = (() => { let a = 987654321; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  for (let i = 0; i < 42; i++) {
    const a = rng() * Math.PI * 2;
    const r = 380 + rng() * 200;
    spots.push({ x: Math.cos(a) * r, z: World.homeIsland.z + Math.sin(a) * r * 0.72, s: 0.8 + rng() * 0.8 });
  }
  const n = spots.length;

  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.85, 9, 6);
  trunkGeo.translate(0, 4.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  trunks.castShadow = true;

  // Crown: layered fronds, not a lollipop blob — seven drooping fronds
  // per palm, each a flattened tapered cone, fanning from a small heart.
  const frondGeo = new THREE.ConeGeometry(1.05, 8.5, 4);
  frondGeo.scale(1, 1, 0.20);
  frondGeo.rotateX(Math.PI / 2); // point along +Z
  frondGeo.translate(0, 0, 4.2); // base at the crown top
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7a38 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, n * 7);
  fronds.castShadow = true;
  const heartGeo = new THREE.IcosahedronGeometry(1.9, 0);
  heartGeo.translate(0, 9.6, 0);
  const heartMat = new THREE.MeshLambertMaterial({ color: 0x245c2c });
  const hearts = new THREE.InstancedMesh(heartGeo, heartMat, n);
  hearts.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fe = new THREE.Euler();
  const fp = new THREE.Vector3();
  const fs = new THREE.Vector3();
  const frondGreen = new THREE.Color();
  spots.forEach((p, i) => {
    const y = Math.max(1, World.terrainHeightAt(p.x, p.z));
    e.set((hashJitter(p.x, p.z) - 0.5) * 0.16, hashJitter(p.z, p.x) * Math.PI * 2, (hashJitter(p.x + 7, p.z) - 0.5) * 0.16);
    q.setFromEuler(e);
    v.set(p.x, y - 0.4, p.z);
    sv.set(p.s, p.s, p.s);
    m.compose(v, q, sv);
    trunks.setMatrixAt(i, m);
    hearts.setMatrixAt(i, m);
    // Seven fronds fanning out from the crown top, each drooping down
    // at its own angle so no two palms share a silhouette.
    for (let j = 0; j < 7; j++) {
      const az = (j / 7) * Math.PI * 2 + hashJitter(p.x, p.z + j) * 0.6;
      const droop = 0.55 + hashJitter(p.x + j, p.z) * 0.5;
      fe.set(droop, az, 0, 'YXZ');
      fq.setFromEuler(fe);
      fp.set(p.x, y - 0.4 + 9.6 * p.s, p.z);
      fs.set(p.s, p.s, p.s);
      fm.compose(fp, fq, fs);
      fronds.setMatrixAt(i * 7 + j, fm);
      frondGreen.setHex(hashJitter(p.x + j * 3, p.z) < 0.5 ? 0x2f7a38 : 0x3f9148);
      fronds.setColorAt(i * 7 + j, frondGreen);
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  hearts.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;
  if (fronds.instanceColor) fronds.instanceColor.needsUpdate = true;
  scene.add(trunks);
  scene.add(hearts);
  scene.add(fronds);

  // A few grey boulders on the higher ridges.
  const rockGeo = new THREE.DodecahedronGeometry(3.2, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7a756c });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 46);
  rocks.castShadow = true;
  for (let i = 0; i < 46; i++) {
    const isl = World.islands[(i * 7) % World.islands.length];
    const a = hashJitter(i * 3.1, i * 7.7) * Math.PI * 2;
    const r = hashJitter(i * 5.3, i * 2.9) * isl.r * 0.45;
    const x = isl.x + Math.cos(a) * r;
    const z = isl.z + Math.sin(a) * r;
    const y = Math.max(1, World.terrainHeightAt(x, z));
    e.set(0, hashJitter(i, i * 3) * Math.PI, 0);
    q.setFromEuler(e);
    v.set(x, y + 0.6, z);
    const s = 0.6 + hashJitter(i * 9, i) * 1.3;
    sv.set(s, s * 0.7, s);
    m.compose(v, q, sv);
    rocks.setMatrixAt(i, m);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);
}

/** Low far islands on the horizon so the sea never ends in a flat line. */
function buildFarIslands() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x3d6b41 });
  const spots = [
    [-2600, 2600, 420, 90], [2900, 4200, 560, 120], [-3100, 6100, 480, 100],
    [2700, 7900, 620, 130], [-2400, 9500, 440, 95], [3200, 1500, 380, 80],
  ];
  for (const [x, z, r, h] of spots) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), mat);
    cone.position.set(x, h / 2 - 4, z);
    scene.add(cone);
  }
}

// ----------------------------------------------------------------- clouds

const cloudPuffs = [];

/** Soft cloud-puff texture: several overlapping radial gradients with
 *  feathered alpha, so a cloud's edge dissolves instead of ending in a
 *  hard sphere rim. */
function makeCloudPuffTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const blobs = [
    [128, 150, 92, 0.95], [82, 165, 62, 0.8], [176, 162, 66, 0.8],
    [110, 118, 58, 0.75], [152, 122, 52, 0.7], [60, 140, 40, 0.55], [200, 140, 44, 0.55],
  ];
  for (const [x, y, r, a] of blobs) {
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, `rgba(255,250,240,${a})`);
    grad.addColorStop(0.55, `rgba(255,246,232,${a * 0.55})`);
    grad.addColorStop(1, 'rgba(255,246,232,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let cloudTex = null;

function buildClouds() {
  cloudTex = makeCloudPuffTexture();
  const addCloudGroup = (cx, cy, cz, s) => {
    const group = new THREE.Group();
    // Four to six layered soft billboards per cloud: from any angle the
    // cloud reads as volume with a dissolving edge, not stacked balls.
    const puffs = 4 + Math.floor(hashJitter(cx, cz) * 3);
    for (let i = 0; i < puffs; i++) {
      const f = 0.7 + hashJitter(cx + i * 13, cz) * 0.7;
      const mat = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true,
        opacity: 0.5 + hashJitter(cz, cx + i) * 0.35,
        depthWrite: false,
      });
      const spr = new THREE.Sprite(mat);
      const w = s * 2.4 * f;
      spr.scale.set(w, w * 0.42, 1);
      spr.position.set(
        (hashJitter(i * 7, cx) - 0.5) * s * 1.5,
        (hashJitter(i * 3, cz) - 0.5) * s * 0.35,
        (hashJitter(cx, i * 11) - 0.5) * s * 0.9
      );
      group.add(spr);
    }
    group.position.set(cx, cy, cz);
    group.userData.baseX = cx;
    scene.add(group);
    cloudPuffs.push(group);
  };
  for (const c of World.clouds) addCloudGroup(c.x, c.y, c.z, c.s);

  // Approach-corridor clouds: the final-approach and landing frames look
  // straight down the course past Coral Bay, so the sky ahead of the
  // runway needs its own clouds or it reads as one flat orange wall.
  for (const [x, y, z, s] of [
    [-700, 520, 10100, 150], [500, 640, 10600, 180], [0, 760, 11200, 200],
    [-1200, 600, 10800, 130], [1100, 480, 9900, 120],
  ]) addCloudGroup(x, y, z, s);

  // High thin cirrus streaks near the horizon for depth.
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.32, depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(2200 + hashJitter(i, i * 5) * 1600, 130, 1);
    spr.position.set(
      (hashJitter(i * 17, 3) - 0.5) * 7000,
      720 + hashJitter(i * 23, 7) * 260,
      2400 + hashJitter(i * 29, 11) * 7000
    );
    scene.add(spr);
  }
  // Cirrus ahead of the runway, for the landing frame.
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.30, depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1800 + hashJitter(i * 31, 5) * 1200, 110, 1);
    spr.position.set(
      (hashJitter(i * 37, 9) - 0.5) * 3200,
      680 + hashJitter(i * 41, 13) * 220,
      10200 + hashJitter(i * 43, 17) * 1400
    );
    scene.add(spr);
  }
}

// ---------------------------------------------------------------- runway

function buildRunway() {
  const rw = World.runway;
  const group = new THREE.Group();

  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(rw.width, 2.5, rw.length),
    new THREE.MeshLambertMaterial({ color: 0x6b7078 })
  );
  asphalt.position.y = -1.2;
  asphalt.receiveShadow = true;
  group.add(asphalt);

  // Edge stripes.
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, rw.length), stripeMat);
    stripe.position.set(side * (rw.width / 2 - 2), 0.3, 0);
    group.add(stripe);
  }

  // Centre dashes.
  const dashGeo = new THREE.BoxGeometry(4, 0.4, 42);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 6);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) {
    m.makeTranslation(0, 0.3, -rw.length / 2 + 80 + i * 120);
    dashes.setMatrixAt(i, m);
  }
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // Threshold bars at the near end.
  const barGeo = new THREE.BoxGeometry(7, 0.4, 26);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bars = new THREE.InstancedMesh(barGeo, barMat, 6);
  for (let i = 0; i < 6; i++) {
    m.makeTranslation(-33 + i * 13.2, 0.3, -rw.length / 2 + 26);
    bars.setMatrixAt(i, m);
  }
  bars.instanceMatrix.needsUpdate = true;
  group.add(bars);

  // Warm edge lights, glowing — bigger and brighter so the strip reads
  // from the approach, not just on top of it.
  const lightGeo = new THREE.SphereGeometry(2.4, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0 });
  const perSide = Math.floor(rw.length / 95) + 1;
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, perSide * 2);
  let li = 0;
  for (let d = 0; d <= rw.length; d += 95) {
    for (const side of [-1, 1]) {
      m.makeTranslation(side * (rw.width / 2 + 1), 1.6, -rw.length / 2 + d);
      lights.setMatrixAt(li++, m);
    }
  }
  lights.count = li;
  lights.instanceMatrix.needsUpdate = true;
  group.add(lights);

  group.position.set(rw.x, rw.height, rw.z);
  scene.add(group);
}

// ---------------------------------------------------------------- airport (v7)

let towerBeacon = null;
let windsockPivot = null;

/** Canvas texture: warm lit terminal windows on dark glass, so the
 *  terminal's runway-facing front reads as occupied at golden hour. */
function makeTerminalGlassTexture() {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#22333f';
  g.fillRect(0, 0, W, H);
  // Muted sky reflection band across the top.
  const sky = g.createLinearGradient(0, 0, 0, 70);
  sky.addColorStop(0, 'rgba(255,190,110,0.35)');
  sky.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, 70);
  // Window grid: most lit warm, a few dark, so the front is alive.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 12; c++) {
      const lit = hashJitter(c * 7.3, r * 11.7) > 0.28;
      g.fillStyle = lit
        ? (hashJitter(c, r * 3.1) > 0.5 ? '#ffd98a' : '#ffb347')
        : '#16222b';
      g.fillRect(14 + c * 41, 84 + r * 42, 28, 28);
    }
  }
  // Mullion lines.
  g.strokeStyle = 'rgba(10,18,24,0.8)';
  g.lineWidth = 3;
  for (let c = 0; c <= 12; c++) {
    g.beginPath(); g.moveTo(c * 41 + 6, 76); g.lineTo(c * 41 + 6, 252); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture: the "CORAL BAY" sign on the terminal fascia. */
function makeAirportSignTexture() {
  const W = 512, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#f2e8d5';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1f3a5f';
  g.font = 'bold 62px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CORAL BAY', W / 2, H / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture: a runway number in white paint, transparent ground. */
function makeRunwayNumberTexture(text) {
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#ffffff';
  g.font = 'bold 88px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture: orange/white windsock stripes. */
function makeWindsockTexture() {
  const W = 128, H = 32;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 === 0 ? '#ff7a1a' : '#f8f4ea';
    g.fillRect(i * 32, 0, 32, H);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A small static parked plane: fuselage, wing, tail, gear — no spin. */
function buildParkedPlane(matWhite, matOrange, matDark) {
  const p = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.8, 10, 10), matWhite);
  body.rotation.z = Math.PI / 2;
  body.position.y = 2.2;
  p.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 10), matOrange);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(-6, 2.2, 0);
  p.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 17), matOrange);
  wing.position.set(0.5, 2.5, 0);
  p.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 7), matWhite);
  tail.position.set(4.6, 2.4, 0);
  p.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 2.4), matOrange);
  fin.position.set(4.6, 3.6, 0);
  p.add(fin);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6), matDark);
    strut.position.set(0.5, 0.9, side * 1.8);
    p.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.45, 10), matDark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.5, 0.65, side * 1.8);
    p.add(wheel);
  }
  p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return p;
}

/** Coral Bay airport: a real airport, not a bare strip — terminal with
 *  a lit glass front and a CORAL BAY sign, a control tower with a
 *  blinking beacon, two arched hangars, parked planes on the apron, a
 *  taxiway, a fuel truck, a windsock, runway numbers, PAPI lights and a
 *  perimeter road with cars. All real 3D geometry with height, built in
 *  the runway's own frame (origin = runway centre, y = strip height):
 *  x east, z along the strip. The strip itself, the landing zone and
 *  the touchdown detection are untouched. */
function buildAirport() {
  const group = new THREE.Group();
  const BY = -0.3; // apron top, just above the graded island top
  const concrete = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  const asphaltDark = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const creamDark = new THREE.MeshLambertMaterial({ color: 0xd9cdb4 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a3a4a, shininess: 200, specular: 0x9fd4ff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a3138 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf8f4ea });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe8590c });
  const steel = new THREE.MeshLambertMaterial({ color: 0xb9c0c7 });

  const addBox = (mat, w, h, d, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || group).add(m);
    return m;
  };

  // Apron + taxiway: concrete beside the strip, linked to it.
  addBox(concrete, 170, 1, 400, 140, BY - 0.5, 80);
  addBox(concrete, 26, 1, 40, 52, BY - 0.5, 110);
  // Taxiway centreline dashes.
  const taxiDash = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 6), taxiDash);
    d.position.set(52, BY + 0.2, 96 + i * 14);
    group.add(d);
  }
  // Apron stand markings: white boxes where the parked planes sit.
  const standMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  for (const z of [55, 200]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 14), standMat);
    s.position.set(95, BY + 0.2, z);
    group.add(s);
  }

  // Terminal: cream block, lit glass front facing the runway (west),
  // CORAL BAY sign on the fascia, overhang roof + second storey so the
  // silhouette reads against the sky from the approach.
  addBox(cream, 60, 20, 150, 150, BY + 10, 130);
  addBox(creamDark, 66, 2, 156, 150, BY + 21, 130);
  addBox(cream, 40, 8, 90, 155, BY + 25, 130);
  addBox(creamDark, 44, 1.5, 94, 155, BY + 29.5, 130);
  const glassTex = makeTerminalGlassTexture();
  const glassFront = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 11),
    new THREE.MeshBasicMaterial({ map: glassTex })
  );
  glassFront.position.set(119.4, BY + 9, 130);
  glassFront.rotation.y = -Math.PI / 2;
  group.add(glassFront);
  // Sign: thin box whose -x face carries the texture — a box's -x face
  // reads un-mirrored from the runway side.
  const signTex = makeAirportSignTexture();
  const signMats = [cream, new THREE.MeshBasicMaterial({ map: signTex }), cream, cream, cream, cream];
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 50), signMats);
  sign.position.set(119, BY + 21, 130);
  sign.castShadow = true;
  group.add(sign);

  // Control tower: shaft + glass cab + roof + antenna + blinking beacon.
  addBox(creamDark, 10, 38, 10, 105, BY + 19, -40);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 6, 8), glassMat);
  cab.position.set(105, BY + 41, -40);
  cab.castShadow = true;
  group.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 1.2, 8), dark);
  cabRoof.position.set(105, BY + 44.8, -40);
  cabRoof.castShadow = true;
  group.add(cabRoof);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 6), dark);
  antenna.position.set(105, BY + 48, -40);
  group.add(antenna);
  towerBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  towerBeacon.position.set(105, BY + 52, -40);
  group.add(towerBeacon);

  // Two hangars: barrel roofs over box walls, dark open doorways
  // facing the runway (west).
  function buildHangar(cx, cz) {
    addBox(creamDark, 50, 13, 70, cx, BY + 6.5, cz);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 70, 16), steel);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(cx, BY + 13, cz);
    roof.castShadow = true;
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 34), dark);
    door.position.set(cx - 25.2, BY + 5, cz);
    group.add(door);
  }
  buildHangar(160, -120);
  buildHangar(160, 265);

  // Parked planes on the apron stands, noses toward the runway.
  const parkedA = buildParkedPlane(white, orange, dark);
  parkedA.position.set(95, BY, 55);
  group.add(parkedA);
  const parkedB = buildParkedPlane(white, orange, dark);
  parkedB.position.set(95, BY, 200);
  parkedB.rotation.y = 0.35;
  group.add(parkedB);

  // Fuel truck + drums beside the terminal.
  const truck = new THREE.Group();
  const truckCab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.8, 3), white);
  truckCab.position.set(0, 1.9, 3.2);
  truckCab.castShadow = true;
  truck.add(truckCab);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 6.5, 12), steel);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 2.2, -1.5);
  tank.castShadow = true;
  truck.add(tank);
  for (const [wx, wz] of [[-1.4, 3.2], [1.4, 3.2], [-1.4, -3.2], [1.4, -3.2]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 10), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.7, wz);
    truck.add(w);
  }
  truck.position.set(82, BY, 150);
  group.add(truck);
  const drumCols = [0xe8590c, 0x2a6db0, 0x8a8f96];
  for (let i = 0; i < 3; i++) {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10),
      new THREE.MeshLambertMaterial({ color: drumCols[i] })
    );
    drum.position.set(122 + (i % 2) * 3, BY + 1.2, 232 + Math.floor(i / 2) * 3);
    drum.castShadow = true;
    group.add(drum);
  }

  // Windsock on the west side of the strip: striped cone on a pole,
  // swaying with the wind (animated in updateAirport).
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 12, 8), steel);
  pole.position.set(-70, BY + 6, -250);
  pole.castShadow = true;
  group.add(pole);
  windsockPivot = new THREE.Group();
  windsockPivot.position.set(-70, BY + 12.2, -250);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 7, 10),
    new THREE.MeshBasicMaterial({ map: makeWindsockTexture() })
  );
  sock.rotation.z = -Math.PI / 2;
  sock.position.x = 3.5;
  windsockPivot.add(sock);
  group.add(windsockPivot);

  // Threshold lights (green) at the near end + PAPI beside the strip.
  const thrMat = new THREE.MeshBasicMaterial({ color: 0x39d353 });
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), thrMat);
    l.position.set(-30 + i * 12, 0.8, -372);
    group.add(l);
  }
  const papiRed = new THREE.MeshBasicMaterial({ color: 0xff3333 });
  const papiWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), i < 2 ? papiRed : papiWhite);
    p.position.set(-62, 0.8, -300 + i * 10);
    group.add(p);
  }

  // Runway numbers, painted on the strip: "36" at the near end (the
  // course flies heading 000), "18" at the far end.
  for (const [text, z] of [['36', -300], ['18', 300]]) {
    const num = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 13),
      new THREE.MeshBasicMaterial({ map: makeRunwayNumberTexture(text), transparent: true })
    );
    num.rotation.x = -Math.PI / 2;
    num.rotation.z = Math.PI;
    num.position.set(0, 0.35, z);
    group.add(num);
  }

  // Perimeter road east of the apron + two low-poly cars.
  addBox(asphaltDark, 18, 0.6, 600, 249, BY - 0.6, 0);
  function buildCar(bodyCol, x, z, ry) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 2.2),
      new THREE.MeshLambertMaterial({ color: bodyCol }));
    body.position.y = 0.9;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 2.0), glassMat);
    cabin.position.set(-0.2, 1.85, 0);
    car.add(cabin);
    for (const [wx, wz] of [[-1.5, 1.1], [1.5, 1.1], [-1.5, -1.1], [1.5, -1.1]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8), dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.5, wz);
      car.add(w);
    }
    car.position.set(x, BY, z);
    car.rotation.y = ry;
    group.add(car);
  }
  buildCar(0xc0392b, 249, -100, 0.1);
  buildCar(0x2a6db0, 249, 120, -0.15);

  // Fence posts + rail along the apron's east edge.
  const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 3, 6);
  const posts = new THREE.InstancedMesh(postGeo, steel, 17);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 17; i++) {
    m.makeTranslation(226, BY + 1.5, -110 + i * 24);
    posts.setMatrixAt(i, m);
  }
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 390), steel);
  rail.position.set(226, BY + 3, 80);
  group.add(rail);

  group.position.set(World.runway.x, World.runway.height, World.runway.z);
  scene.add(group);
}

/** Animate the airport's live bits: the tower beacon blinks, the
 *  windsock swings with the wind. */
function updateAirport(S) {
  if (towerBeacon) towerBeacon.visible = Math.sin(S.time * 2.2) > 0;
  if (windsockPivot) {
    windsockPivot.rotation.y = 0.3 + Math.sin(S.time * 0.5) * 0.5;
    windsockPivot.rotation.z = -0.12 + Math.sin(S.time * 0.8) * 0.05;
  }
}

// ------------------------------------------------------------------ rings

const ringMeshes = [];

function buildRings() {
  World.rings.forEach((ring) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(ring.r, Math.max(2.5, ring.r * 0.085), 12, 42),
      // Unlit: a ring must read as a glowing band, not sun-bleached metal.
      new THREE.MeshBasicMaterial({ color: 0xffd27a })
    );
    mesh.position.set(ring.x, ring.y, ring.z);
    scene.add(mesh);
    ringMeshes.push(mesh);
  });
}

function updateRings(S) {
  ringMeshes.forEach((mesh, i) => {
    const passed = i < S.nextRing;
    const isNext = i === S.nextRing;
    const mat = mesh.material;
    if (passed) {
      mat.color.setHex(0x39d353);
      mat.transparent = true;
      mat.opacity = 0.55;
      mesh.scale.setScalar(1);
    } else if (isNext) {
      mat.color.setHex(0xff8c1a);
      mat.transparent = false;
      mat.opacity = 1;
      const pulse = 1 + Math.sin(S.time * 5) * 0.07;
      mesh.scale.setScalar(pulse);
    } else {
      mat.color.setHex(0xffd27a);
      mat.transparent = false;
      mat.opacity = 1;
      mesh.scale.setScalar(1);
    }
  });
}

// ------------------------------------------------------- v6 ring bursts

// A ring-pass burst: ~90 gold sparks that bloom out of the ring and
// fade in under a second, plus a flash sprite at the ring's heart.
// main.js arms it by setting S.shotBurst (or S.burstTick); draw()
// consumes the flag so a frozen screenshot pose holds the bloom.
const BURST_N = 90;
const burstGeo = new THREE.BufferGeometry();
const burstPos = new Float32Array(BURST_N * 3);
const burstVel = new Float32Array(BURST_N * 3);
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
// Soft round spark texture: bare points render as hard squares, which
// read as static, not sparks.
const sparkCv = document.createElement('canvas');
sparkCv.width = 64; sparkCv.height = 64;
{
  const sg = sparkCv.getContext('2d');
  const grad = sg.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,220,140,0.9)');
  grad.addColorStop(1, 'rgba(255,180,80,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 64, 64);
}
const sparkTex = new THREE.CanvasTexture(sparkCv);
const burstMat = new THREE.PointsMaterial({
  color: 0xffd27a, size: 9, transparent: true, opacity: 0, map: sparkTex,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
});
const burstPoints = new THREE.Points(burstGeo, burstMat);
burstPoints.frustumCulled = false;
scene.add(burstPoints);
let burstLife = 0;
let burstTick = -1;

// Flash sprite at the burst centre: a radial glow that pops and fades.
const flashCv = document.createElement('canvas');
flashCv.width = 128; flashCv.height = 128;
{
  const fg = flashCv.getContext('2d');
  const grad = fg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,190,0.95)');
  grad.addColorStop(0.4, 'rgba(255,190,90,0.55)');
  grad.addColorStop(1, 'rgba(255,160,60,0)');
  fg.fillStyle = grad;
  fg.fillRect(0, 0, 128, 128);
}
const flashTex = new THREE.CanvasTexture(flashCv);
const flash = new THREE.Sprite(new THREE.SpriteMaterial({
  map: flashTex, transparent: true, opacity: 0, depthWrite: false,
}));
flash.scale.set(1, 1, 1);
scene.add(flash);

/** Fire a burst at (x, y, z): sparks outward, flash at the centre. */
function spawnRingBurst(x, y, z) {
  for (let i = 0; i < BURST_N; i++) {
    burstPos[i * 3] = x;
    burstPos[i * 3 + 1] = y;
    burstPos[i * 3 + 2] = z;
    const a = Math.random() * Math.PI * 2;
    const b = (Math.random() - 0.5) * Math.PI;
    const sp = 60 + Math.random() * 160;
    burstVel[i * 3] = Math.cos(a) * Math.cos(b) * sp;
    burstVel[i * 3 + 1] = Math.sin(b) * sp;
    burstVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
  }
  burstGeo.attributes.position.needsUpdate = true;
  burstLife = 0.9;
  flash.position.set(x, y, z);
  flash.scale.set(60, 60, 1);
}

/** Advance the burst one frame; frozen when the shot pose holds it. */
function updateRingBurst(dt, frozen) {
  if (burstLife <= 0) {
    burstMat.opacity = 0;
    flash.material.opacity = 0;
    return;
  }
  if (!frozen) burstLife -= dt;
  const k = Math.max(0, burstLife / 0.9);
  for (let i = 0; i < BURST_N; i++) {
    burstPos[i * 3] += burstVel[i * 3] * dt;
    burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * dt;
    burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt;
    burstVel[i * 3 + 1] -= 30 * dt; // sparks arc down gently
  }
  burstGeo.attributes.position.needsUpdate = true;
  burstMat.opacity = k;
  flash.material.opacity = k * 0.9;
  const s = 60 + (1 - k) * 260;
  flash.scale.set(s, s, 1);
}

// ------------------------------------------------------- v6 projection

const _projV = new THREE.Vector3();

/** Project a world point to HUD pixels (1280×720). Used by the HUD's
 *  next-ring beacon. behind is true when the point is behind the camera. */
function projectWorldToScreen(x, y, z) {
  _projV.set(x, y, z).project(camera);
  return {
    x: (_projV.x * 0.5 + 0.5) * 1280,
    y: (-_projV.y * 0.5 + 0.5) * 720,
    behind: _projV.z > 1,
  };
}

// --------------------------------------------------------------- aircraft

/** Painted skin for the fuselage: panel seams, rivet rows, a cheatline
 *  and the registration, drawn on canvas so the white body reads as
 *  riveted metal instead of a blank tube. */
function makeFuselageSkin() {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#f8f4ea';
  g.fillRect(0, 0, W, H);
  // Panel seams along the body.
  g.strokeStyle = 'rgba(90,80,70,0.35)';
  g.lineWidth = 1.2;
  for (const x of [64, 128, 192, 256, 320, 384, 448]) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); g.stroke();
  // Rivet rows beside each seam.
  g.fillStyle = 'rgba(90,80,70,0.30)';
  for (const x of [64, 128, 192, 256, 320, 384, 448]) {
    for (let y = 8; y < H; y += 14) {
      g.fillRect(x + 3, y, 1.6, 1.6);
      g.fillRect(x - 5, y, 1.6, 1.6);
    }
  }
  // Orange cheatline along the side.
  g.fillStyle = '#e8590c';
  g.fillRect(0, H * 0.60, W, 10);
  g.fillStyle = '#c2410c';
  g.fillRect(0, H * 0.60 + 10, W, 3);
  // Registration on the rear fuselage.
  g.fillStyle = '#2a3138';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'left';
  g.fillText('N808AR', 300, H * 0.42);
  g.font = 'bold 20px sans-serif';
  g.fillStyle = 'rgba(42,49,56,0.75)';
  g.fillText('ARCHIPELAGO AIR', 300, H * 0.52);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Wing skin: panel seams, flap/aileron split lines and walkway marks. */
function makeWingSkin() {
  const W = 512, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8590c';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(60,20,0,0.4)';
  g.lineWidth = 1.5;
  // Flap / aileron split line along the trailing edge.
  g.beginPath(); g.moveTo(0, H * 0.68); g.lineTo(W, H * 0.68); g.stroke();
  // Rib seams.
  for (let x = 32; x < W; x += 42) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  // Walkway strips at the wing roots.
  g.fillStyle = 'rgba(30,30,30,0.55)';
  g.fillRect(W * 0.42, 0, 26, H);
  g.fillRect(W * 0.55, 0, 26, H);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildPlane() {
  const plane = new THREE.Group();
  const fuselageSkin = makeFuselageSkin();
  const wingSkin = makeWingSkin();
  const white = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.45, metalness: 0.25, map: fuselageSkin });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8590c, roughness: 0.5, metalness: 0.2 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2, map: wingSkin });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x123f52, shininess: 220, specular: 0xbfe6ff });

  // Fuselage: tapered cylinder along Z, nose cone at the front (+Z).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.9, 9.5, 14), white);
  body.rotation.x = Math.PI / 2;
  body.position.z = -0.4;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.6, 14), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 5.6;
  plane.add(nose);

  // Main wing + tailplane + fin. The wing wears the painted skin:
  // rib seams, flap split line and root walkways.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 0.55, 4.6), wingMat);
  wing.position.set(0, 0.35, 0.6);
  plane.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 4.6), white);
  wingTipL.position.set(-12.6, 0.35, 0.6);
  plane.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 12.6;
  plane.add(wingTipR);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.4, 2.6), orange);
  tail.position.set(0, 0.4, -4.6);
  plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.6, 3.2), white);
  fin.position.set(0, 1.9, -4.4);
  plane.add(fin);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 12), glass);
  canopy.scale.set(1, 0.75, 1.9);
  canopy.position.set(0, 1.35, 1.4);
  plane.add(canopy);

  // Canopy frame: dark base ring + centre mullion, so the glass reads as
  // a framed cockpit instead of a blue blob.
  const frameRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.13, 8, 24), dark);
  frameRing.rotation.x = Math.PI / 2;
  frameRing.scale.set(1, 1.9, 1);
  frameRing.position.set(0, 1.05, 1.4);
  plane.add(frameRing);
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.3), dark);
  mullion.position.set(0, 2.28, 1.4);
  plane.add(mullion);
  // Cross mullions: the canopy reads as framed panes, not one bubble.
  for (const dz of [0.55, 2.25]) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), dark);
    cross.position.set(0, 1.85, dz);
    cross.rotation.x = -0.5;
    plane.add(cross);
  }

  // Pilot: helmet + headrest inside the glass, so the cockpit is
  // occupied instead of empty.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.35, metalness: 0.4 }));
  helmet.position.set(0, 1.55, 1.1);
  plane.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, 0.9), new THREE.MeshPhongMaterial({ color: 0x0e2a3a, shininess: 260, specular: 0xdff2ff }));
  visor.position.set(0, 1.58, 1.35);
  visor.rotation.x = 0.5;
  plane.add(visor);
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.35), dark);
  headrest.position.set(0, 1.35, 0.35);
  plane.add(headrest);

  // Antenna mast + wire to the fin.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.4, 6), dark);
  mast.position.set(0, 2.2, -1.6);
  mast.rotation.x = -0.25;
  plane.add(mast);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 4), dark);
  wire.position.set(0, 2.9, -3.0);
  wire.rotation.x = Math.PI / 2.35;
  plane.add(wire);

  // Livery band around the front fuselage + cheatline stripe.
  const livery = new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.48, 4.2, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }));
  livery.rotation.x = Math.PI / 2;
  livery.position.z = 1.9;
  plane.add(livery);

  // Engine cowling: wider ring at the nose (the spinner covers the front).
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.78, 1.7, 14, 1, true), orange);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = 4.4;
  plane.add(cowl);

  // Exhaust stacks on the nose flanks.
  for (const side of [-1, 1]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.3, 8), dark);
    stack.rotation.x = Math.PI / 2.6;
    stack.position.set(side * 1.55, -0.4, 4.4);
    plane.add(stack);
  }

  // Wing struts: fuselage belly to wing underside.
  function wingStrut(from, to, r) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), dark);
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
  }
  for (const side of [-1, 1]) {
    plane.add(wingStrut(new THREE.Vector3(side * 1.1, -1.0, 1.4), new THREE.Vector3(side * 4.6, 0.1, 0.9), 0.16));
    plane.add(wingStrut(new THREE.Vector3(side * 1.1, -1.0, -0.2), new THREE.Vector3(side * 4.6, 0.1, -0.6), 0.16));
  }

  // Pitot tube under the right wing + landing light on the left.
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), dark);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(6, 0.05, 2.4);
  plane.add(pitot);
  const landLight = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  landLight.position.set(-6, 0.35, 2.9);
  plane.add(landLight);

  // Tail tip cone + tailplane tip caps.
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 10), orange);
  tailTip.rotation.x = -Math.PI / 2;
  tailTip.position.z = -5.6;
  plane.add(tailTip);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 2.6), white);
    tip.position.set(side * 4.5, 0.4, -4.6);
    plane.add(tip);
  }

  // Registration plates on both sides of the fin + a red rudder stripe,
  // so the tail reads from the chase view too.
  const regCv = document.createElement('canvas');
  regCv.width = 256; regCv.height = 96;
  const rg = regCv.getContext('2d');
  rg.fillStyle = '#f8f4ea';
  rg.fillRect(0, 0, 256, 96);
  rg.fillStyle = '#c2410c';
  rg.font = 'bold 52px sans-serif';
  rg.textAlign = 'center';
  rg.fillText('N808AR', 128, 66);
  const regTex = new THREE.CanvasTexture(regCv);
  regTex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.1),
      new THREE.MeshBasicMaterial({ map: regTex })
    );
    plate.position.set(side * 0.26, 1.9, -4.4);
    plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    plane.add(plate);
  }
  const rudderStripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.2), orange);
  rudderStripe.position.set(0, 3.4, -4.4);
  plane.add(rudderStripe);

  // Flap track fairings under the wing roots.
  for (const side of [-1, 1]) {
    const fair = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 8), orange);
    fair.rotation.x = -Math.PI / 2;
    fair.position.set(side * 3.4, 0.05, -1.6);
    plane.add(fair);
  }

  // Propeller: spinner + two blades, spun every frame.
  const prop = new THREE.Group();
  prop.position.z = 7.0;
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 12), dark);
  spinner.rotation.x = Math.PI / 2;
  prop.add(spinner);
  const bladeMat = dark.clone();
  bladeMat.transparent = true;
  const bladeGeo = new THREE.BoxGeometry(0.5, 6.4, 0.18);
  const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
  prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  plane.add(prop);
  plane.userData.prop = prop;
  plane.userData.bladeMat = bladeMat;

  // Prop blur disc: at cruise RPM the blades smear into a translucent
  // disc with a faint ring — a spinning prop, not a frozen cross.
  const discCv = document.createElement('canvas');
  discCv.width = 256; discCv.height = 256;
  const dg = discCv.getContext('2d');
  const dgrad = dg.createRadialGradient(128, 128, 20, 128, 128, 128);
  dgrad.addColorStop(0, 'rgba(40,45,50,0)');
  dgrad.addColorStop(0.55, 'rgba(40,45,50,0.10)');
  dgrad.addColorStop(0.85, 'rgba(40,45,50,0.28)');
  dgrad.addColorStop(0.97, 'rgba(40,45,50,0.42)');
  dgrad.addColorStop(1, 'rgba(40,45,50,0)');
  dg.fillStyle = dgrad;
  dg.fillRect(0, 0, 256, 256);
  const discTex = new THREE.CanvasTexture(discCv);
  const propDisc = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 32),
    new THREE.MeshBasicMaterial({ map: discTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  );
  propDisc.position.z = 7.05;
  plane.add(propDisc);
  plane.userData.propDisc = propDisc;

  // Nav lights: red left, green right, white tail.
  const navMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), navMat(0xff4d4d));
  navL.position.set(-13.1, 0.35, 0.6);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), navMat(0x39d353));
  navR.position.set(13.1, 0.35, 0.6);
  plane.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), navMat(0xffffff));
  navT.position.set(0, 0.4, -5.4);
  plane.add(navT);
  plane.userData.navL = navL;
  plane.userData.navR = navR;

  // Wingtip strobes: bright white flashes, alternating with the navs.
  const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const strobeL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), strobeMat);
  strobeL.position.set(-12.9, 0.7, 0.6);
  plane.add(strobeL);
  const strobeR = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), strobeMat.clone());
  strobeR.position.set(12.9, 0.7, 0.6);
  plane.add(strobeR);
  plane.userData.strobeL = strobeL;
  plane.userData.strobeR = strobeR;

  // Fixed gear: two struts + wheels with fairings.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 6), dark);
    strut.position.set(side * 2.2, -1.9, 1.2);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.6, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 2.2, -3.1, 1.2);
    plane.add(wheel);
    const fairing = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), orange);
    fairing.scale.set(0.55, 1.05, 1.35);
    fairing.position.set(side * 2.2, -3.0, 1.2);
    plane.add(fairing);
  }

  plane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(plane);
  return plane;
}

// ------------------------------------------------------------ camera + draw

const plane = buildPlane();
buildSky();
buildSea();
buildTerrain();
buildPalms();
buildFarIslands();
buildClouds();
buildRunway();
buildAirport();
buildRings();

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 275, -60);
const camLook = new THREE.Vector3(0, 250, 800);
const fwd = new THREE.Vector3();
const up = new THREE.Vector3();
let lastT = 0;

/** One frame of the 3D world for flight state S. */
function draw(S) {
  const now = S.time;
  const dt = Math.min(0.05, Math.max(0.001, now - lastT || 0.016));
  lastT = now;

  // Aircraft pose: yaw = heading, pitch up positive, bank into the turn.
  plane.position.set(S.x, S.alt, S.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = S.heading;
  plane.rotation.x = -S.pitch * 0.9;
  plane.rotation.z = -S.bank * 0.9;

  // Propeller spin + nav-light blink. At cruise RPM the blades fade
  // into the blur disc; at idle the disc vanishes and the blades read.
  plane.userData.prop.rotation.z += dt * (6 + S.throttle * 46 + S.speed * 0.12);
  const rpm = Math.min(1, (S.throttle * 0.7 + S.speed / 260) * 1.15);
  plane.userData.propDisc.material.opacity = rpm * 0.85;
  plane.userData.bladeMat.opacity = 1 - rpm * 0.75;
  const blink = Math.sin(S.time * 6) > 0;
  plane.userData.navL.visible = blink;
  plane.userData.navR.visible = blink;
  // Strobes flash on the opposite beat of the nav lights.
  plane.userData.strobeL.visible = !blink && Math.sin(S.time * 6 + 1.2) > 0.55;
  plane.userData.strobeR.visible = !blink && Math.sin(S.time * 6 + 1.2) > 0.55;

  updateRings(S);
  updateAirport(S);

  // v6 ring burst: main.js arms S.shotBurst on a pass (and the burst
  // pose carries one); draw() fires it once and holds the bloom while
  // the screenshot pose is frozen.
  if (S.shotBurst) {
    spawnRingBurst(S.shotBurst.x, S.shotBurst.y, S.shotBurst.z);
    S.shotBurst = null;
  }
  updateRingBurst(dt, !!S.shot);

  // Sea: scroll the wave normal map and breathe the foam rings.
  if (seaNormalTex) {
    seaNormalTex.offset.x = (S.time * 0.008) % 1;
    seaNormalTex.offset.y = (S.time * 0.005) % 1;
  }
  for (const f of foamRings) {
    const s = 1 + Math.sin(S.time * 0.9 + f.phase) * 0.02;
    f.mesh.scale.setScalar(s);
  }
  if (foamMat) foamMat.opacity = 0.18 + Math.sin(S.time * 0.9) * 0.05;

  // Clouds drift slowly downwind.
  for (const g of cloudPuffs) {
    g.position.x = g.userData.baseX + Math.sin(S.time * 0.02 + g.position.z * 0.001) * 60;
  }

  // Sun + shadow frustum follow the plane so shadows stay crisp.
  const sunPos = new THREE.Vector3(S.x, S.alt, S.z).addScaledVector(SUN_DIR, 700);
  sun.position.copy(sunPos);
  sun.target.position.set(S.x, S.alt, S.z);
  sun.target.updateMatrixWorld();

  // Chase camera: behind and above, smoothed, rolled with the bank.
  // Slightly off-centre — the camera sits a touch to starboard and looks
  // a touch to port, so the nose and spinning prop read in frame.
  // v6: closer in (the plane fills more of the frame) and a stronger
  // speed FOV kick, so velocity reads at a glance.
  fwd.set(Math.sin(S.heading), 0, Math.cos(S.heading));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  camTarget.copy(plane.position).addScaledVector(fwd, -30).addScaledVector(right, 7).add(new THREE.Vector3(0, 10.5, 0));
  if (S.shot || S.snapCam) {
    // Screenshot pose, or a fresh start: snap straight to the composed
    // frame instead of lerping in from the spawn point over several
    // seconds. The flag clears after one snap.
    camPos.copy(camTarget);
    S.snapCam = false;
  } else {
    const k = 1 - Math.exp(-dt * 4.5);
    camPos.lerp(camTarget, k);
  }
  camera.position.copy(camPos);
  // v6 camera kick: a subtle shake on ring passes, decaying fast.
  if (S.shake > 0 && !S.shot) {
    const sh = S.shake * S.shake * 2.2;
    camera.position.x += (Math.random() - 0.5) * sh;
    camera.position.y += (Math.random() - 0.5) * sh;
  }
  camLook.copy(plane.position).addScaledVector(fwd, 90).addScaledVector(right, -5).add(new THREE.Vector3(0, 1, 0));
  up.set(Math.sin(S.bank * 0.28), Math.cos(S.bank * 0.28), 0);
  camera.up.copy(up);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();
  const wantFov = 64 + Math.max(0, S.speed - 120) * 0.07;
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}

window.Render3D = { draw, project: projectWorldToScreen };
