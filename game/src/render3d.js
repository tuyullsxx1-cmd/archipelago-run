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
scene.fog = new THREE.Fog(0xe9b878, 1300, 7200);

const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.5, 22000);
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
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(720, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffc86e, transparent: true, opacity: 0.28, fog: false,
    })
  );
  halo.position.copy(DISC_DIR).multiplyScalar(9180);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
}

// ------------------------------------------------------------------ sea

function buildSea() {
  const geo = new THREE.PlaneGeometry(24000, 24000, 1, 1);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x14586e,
    specular: 0x7a9ab0,
    shininess: 60,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.4, 5000);
  sea.receiveShadow = true;
  scene.add(sea);
}

// ---------------------------------------------------------------- terrain

/** Small deterministic jitter so neighbouring vertices don't shade flat. */
function hashJitter(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function terrainColour(h, x, z) {
  const sand = new THREE.Color(0xe9d29b);
  const grass = new THREE.Color(0x55873f);
  const deep = new THREE.Color(0x356636);
  const rock = new THREE.Color(0x6b6258);
  const c = new THREE.Color();
  if (h < 1.5) c.copy(sand);
  else if (h < 9) c.copy(sand).lerp(grass, (h - 1.5) / 7.5);
  else if (h < 46) c.copy(grass).lerp(deep, (h - 9) / 37);
  else c.copy(deep).lerp(rock, Math.min(1, (h - 46) / 40));
  const j = 0.92 + hashJitter(x, z) * 0.16;
  c.multiplyScalar(j);
  return c;
}

function buildTerrain() {
  const W = 3400, L = 11400, SX = 150, SZ = 220;
  const geo = new THREE.PlaneGeometry(W, L, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + 4900; // plane is centred; course runs z -800..10600
    const h = World.terrainHeightAt(x, z);
    // Sink the open-sea floor well below the water plane: at kilometre
    // distances the depth buffer cannot separate two surfaces 0.4 apart,
    // and they shimmer through each other. The beach (h >= 0.5) is kept.
    pos.setY(i, h < 0.5 ? h - 2.5 : h);
    pos.setZ(i, z);
    const c = terrainColour(h, x, z);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
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

  const crownGeo = new THREE.IcosahedronGeometry(4.4, 0);
  crownGeo.scale(1, 0.55, 1);
  crownGeo.translate(0, 10.2, 0);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2c6b34 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
  crowns.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  spots.forEach((p, i) => {
    const y = Math.max(1, World.terrainHeightAt(p.x, p.z));
    e.set((hashJitter(p.x, p.z) - 0.5) * 0.16, hashJitter(p.z, p.x) * Math.PI * 2, (hashJitter(p.x + 7, p.z) - 0.5) * 0.16);
    q.setFromEuler(e);
    v.set(p.x, y - 0.4, p.z);
    sv.set(p.s, p.s, p.s);
    m.compose(v, q, sv);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  scene.add(crowns);

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

function buildClouds() {
  const mat = new THREE.MeshLambertMaterial({
    color: 0xfff6e8, transparent: true, opacity: 0.88,
  });
  for (const c of World.clouds) {
    const group = new THREE.Group();
    const puffs = 4;
    for (let k = 0; k < puffs; k++) {
      const s = c.s * (0.5 + k * 0.18);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), mat);
      puff.scale.y = 0.6;
      puff.position.set((k - 1.5) * c.s * 0.5, (k % 2) * 7 - 3, (k % 3 - 1) * c.s * 0.18);
      group.add(puff);
    }
    group.position.set(c.x, c.y, c.z);
    group.userData.baseX = c.x;
    scene.add(group);
    cloudPuffs.push(group);
  }
}

// ---------------------------------------------------------------- runway

function buildRunway() {
  const rw = World.runway;
  const group = new THREE.Group();

  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(rw.width, 2.5, rw.length),
    new THREE.MeshLambertMaterial({ color: 0x4a4f57 })
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

  // Warm edge lights, glowing.
  const lightGeo = new THREE.SphereGeometry(1.7, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
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

// --------------------------------------------------------------- aircraft

function buildPlane() {
  const plane = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.45, metalness: 0.25 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8590c, roughness: 0.5, metalness: 0.2 });
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

  // Main wing + tailplane + fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 0.55, 4.6), orange);
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

  // Propeller: spinner + two blades, spun every frame.
  const prop = new THREE.Group();
  prop.position.z = 7.0;
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 12), dark);
  spinner.rotation.x = Math.PI / 2;
  prop.add(spinner);
  const bladeGeo = new THREE.BoxGeometry(0.5, 6.4, 0.18);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  plane.add(prop);
  plane.userData.prop = prop;

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

  // Fixed gear: two struts + wheels.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 6), dark);
    strut.position.set(side * 2.2, -1.9, 1.2);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.6, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 2.2, -3.1, 1.2);
    plane.add(wheel);
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

  // Propeller spin + nav-light blink.
  plane.userData.prop.rotation.z += dt * (6 + S.throttle * 46 + S.speed * 0.12);
  const blink = Math.sin(S.time * 6) > 0;
  plane.userData.navL.visible = blink;
  plane.userData.navR.visible = blink;

  updateRings(S);

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
  fwd.set(Math.sin(S.heading), 0, Math.cos(S.heading));
  camTarget.copy(plane.position).addScaledVector(fwd, -40).add(new THREE.Vector3(0, 13, 0));
  const k = 1 - Math.exp(-dt * 4.5);
  camPos.lerp(camTarget, k);
  camera.position.copy(camPos);
  camLook.copy(plane.position).addScaledVector(fwd, 90).add(new THREE.Vector3(0, 1, 0));
  up.set(Math.sin(S.bank * 0.28), Math.cos(S.bank * 0.28), 0);
  camera.up.copy(up);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();
  const wantFov = 62 + Math.max(0, S.speed - 120) * 0.05;
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}

window.Render3D = { draw };
