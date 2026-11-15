// Weapons: one def per weapon, one view model each. The numbers live here;
// main.js owns the ray and combat.js owns the damage. Spread grows with movement
// speed and with each shot fired (bloom), so stopping to aim pays.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// id, name, price, mag, reserve, gap(s), reload(s), damage, head x, pellets, auto, kick
export const WEAPONS = [
  { id: 'p12', name: 'P-12 Sidearm', price: 0, mag: 12, reserve: 36, gap: 0.16, reload: 1.3, dmg: 26, head: 3.2, pellets: 1, auto: false, kick: 0.011, spread: 0.006 },
  { id: 'vk9', name: 'VK-9 Carbine', price: 2700, mag: 30, reserve: 90, gap: 0.11, reload: 1.9, dmg: 34, head: 2.9, pellets: 1, auto: true, kick: 0.014, spread: 0.004 },
  { id: 'm7', name: 'M7 Scattergun', price: 1700, mag: 6, reserve: 24, gap: 0.85, reload: 2.4, dmg: 12, head: 2.0, pellets: 6, auto: false, kick: 0.035, spread: 0.045 },
];
export const GRENADES = [
  { id: 'frag', name: 'Frag charge', price: 300 },
  { id: 'flash', name: 'Flash charge', price: 200 },
];

function buildModel(def, mats) {
  const g = new THREE.Group();
  const dark = mats.hairline;
  const steel = mats.ink;
  if (def.id === 'p12') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.24), steel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.07), dark);
    grip.position.set(0, -0.09, 0.08);
    g.add(body, grip);
  } else if (def.id === 'vk9') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), steel);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.42), dark);
    barrel.position.set(0, 0.025, -0.4);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.24), dark);
    stock.position.set(0, -0.02, 0.31);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), dark);
    mag.position.set(0, -0.11, -0.02);
    mag.rotation.x = 0.16;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), dark);
    sight.position.set(0, 0.075, -0.1);
    g.add(receiver, barrel, stock, mag, sight);
  } else {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 10), steel);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.01, -0.16);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.16), dark);
    pump.position.set(0, -0.045, -0.2);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.26), dark);
    stock.position.set(0, -0.01, 0.3);
    g.add(tube, pump, stock);
  }
  g.position.set(0.24, -0.2, -0.42);
  return g;
}

export function createWeapons(camera) {
  const mats = {
    hairline: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 }),
    ink: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.45, metalness: 0.35 }),
  };
  const models = WEAPONS.map((d) => buildModel(d, mats));
  for (const m of models) {
    m.visible = false;
    camera.add(m);
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const owned = [true, false, false]; // P-12 owned from the start
  const state = {
    index: 0, // current weapon index into WEAPONS
    mag: WEAPONS[0].mag,
    reserve: WEAPONS[0].reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    bloom: 0, // spread growth from sustained fire, decays when not firing
    grenades: { frag: 0, flash: 0 },
  };

  function current() {
    return WEAPONS[state.index];
  }

  function showModel() {
    models.forEach((m, i) => {
      m.visible = i === state.index;
    });
  }
  showModel();

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.bloom = Math.max(0, state.bloom - dt * 0.055);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.index];
    model.position.z = -0.42 + state.kick;
    model.position.y = -0.2 + state.kick * 0.4;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const def = current();
      model.rotation.x = -0.55 * Math.min(1, (def.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = def.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    state,
    owned,
    current,
    step,
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      const def = current();
      state.cooldown = def.gap;
      state.flash = 0.06;
      state.kick = 0.055;
      state.bloom = Math.min(0.03, state.bloom + 0.004);
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      const def = current();
      if (state.reloadLeft > 0 || state.mag === def.mag || state.reserve === 0) return;
      state.reloadLeft = def.reload;
    },
    spread(speed) {
      const def = current();
      return def.spread + Math.min(1, speed / 5.2) * 0.026 + state.bloom;
    },
    select(index) {
      if (index === state.index || !owned[index] || state.reloadLeft > 0) return false;
      state.index = index;
      const def = current();
      state.mag = def.mag;
      state.reserve = def.reserve;
      state.cooldown = 0.25;
      showModel();
      return true;
    },
    buy(index, money) {
      const def = WEAPONS[index];
      if (owned[index] || money < def.price) return money;
      owned[index] = true;
      return money - def.price;
    },
    refillAmmo() {
      const def = current();
      state.mag = def.mag;
      state.reserve = def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
    },
    throwGrenade(kind) {
      if (state.grenades[kind] <= 0) return false;
      state.grenades[kind] -= 1;
      return true;
    },
  };
}
