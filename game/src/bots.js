// Warden bots: four defenders with names, routes, hold points and reactions.
// States: route (follow waypoints) -> hold (scan a site) -> engage (line of
// sight + burst fire) -> investigate (walk to a heard gunshot) -> defuse (the
// charge is planted) -> flash (blinded, wanders). They never teleport, never
// shoot through walls, and their aim error grows with distance.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { slideMove, hasLineOfSight, angleTo, clamp } from './util.js';

const BOT_GUN = { pellets: 1, dmg: 9, head: 1 };
const REACT_TIME = 0.6;
const VISION_RANGE = 26;
const MAX_ENGAGERS = 2;
const VISION_HALF_ANGLE = 1.0;
const ROUTE_SPEED = 3.4;
const DEFUSE_SPEED = 4.4;

const NAMES = ['Rook', 'Sable', 'Wren', 'Onyx'];
const ROUTE_KEYS = ['west', 'mid', 'east', 'flank'];

function buildBotMesh(scene, tint) {
  const group = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint), roughness: 0.75, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1a18'), roughness: 0.85 });
  const visor = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.cool), roughness: 0.25, metalness: 0.4, emissive: new THREE.Color(PALETTE.cool), emissiveIntensity: 0.5 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), armor);
  torso.position.y = 1.14;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.32), dark);
  head.position.y = 1.68;
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.05), visor);
  visorMesh.position.set(0, 1.7, -0.17);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), dark);
  legL.position.set(-0.16, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.7), dark);
  gun.position.set(0.28, 1.28, -0.3);
  group.add(torso, head, visorMesh, legL, legR, gun);
  group.traverse((m) => {
    m.castShadow = true;
  });
  scene.add(group);
  torso.userData = {};
  head.userData = {};
  return { group, torso, head, legL, legR, armor, visor };
}

export function createBots(scene, colliders, shootables, routes, spawns, deps) {
  const { state, combat, player, rng } = deps;
  const bots = [];
  const eyeTmp = new THREE.Vector3();
  const toTmp = new THREE.Vector3();
  const dirTmp = new THREE.Vector3();

  for (let i = 0; i < 4; i += 1) {
    const parts = buildBotMesh(scene, PALETTE.cool);
    const bot = {
      name: NAMES[i],
      routeKey: ROUTE_KEYS[i],
      waypoints: routes[ROUTE_KEYS[i]],
      wpIndex: 0,
      group: parts.group,
      armor: parts.armor,
      visor: parts.visor,
      hp: 100,
      alive: true,
      state: 'route',
      stateUntil: 0,
      yaw: Math.PI,
      pitch: 0,
      speed: 0,
      burstLeft: 0,
      burstTimer: 0,
      pauseTimer: 0,
      reactTimer: 0,
      seenAt: -99,
      investigatePos: null,
      flashUntil: 0,
      lastDamageAt: -99,
      deathAt: 0,
      walkPhase: rng() * 6,
      hitMeshes: [],
    };
    parts.torso.userData = { bot, part: 'body' };
    parts.head.userData = { bot, part: 'head' };
    parts.legL.userData = { bot, part: 'body' };
    parts.legR.userData = { bot, part: 'body' };
    bot.hitMeshes = [parts.torso, parts.head, parts.legL, parts.legR];
    bot.parts = parts;
    bots.push(bot);
  }

  function eyePos(bot, out) {
    out.set(bot.group.position.x, bot.group.position.y + 1.55, bot.group.position.z);
    return out;
  }

  function reset(round) {
    for (let i = 0; i < bots.length; i += 1) {
      const b = bots[i];
      b.group.position.copy(spawns.warden[i]);
      b.group.rotation.set(0, 0, 0);
      b.group.position.y = 0;
      b.hp = 100;
      b.alive = true;
      b.state = 'route';
      b.wpIndex = 0;
      b.yaw = Math.PI;
      b.burstLeft = 0;
      b.flashUntil = 0;
      b.investigatePos = null;
      b.armor.emissive = new THREE.Color(0x000000);
      b.armor.emissiveIntensity = 0;
      b.visor.emissiveIntensity = 0.5;
    }
    state.botsAlive = 4;
  }

  function canSee(bot) {
    if (!state.player.alive || state.phase !== 'live') return false;
    const p = player.state.position;
    const dx = p.x - bot.group.position.x;
    const dz = p.z - bot.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > VISION_RANGE) return false;
    if (Math.abs(angleTo(bot.group.position, bot.yaw, p)) > VISION_HALF_ANGLE && dist > 4) return false;
    eyePos(bot, eyeTmp);
    toTmp.set(p.x, p.y + 1.25, p.z);
    return hasLineOfSight(eyeTmp, toTmp, shootables);
  }

  function moveToward(bot, target, dt, speed) {
    const pos = bot.group.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return true;
    const want = Math.atan2(-dx, -dz);
    let d = want - bot.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    bot.yaw += clamp(d, -3.2 * dt, 3.2 * dt);
    const vel = new THREE.Vector3(-Math.sin(bot.yaw) * speed, 0, -Math.cos(bot.yaw) * speed);
    const before = pos.clone();
    slideMove(colliders, pos, vel, dt, 0.34, 1.7);
    if (pos.y < 0) pos.y = 0;
    const moved = pos.distanceTo(before);
    bot.walkPhase += dt * (moved > 0.001 ? 9 : 0);
    const swing = moved > 0.001 ? Math.sin(bot.walkPhase) * 0.16 : 0;
    bot.parts.legL.rotation.x = swing;
    bot.parts.legR.rotation.x = -swing;
    return dist < 0.5;
  }

  function botShoot(bot, dt) {
    if (bot.burstLeft > 0) {
      bot.burstTimer -= dt;
      if (bot.burstTimer <= 0) {
        bot.burstTimer = 0.16;
        bot.burstLeft -= 1;
        eyePos(bot, eyeTmp);
        const p = player.state.position;
        toTmp.set(p.x + (rng() - 0.5) * 1.1, p.y + 1.25 + (rng() - 0.5) * 0.7, p.z + (rng() - 0.5) * 1.1);
        dirTmp.copy(toTmp).sub(eyeTmp).normalize();
        const dist = eyeTmp.distanceTo(toTmp);
        const spread = 0.02 + dist * 0.0016;
        combat.fire(eyeTmp, dirTmp, BOT_GUN, spread, rng, 'bot', bot.group.position);
        deps.audio.botShot(dist);
      }
    } else {
      bot.pauseTimer -= dt;
      if (bot.pauseTimer <= 0) {
        bot.burstLeft = 2 + Math.floor(rng() * 2);
        bot.pauseTimer = 0.9 + rng() * 0.7;
      }
    }
  }

  function step(dt) {
    const bombPlanted = state.bomb.state === 'planted';
    for (const bot of bots) {
      if (!bot.alive) continue;
      const pos = bot.group.position;
      // Hit flash: armour glows ember briefly after taking damage.
      if (state.time < bot.flashUntil && bot.lastDamageAt > state.time - 0.1) {
        bot.armor.emissive.set(PALETTE.accent);
        bot.armor.emissiveIntensity = 0.9;
      } else {
        bot.armor.emissiveIntensity = 0;
      }
      if (state.time < bot.flashUntil && bot.state === 'flash') {
        // Blinded: wander slowly, cannot shoot.
        bot.yaw += dt * 1.4;
        if (state.time >= bot.stateUntil) {
          bot.state = bombPlanted ? 'defuse' : 'hold';
        }
        continue;
      }
      // The charge is down: every living bot rushes to defuse it.
      if (bombPlanted && bot.state !== 'defuse') {
        bot.state = 'defuse';
        bot.investigatePos = null;
      }
      if (bot.state === 'defuse' && state.bomb.pos) {
        const arrived = moveToward(bot, state.bomb.pos, dt, DEFUSE_SPEED);
        if (arrived || pos.distanceTo(state.bomb.pos) < 1.7) {
          state.bomb.defuser = bot;
          state.bomb.defuseProgress += dt;
          bot.yaw += Math.sin(state.time * 2 + bot.walkPhase) * dt * 0.4;
          // The round flow (rounds.js) owns the defused transition; here the bot
          // only channels the progress.
        } else {
          if (state.bomb.defuser === bot) {
            state.bomb.defuser = null;
            state.bomb.defuseProgress = 0;
          }
        }
        continue;
      }
      // Vision check: seeing the player overrides routes and holds — but at
      // most two Wardens engage at once, so one player never eats a 1v4
      // crossfire; the rest hold their angles.
      const sees = canSee(bot);
      const engagers = bots.filter((o) => o.alive && o.state === 'engage').length;
      if (sees) {
        bot.seenAt = state.time;
        if (bot.state !== 'engage' && engagers < MAX_ENGAGERS) {
          bot.state = 'engage';
          bot.reactTimer = REACT_TIME;
          bot.burstLeft = 0;
          bot.pauseTimer = 0.2;
        }
      } else if (bot.state === 'engage' && state.time - bot.seenAt > 1.6) {
        bot.state = 'investigate';
        bot.investigatePos = new THREE.Vector3(player.state.position.x, 0, player.state.position.z);
        bot.stateUntil = state.time + 4;
      }
      if (bot.state === 'engage') {
        // Face the player, strafe a little, fire in bursts after reacting.
        const p = player.state.position;
        const want = Math.atan2(-(p.x - pos.x), -(p.z - pos.z));
        let d = want - bot.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        bot.yaw += clamp(d, -4 * dt, 4 * dt);
        bot.reactTimer -= dt;
        if (bot.reactTimer <= 0 && state.player.alive) botShoot(bot, dt);
        // Small strafe so a bot is never a still target.
        const strafe = Math.sin(state.time * 0.9 + bot.walkPhase) * 1.1;
        const vel = new THREE.Vector3(Math.cos(bot.yaw) * strafe, 0, -Math.sin(bot.yaw) * strafe);
        slideMove(colliders, pos, vel, dt, 0.34, 1.7);
        if (pos.y < 0) pos.y = 0;
        continue;
      }
      // Hearing: a recent gunshot inside range pulls the nearest bots over.
      if (bot.state === 'route' || bot.state === 'hold') {
        for (const n of state.noise) {
          if (state.time - n.t > 3) continue;
          const d = Math.hypot(n.x - pos.x, n.z - pos.z);
          if (d < n.radius) {
            bot.state = 'investigate';
            bot.investigatePos = new THREE.Vector3(n.x, 0, n.z);
            bot.stateUntil = state.time + 5;
            break;
          }
        }
      }
      if (bot.state === 'investigate' && bot.investigatePos) {
        const arrived = moveToward(bot, bot.investigatePos, dt, ROUTE_SPEED);
        if (arrived || state.time >= bot.stateUntil) {
          bot.state = 'hold';
          bot.stateUntil = state.time + 2.5;
        }
        continue;
      }
      if (bot.state === 'route') {
        const wp = bot.waypoints[bot.wpIndex];
        if (moveToward(bot, wp, dt, ROUTE_SPEED)) {
          bot.wpIndex += 1;
          if (bot.wpIndex >= bot.waypoints.length) {
            bot.state = 'hold';
            bot.stateUntil = state.time + 999;
          }
        }
        continue;
      }
      // hold: slow scan, yaw sweeping the site.
      bot.yaw += Math.sin(state.time * 0.45 + bot.walkPhase) * dt * 0.55;
    }
    // Apply yaw to the groups once, after all logic.
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.group.rotation.y = bot.yaw;
    }
  }

  return { bots, reset, step, eyePos };
}
