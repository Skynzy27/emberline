// Small shared helpers. No allocations in the hot paths: the movers below reuse
// one scratch Box3, and the sim never news a vector per frame.
import * as THREE from 'three';

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Deterministic RNG so ?shot= captures stage the same scene every run.
export function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const probe = new THREE.Box3();

// Axis-separated AABB slide: move a capsule-ish body (radius, height) through the
// world's box colliders one axis at a time, so a wall never swallows the body.
// pos and vel are THREE.Vector3, mutated in place. Returns the collider hit, if any.
export function slideMove(colliders, pos, vel, dt, radius, height) {
  let hit = null;
  const axes = ['x', 'z', 'y'];
  for (const axis of axes) {
    const next = pos[axis] + vel[axis] * dt;
    probe.min.set(pos.x - radius, pos.y + 0.04, pos.z - radius);
    probe.max.set(pos.x + radius, pos.y + height - 0.04, pos.z + radius);
    probe.min[axis] = next - radius;
    probe.max[axis] = next + radius;
    if (axis === 'y') {
      probe.min.y = next + 0.02;
      probe.max.y = next + height - 0.02;
    }
    let blocked = null;
    for (const c of colliders) {
      if (probe.intersectsBox(c)) {
        blocked = c;
        break;
      }
    }
    if (blocked) {
      vel[axis] = 0;
      hit = blocked;
    } else {
      pos[axis] = next;
    }
  }
  return hit;
}

// Line of sight between two points: true when no shootable box blocks the ray.
const losRay = new THREE.Raycaster();
const losDir = new THREE.Vector3();
export function hasLineOfSight(from, to, shootables) {
  losDir.copy(to).sub(from);
  const dist = losDir.length();
  if (dist < 0.001) return true;
  losDir.multiplyScalar(1 / dist);
  losRay.set(from, losDir);
  losRay.far = dist;
  return losRay.intersectObjects(shootables, false).length === 0;
}

// Horizontal angle from a yaw to a target point, for bot vision cones.
export function angleTo(from, yaw, target) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const want = Math.atan2(-dx, -dz);
  let d = want - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
