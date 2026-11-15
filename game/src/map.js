// Cinder Yard: an original dusk industrial yard, 36 x 28 m. Ember spawn south,
// Warden spawn north, two charge sites (A Furnace west, B Silo east) and three
// lanes — west, mid container corridor, east — with crates and containers for cover.
// Every box is both a collider and a bullet stop. Nothing here copies any map.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { groundTexture, wallTexture, containerTexture, crateTexture, metalTexture } from './textures.js';

const W = 18; // half width (x)
const D = 14; // half depth (z)

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const mats = {};
  for (const [name, color] of Object.entries(PALETTE)) {
    mats[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: name === 'accent' || name === 'gold' ? 0.5 : 0.92,
      metalness: name === 'cool' ? 0.25 : 0.04,
    });
  }
  const dark = new THREE.MeshStandardMaterial({ color: 0x100d0a, roughness: 1 });
  // Textured materials: canvas-painted surfaces, tinted white so the paint
  // shows as drawn.
  const textured = {
    wall: new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.95 }),
    containerA: new THREE.MeshStandardMaterial({ map: containerTexture('#4a3d2c'), roughness: 0.7, metalness: 0.3 }),
    containerB: new THREE.MeshStandardMaterial({ map: containerTexture('#31444a'), roughness: 0.7, metalness: 0.3 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ map: metalTexture('#4a3f33'), roughness: 0.55, metalness: 0.45 }),
    silo: new THREE.MeshStandardMaterial({ map: metalTexture('#3d5a5e'), roughness: 0.5, metalness: 0.5 }),
  };

  const colliders = [];
  const shootables = [];
  const animated = [];
  // Minimap layout: every solid's top-down footprint, in world metres.
  const layout = [];

  function box(w, h, d, x, y, z, mat, collide = true, kind = 'block') {
    const material = typeof mat === 'string' ? (mats[mat] || dark) : mat;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    layout.push({ x, z, w, d, kind });
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(m));
      shootables.push(m);
    }
    return m;
  }

  // Ground and outer walls.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 1, D * 2 + 1),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  colliders.push(new THREE.Box3(new THREE.Vector3(-W - 0.5, -1, -D - 0.5), new THREE.Vector3(W + 0.5, 0, D + 0.5)));
  box(0.6, 4.6, D * 2 + 1.2, -W - 0.3, 2.3, 0, textured.wall, true, 'wall');
  box(0.6, 4.6, D * 2 + 1.2, W + 0.3, 2.3, 0, textured.wall, true, 'wall');
  box(W * 2 + 1.2, 4.6, 0.6, 0, 2.3, -D - 0.3, textured.wall, true, 'wall');
  box(W * 2 + 1.2, 4.6, 0.6, 0, 2.3, D + 0.3, textured.wall, true, 'wall');

  // Site A — the Furnace (west): big kiln block, chimney, ember glow.
  box(4.2, 3.4, 3.2, -14.2, 1.7, -8.5, textured.metal, true, 'block');
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5.4, 10), mats.hairline);
  chimney.position.set(-15.2, 2.7, -10.4);
  chimney.castShadow = true;
  group.add(chimney);
  layout.push({ x: -15.2, z: -10.4, w: 1.8, d: 1.8, kind: 'block' });
  colliders.push(new THREE.Box3().setFromObject(chimney));
  shootables.push(chimney);
  const furnaceMouth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }));
  furnaceMouth.position.set(-12.05, 1.1, -8.5);
  furnaceMouth.rotation.y = Math.PI / 2;
  group.add(furnaceMouth);
  // Emissive accents: a hot trim strip above the mouth and a vent grate.
  const furnaceStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 2.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }));
  furnaceStrip.position.set(-12.04, 2.15, -8.5);
  group.add(furnaceStrip);
  const furnaceVent = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb066') }));
  furnaceVent.position.set(-12.05, 2.9, -8.5);
  furnaceVent.rotation.y = Math.PI / 2;
  group.add(furnaceVent);
  const glowA = new THREE.PointLight(new THREE.Color(PALETTE.accent), 26, 13, 1.8);
  glowA.position.set(-11.4, 1.6, -8.5);
  scene.add(glowA);
  animated.push({ light: glowA, base: 26, speed: 2.1 });

  // Site B — the Silo (east): tall cylinder, gantry, teal lamp.
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 6.4, 14), textured.silo);
  silo.position.set(14.4, 3.2, -8.6);
  silo.castShadow = true;
  silo.receiveShadow = true;
  group.add(silo);
  layout.push({ x: 14.4, z: -8.6, w: 4.2, d: 4.2, kind: 'silo' });
  colliders.push(new THREE.Box3().setFromObject(silo));
  shootables.push(silo);
  // Emissive accents: a glowing teal band around the silo and a lamp strip
  // under the gantry.
  const siloBand = new THREE.Mesh(new THREE.CylinderGeometry(2.14, 2.14, 0.16, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.cool) }));
  siloBand.position.set(14.4, 4.6, -8.6);
  group.add(siloBand);
  box(3.4, 0.5, 1.4, 12.6, 3.6, -6.4, textured.metal, true, 'block'); // gantry
  const siloLamp = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.06),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.cool) }));
  siloLamp.position.set(12.6, 3.32, -5.68);
  group.add(siloLamp);
  const glowB = new THREE.PointLight(new THREE.Color(PALETTE.cool), 20, 12, 1.8);
  glowB.position.set(12.2, 2.6, -7.2);
  scene.add(glowB);
  animated.push({ light: glowB, base: 20, speed: 1.4 });

  // Mid lane: two containers leave a 2.4 m corridor with a sightline to both sites.
  box(6.4, 2.6, 2.2, -5.4, 1.3, -1.2, textured.containerA, true, 'container');
  box(6.4, 2.6, 2.2, 5.4, 1.3, 1.6, textured.containerB, true, 'container');
  box(2.2, 2.6, 2.2, 0, 1.3, -4.6, textured.metal, true, 'block');
  // Crates: crouch cover scattered on the lanes.
  box(1.2, 1.1, 1.2, -8.6, 0.55, 2.6, textured.crate, true, 'crate');
  box(1.2, 1.1, 1.2, -7.2, 0.55, 3.2, textured.crate, true, 'crate');
  box(1.2, 1.1, 1.2, 8.8, 0.55, -2.4, textured.crate, true, 'crate');
  box(1.2, 1.1, 1.2, -2.6, 0.55, 6.4, textured.crate, true, 'crate');
  box(1.2, 1.1, 1.2, 3.4, 0.55, -6.2, textured.crate, true, 'crate');
  box(1.2, 1.1, 1.2, -11.6, 0.55, -3.4, textured.crate, true, 'crate');
  box(1.2, 1.1, 1.2, 11.8, 0.55, -3.2, textured.crate, true, 'crate');
  // Barrels: low round cover near the spawns.
  for (const [x, z] of [[-3.4, 9.4], [-2.2, 9.8], [3.6, 9.6], [-4.2, -9.2], [4.4, -9.4]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.15, 10), mats.gold);
    b.position.set(x, 0.58, z);
    b.castShadow = true;
    group.add(b);
    layout.push({ x, z, w: 1.1, d: 1.1, kind: 'barrel' });
    colliders.push(new THREE.Box3().setFromObject(b));
    shootables.push(b);
  }
  // Raised watch platform at the south wall, reached from the ground (no ladder needed:
  // it is 0.9 m high, a jump gets you up).
  box(5.0, 0.9, 2.0, 0, 0.45, 11.6, textured.wall, true, 'platform');

  // Distant skyline silhouettes outside the walls: the yard reads as a city at dusk.
  const skyline = new THREE.Group();
  for (let i = 0; i < 14; i += 1) {
    const h = 6 + ((i * 37) % 14);
    const m = new THREE.Mesh(new THREE.BoxGeometry(4 + ((i * 13) % 5), h, 4), dark);
    const a = (i / 14) * Math.PI * 2;
    m.position.set(Math.cos(a) * 34, h / 2 - 0.5, Math.sin(a) * 30);
    skyline.add(m);
  }
  scene.add(skyline);

  // Charge sites: glowing rings on the ground plus a floating marker.
  function siteRing(color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);
    return ring;
  }
  const ringA = siteRing(new THREE.Color(PALETTE.accent));
  ringA.position.set(-12.6, 0.03, -8.5);
  const ringB = siteRing(new THREE.Color(PALETTE.cool));
  ringB.position.set(12.6, 0.03, -8.5);

  // The planted charge: a small blinking box, hidden until planted.
  const bombMesh = new THREE.Group();
  const bombBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.5 }));
  const bombLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.danger) }));
  bombLamp.position.set(0, 0.17, 0);
  bombMesh.add(bombBody, bombLamp);
  bombMesh.visible = false;
  scene.add(bombMesh);
  const bombLight = new THREE.PointLight(new THREE.Color(PALETTE.danger), 0, 7, 1.6);
  scene.add(bombLight);

  const sites = {
    A: { id: 'A', name: 'Furnace', pos: new THREE.Vector3(-12.6, 0, -8.5), ring: ringA },
    B: { id: 'B', name: 'Silo', pos: new THREE.Vector3(12.6, 0, -8.5), ring: ringB },
  };
  const spawns = {
    // In front of the watch platform (its top is 0.9 m; spawning on it would
    // wedge the player inside its collider). Clear of the barrels too.
    ember: [new THREE.Vector3(-2.4, 0, 8.6), new THREE.Vector3(0, 0, 8.8), new THREE.Vector3(2.4, 0, 8.6)],
    warden: [new THREE.Vector3(-6, 0, -11.6), new THREE.Vector3(-2, 0, -12), new THREE.Vector3(2, 0, -12), new THREE.Vector3(6, 0, -11.6)],
  };
  // Bot routes: west lane, mid corridor, east lane, each ending in a hold at a site.
  const routes = {
    west: [new THREE.Vector3(-6, 0, -11.6), new THREE.Vector3(-10, 0, -6), new THREE.Vector3(-12.6, 0, -8.5)],
    mid: [new THREE.Vector3(-2, 0, -12), new THREE.Vector3(-1.4, 0, -4.4), new THREE.Vector3(0, 0, 1.2), new THREE.Vector3(-2, 0, 6)],
    east: [new THREE.Vector3(2, 0, -12), new THREE.Vector3(8, 0, -6), new THREE.Vector3(12.6, 0, -8.5)],
    flank: [new THREE.Vector3(6, 0, -11.6), new THREE.Vector3(10, 0, -2), new THREE.Vector3(8, 0, 5), new THREE.Vector3(8, 0, 6)],
  };

  return {
    colliders,
    shootables,
    layout,
    sites,
    spawns,
    routes,
    bombMesh,
    bombLight,
    bombLamp,
    step(dt, time, bombState) {
      for (const a of animated) a.light.intensity = a.base * (0.85 + 0.15 * Math.sin(time * a.speed));
      const pulse = 0.55 + 0.3 * Math.sin(time * 3.2);
      ringA.material.opacity = pulse;
      ringB.material.opacity = pulse;
      if (bombState === 'planted') {
        const blink = Math.sin(time * 10) > 0;
        bombLamp.visible = blink;
        bombLight.intensity = blink ? 14 : 2;
      } else {
        bombLight.intensity = 0;
      }
    },
  };
}
