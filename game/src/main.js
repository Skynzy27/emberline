// EMBERLINE boot and the one loop: a fixed 60 Hz simulation feeding a render
// at the display's rate. ?shot=start|play|bomb|end with &seed=N stages a
// deterministic frame for a capture, renders it twice, then freezes it and sets
// window.__shotReady.
import * as THREE from 'three';
import { createState, ROUND_TIME } from './state.js';
import { mulberry32, clamp } from './util.js';
import { createRender } from './render.js';
import { createMap } from './map.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createWeapons, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createCombat } from './combat.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

const state = createState();
state.seed = seed;
const { renderer, scene, camera } = createRender();
const map = createMap(scene);
const fx = createFx(scene);
const audio = createAudio();
const hud = createHud();
const player = createPlayer(map.colliders, map.spawns.ember[1]);
const weapons = createWeapons(camera);
const input = createInput(renderer.domElement, onLockChange);

// The player's hitbox: invisible to the eye, solid to bot rays.
const playerHitMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 1.72, 0.7),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
);
playerHitMesh.userData = { player: true };
scene.add(playerHitMesh);

const combat = createCombat({ scene, fx, audio, state, colliders: map.colliders, shootables: map.shootables, player, playerHitMesh });
const bots = createBots(scene, map.colliders, map.shootables, map.routes, map.spawns, { state, combat, player, rng: random, audio });
combat.setBots(bots.bots);
const rounds = createRounds({ state, player, weapons, bots, map, audio, hud });

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const direction = new THREE.Vector3();
const eyePos = new THREE.Vector3();
const muzzlePos = new THREE.Vector3();

let started = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();
let prevFiring = false;
let prevPhase = state.phase;
let shake = 0;
let lastFeedKey = '';
let lastHp = -1;

function syncCamera() {
  player.eyePos(eyePos);
  camera.position.copy(eyePos);
  if (shake > 0.001) {
    camera.position.x += (random() - 0.5) * shake * 0.06;
    camera.position.y += (random() - 0.5) * shake * 0.06;
  }
  camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
  playerHitMesh.position.set(player.state.position.x, player.state.position.y + 0.86, player.state.position.z);
}

function aimAt(point) {
  const p = player.state;
  const dx = point.x - p.position.x;
  const dy = point.y - (p.position.y + p.eye);
  const dz = point.z - p.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.asin(clamp(dy / len, -1, 1));
  syncCamera();
}

function shoot() {
  const def = weapons.current();
  if (!weapons.takeRound()) {
    audio.dry();
    return false;
  }
  camera.getWorldDirection(direction);
  const spread = shot ? 0 : weapons.spread(player.groundSpeed());
  const result = combat.fire(camera.position, direction, def, spread, random, 'player', player.state.position);
  weapons.pullTrigger();
  player.recoil(def.kick * (0.8 + random() * 0.4), (random() * 2 - 1) * def.kick * 0.3);
  audio.shot(def.id);
  if (result.hitAny) hud.hitMarker(result.killed, shot ? 4000 : 90);
  hud.setAmmo(weapons.state.mag, weapons.state.reserve, def.name);
  return true;
}

function throwGrenade(kind) {
  if (!weapons.throwGrenade(kind)) return;
  camera.getWorldDirection(direction);
  player.eyePos(muzzlePos).addScaledVector(direction, 0.5);
  combat.throwGrenade(kind, muzzlePos, direction);
  hud.setGrenades(weapons.state.grenades.frag, weapons.state.grenades.flash);
}

function handlePressed(code) {
  if (code === 'KeyR') weapons.reload();
  else if (code === 'KeyB' && state.phase === 'buy') hud.setBuyVisible(document.getElementById('buy').hidden);
  else if (code === 'KeyG') throwGrenade('frag');
  else if (code === 'KeyF') throwGrenade('flash');
  else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
    const index = Number(code.slice(-1)) - 1;
    if (state.phase === 'buy') rounds.buy(index, 'weapon');
    else weapons.select(index);
  } else if (code === 'Digit4') rounds.buy(0, 'frag');
  else if (code === 'Digit5') rounds.buy(1, 'flash');
}

function step(dt) {
  state.time += dt;
  const pressed = input.takePressed();
  for (const code of pressed) handlePressed(code);
  const keys = input.state.keys;
  if (state.phase === 'live' && state.player.alive) {
    player.step(dt, keys);
    // Fire: auto weapons hold, semi-auto fire on the click edge.
    const def = weapons.current();
    const wantFire = input.state.firing && (def.auto || !prevFiring);
    if (wantFire && weapons.ready()) shoot();
    else if (input.state.firing && weapons.state.mag === 0 && weapons.state.reloadLeft === 0) weapons.reload();
    // Plant: hold E near a site.
    rounds.plantStep(dt, keys.has('KeyE'));
    hud.setPlant(state.bomb.plantProgress / 3);
  } else if (state.phase === 'buy') {
    player.step(dt, keys);
    hud.setPlant(0);
  }
  prevFiring = input.state.firing;
  weapons.step(dt);
  bots.step(dt);
  combat.stepGrenades(dt);
  rounds.step(dt);
  map.step(dt, state.time, state.bomb.state);
  fx.step(dt);
  shake = Math.max(0, shake - dt * 2.2);
  if (state.player.hp !== lastHp) {
    lastHp = state.player.hp;
    if (state.player.hp < 100) hud.hurtFlash();
  }
  syncHud();
}

function syncHud() {
  const def = weapons.current();
  hud.setHealth(state.player.hp);
  hud.setAmmo(weapons.state.mag, weapons.state.reserve, def.name);
  hud.setGrenades(weapons.state.grenades.frag, weapons.state.grenades.flash);
  hud.setTimer(state.phase === 'live' ? state.timer : state.phase === 'buy' ? state.timer : 0);
  hud.setScore(state.wins, state.losses, state.round);
  hud.setMoney(state.money);
  hud.setAlive(state.player.alive ? 1 : 0, state.botsAlive);
  hud.setCrosshairSpread(weapons.spread(player.groundSpeed()) * 620);
  const feedKey = state.feed.map((f) => f.text).join('|');
  if (feedKey !== lastFeedKey) {
    lastFeedKey = feedKey;
    hud.pushFeed(state.feed);
  }
  if (state.bomb.state === 'planted') {
    const defusing = state.bomb.defuser ? ' — Wardens defusing!' : '';
    hud.setBomb(`Charge live — ${Math.ceil(state.bomb.timer)}s${defusing}`, true);
  } else if (state.bomb.state === 'carried') {
    let near = false;
    for (const site of Object.values(map.sites)) {
      const p = player.state.position;
      if (Math.hypot(p.x - site.pos.x, p.z - site.pos.z) < 2.6) near = true;
    }
    hud.setBomb(near ? 'Hold E to plant the charge' : 'Carry the charge to a site', false);
  } else if (state.bomb.state === 'defused') {
    hud.setBomb('Charge defused', false);
  } else {
    hud.setBomb('Charge detonated', false);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (state.phase === 'live' || state.phase === 'buy') player.look(look.x, look.y);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    if (state.phase !== prevPhase) {
      prevPhase = state.phase;
      if ((state.phase === 'roundEnd' || state.phase === 'matchEnd') && document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
    syncCamera();
  }
  renderer.render(scene, camera);
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    audio.unlock();
    hud.hideOverlay();
  } else if (state.phase !== 'matchEnd' && state.phase !== 'roundEnd') {
    hud.showOverlay(started ? 'paused' : 'start', 0);
  }
}

hud.onPlay(() => {
  if (shot) return;
  if (state.phase === 'menu' || state.phase === 'matchEnd') {
    rounds.startMatch();
    syncHud();
  }
  input.requestLock();
});

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideOverlay();
  if (name === 'start') {
    rounds.startMatch();
    player.state.yaw = 0;
    player.state.pitch = 0.02;
    settle(20);
    hud.showMessage('Cinder Yard — plant the charge', 4);
  } else if (name === 'play') {
    rounds.startMatch();
    rounds.goLive();
    settle(260);
    player.state.position.set(0, 0, 6);
    player.state.velocity.set(0, 0, 0);
    // Stage the firefight in the open mid corridor: place the mid-route bot
    // in clear sight down the lane, facing the player, so the shot reads as
    // a duel instead of a wall.
    const duel = bots.bots[1];
    duel.group.position.set(0, 0, -2);
    duel.yaw = Math.PI;
    duel.state = 'hold';
    const chest = duel.group.position.clone();
    chest.y = 1.25;
    aimAt(chest);
    shoot();
    settle(8);
    aimAt(chest);
    shoot();
    settle(2);
  } else if (name === 'bomb') {
    rounds.startMatch();
    rounds.goLive();
    state.bomb.state = 'planted';
    state.bomb.site = 'A';
    state.bomb.timer = 25;
    state.bomb.pos = map.sites.A.pos.clone();
    state.bomb.pos.y = 0.16;
    state.player.hasBomb = false;
    map.bombMesh.position.copy(state.bomb.pos);
    map.bombMesh.visible = true;
    player.state.position.set(-8.5, 0, -4.5);
    player.state.velocity.set(0, 0, 0);
    aimAt(new THREE.Vector3(-12.6, 0.6, -8.5));
    // Bots rush to defuse, but the shot freezes before any 5 s channel ends.
    settle(150);
    hud.showMessage('Charge planted at Furnace — defend it', 4);
  } else {
    rounds.startMatch();
    rounds.goLive();
    rounds.endRound(true, 'Charge detonated at Furnace');
  }
  syncHud();
  paintTwiceThenReady();
}

syncCamera();
syncHud();
// Debug handle for local play-testing only (?debug=1): exposes the live sim so
// a test driver can drive keys, firing and teleports without a pointer lock.
if (params.has('debug')) {
  window.__ember = { state, player, weapons, bots, combat, rounds, input, map, hud, step, syncCamera };
}
if (shot) runShot(shot);
else requestAnimationFrame(frame);
