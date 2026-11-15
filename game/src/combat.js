// Combat: hitscan shooting, grenades, and damage. The ray is here; the round
// flow (who wins, what it pays) lives in rounds.js and the AI in bots.js.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const raycaster = new THREE.Raycaster();
const tmpDir = new THREE.Vector3();
const tmpPoint = new THREE.Vector3();

export function createCombat(deps) {
  const { scene, fx, audio, state, colliders, shootables, player, playerHitMesh } = deps;
  let bots = [];
  const grenades = [];
  const grenadeGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.5 });

  function setBots(list) {
    bots = list;
  }

  function aliveBotMeshes() {
    const out = [];
    for (const b of bots) {
      if (b.alive) out.push(...b.hitMeshes);
    }
    return out;
  }

  // One ray against world + bot bodies (+ the player's hitbox when bots shoot).
  function rayShot(origin, dir, includePlayer) {
    raycaster.set(origin, dir);
    raycaster.far = 90;
    const targets = shootables.concat(aliveBotMeshes());
    if (includePlayer && state.player.alive) targets.push(playerHitMesh);
    const hits = raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0] : null;
  }

  function damageBot(bot, dmg, isHead, point) {
    if (!bot.alive) return;
    bot.hp -= dmg;
    bot.flashUntil = state.time + 0.09;
    bot.lastDamageAt = state.time;
    if (point) fx.burst(point, PALETTE.accent, 0.25);
    if (bot.hp <= 0) {
      bot.alive = false;
      bot.deathAt = state.time;
      bot.group.rotation.z = Math.PI / 2;
      bot.group.position.y = 0.35;
      state.botsAlive -= 1;
      state.kills += 1;
      state.player.kills += 1;
      state.money += 300;
      state.feed.unshift({ text: `You dropped ${bot.name}${isHead ? ' — headshot' : ''}  +$300`, good: true });
      audio.hit(true);
      if (state.bomb.defuser === bot) {
        state.bomb.defuser = null;
        state.bomb.defuseProgress = 0;
      }
    } else {
      audio.hit(false);
    }
  }

  function damagePlayer(dmg, fromPos) {
    if (!state.player.alive || state.phase !== 'live') return;
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.hurtAt = state.time;
    audio.hurt();
    if (state.player.hp <= 0) {
      state.player.alive = false;
      state.player.deaths += 1;
      state.feed.unshift({ text: 'You were dropped by the Wardens', good: false });
    }
  }

  // Player or bot fires one trigger pull: pellets rays with spread, tracer, sound,
  // and a noise event bots can hear.
  function fire(origin, dir, def, spread, rng, source, shooterPos) {
    let hitAny = false;
    let killed = false;
    for (let p = 0; p < def.pellets; p += 1) {
      tmpDir.copy(dir);
      tmpDir.x += (rng() * 2 - 1) * spread;
      tmpDir.y += (rng() * 2 - 1) * spread;
      tmpDir.z += (rng() * 2 - 1) * spread;
      tmpDir.normalize();
      const hit = rayShot(origin, tmpDir, source === 'bot');
      const end = hit ? hit.point : tmpPoint.copy(origin).addScaledVector(tmpDir, 60);
      fx.tracer(origin, end, source === 'bot' ? PALETTE.cool : PALETTE.accent);
      if (!hit) continue;
      hitAny = true;
      const ud = hit.object.userData;
      if (ud.bot && ud.bot.alive) {
        const isHead = ud.part === 'head';
        const before = ud.bot.hp;
        damageBot(ud.bot, def.dmg * (isHead ? def.head : 1), isHead, hit.point);
        if (before > 0 && ud.bot.hp <= 0) killed = true;
      } else if (ud.player) {
        const dist = origin.distanceTo(hit.point);
        damagePlayer(def.dmg * (dist > 22 ? 0.7 : 1), origin);
      } else {
        fx.burst(hit.point, PALETTE.muted, 0.18);
      }
    }
    if (source === 'player') {
      state.noise.push({ x: shooterPos.x, z: shooterPos.z, radius: 26, t: state.time });
      if (state.noise.length > 8) state.noise.shift();
    }
    return { hitAny, killed };
  }

  function throwGrenade(kind, from, dir) {
    const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
    mesh.position.copy(from);
    scene.add(mesh);
    grenades.push({
      kind,
      mesh,
      vel: new THREE.Vector3(dir.x * 13, dir.y * 13 + 3.2, dir.z * 13),
      timer: kind === 'frag' ? 1.6 : 0.9,
      armed: false,
    });
    audio.step();
  }

  function explode(g) {
    const pos = g.mesh.position;
    if (g.kind === 'frag') {
      fx.burst(pos, PALETTE.accent, 2.2);
      audio.explosion();
      const pr = player.state.position;
      const pd = Math.hypot(pr.x - pos.x, pr.y + 1.2 - pos.y, pr.z - pos.z);
      if (pd < 4.5 && state.player.alive) damagePlayer(Math.round(95 * (1 - pd / 5.2)), pos);
      for (const b of bots) {
        if (!b.alive) continue;
        const d = b.group.position.distanceTo(pos);
        if (d < 4.5) damageBot(b, Math.round(95 * (1 - d / 5.2)), false, pos);
      }
    } else {
      fx.burst(pos, '#ffffff', 1.6);
      audio.flash();
      for (const b of bots) {
        if (!b.alive) continue;
        const d = b.group.position.distanceTo(pos);
        if (d > 15) continue;
        tmpPoint.copy(pos);
        tmpPoint.y += 0.4;
        const eye = b.eyePos(tmpPoint.clone());
        // Flash only blinds bots with a clear line of sight to the burst:
        // the ray must reach the eye without hitting anything first.
        const hit = rayShot(pos, tmpDir.copy(eye).sub(pos).normalize(), false);
        if (!hit || hit.distance >= eye.distanceTo(pos)) {
          b.flashUntil = Math.max(b.flashUntil || 0, state.time + 3);
          b.state = 'flash';
          b.stateUntil = state.time + 3;
        }
      }
    }
    scene.remove(g.mesh);
  }

  function stepGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.vel.y -= 14 * dt;
      const p = g.mesh.position;
      // Axis-separated bounce against colliders, then the floor.
      for (const axis of ['x', 'z', 'y']) {
        const next = p[axis] + g.vel[axis] * dt;
        let blocked = false;
        for (const c of colliders) {
          if (next > c.min[axis] - 0.09 && next < c.max[axis] + 0.09
            && p.x > c.min.x - 0.09 && p.x < c.max.x + 0.09
            && p.y > c.min.y - 0.09 && p.y < c.max.y + 0.09
            && p.z > c.min.z - 0.09 && p.z < c.max.z + 0.09) {
            blocked = true;
            break;
          }
        }
        if (blocked) g.vel[axis] = -g.vel[axis] * 0.4;
        else p[axis] = next;
      }
      if (p.y < 0.12) {
        p.y = 0.12;
        g.vel.y = Math.abs(g.vel.y) > 1.2 ? -g.vel.y * 0.35 : 0;
        g.vel.x *= 0.7;
        g.vel.z *= 0.7;
      }
      g.timer -= dt;
      if (g.timer <= 0) {
        explode(g);
        grenades.splice(i, 1);
      }
    }
  }

  return { setBots, fire, damageBot, damagePlayer, throwGrenade, stepGrenades, grenades };
}
