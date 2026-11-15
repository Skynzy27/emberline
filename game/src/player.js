// Player movement: acceleration, friction, gravity, crouch and jump, resolved as
// a box against the world's colliders one axis at a time (see util.slideMove),
// so a wall never swallows the player and stopping to aim pays.
import * as THREE from 'three';
import { slideMove } from './util.js';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.2;
const CROUCH_SPEED = 2.4;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const GRAVITY = 20;
const JUMP_SPEED = 6.2;

export function createPlayer(colliders, start) {
  const p = {
    position: start.clone(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
  };
  const wish = new THREE.Vector3();
  const probe = new THREE.Box3();

  function overlaps(x, y, z, height) {
    probe.min.set(x - RADIUS, y + 0.02, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - 0.02, z + RADIUS);
    for (const c of colliders) if (probe.intersectsBox(c)) return true;
    return false;
  }

  function look(dx, dy, sensitivity = 0.0022) {
    p.yaw -= dx * sensitivity;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    p.pitch = Math.min(1.45, p.pitch + pitchKick);
    p.yaw += yawKick;
  }

  function step(dt, keys) {
    const crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (crouching && !p.crouching) {
      p.crouching = true;
      p.height = CROUCH_HEIGHT;
    } else if (!crouching && p.crouching && !overlaps(p.position.x, p.position.y, p.position.z, STAND_HEIGHT)) {
      p.crouching = false;
      p.height = STAND_HEIGHT;
    }
    const eyeTarget = p.crouching ? CROUCH_EYE : STAND_EYE;
    p.eye += (eyeTarget - p.eye) * Math.min(1, dt * 12);

    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(p.yaw);
      const cos = Math.cos(p.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }
    const speed = p.crouching ? CROUCH_SPEED : WALK_SPEED;
    const blend = Math.min(1, (p.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
    p.velocity.x += (wish.x * speed - p.velocity.x) * blend;
    p.velocity.z += (wish.z * speed - p.velocity.z) * blend;
    if (p.onGround && !wish.lengthSq()) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      p.velocity.x *= damp;
      p.velocity.z *= damp;
    }
    if (keys.has('Space') && p.onGround) {
      p.velocity.y = JUMP_SPEED;
      p.onGround = false;
    }
    p.velocity.y -= GRAVITY * dt;
    const before = p.position.y;
    slideMove(colliders, p.position, p.velocity, dt, RADIUS, p.height);
    // Ground snap: standing on a collider top counts as on the ground.
    p.onGround = false;
    if (p.velocity.y <= 0) {
      probe.min.set(p.position.x - RADIUS, p.position.y - 0.06, p.position.z - RADIUS);
      probe.max.set(p.position.x + RADIUS, p.position.y + 0.05, p.position.z + RADIUS);
      for (const c of colliders) {
        if (probe.intersectsBox(c) && c.max.y <= p.position.y + 0.06) {
          p.position.y = c.max.y;
          p.velocity.y = 0;
          p.onGround = true;
          break;
        }
      }
    }
    if (p.position.y < 0) {
      p.position.y = 0;
      p.velocity.y = 0;
      p.onGround = true;
    }
    if (before === p.position.y && p.velocity.y === 0 && p.onGround) p.velocity.y = 0;
    p.velocity.y = Math.max(-30, p.velocity.y);
  }

  function reset(startPos, yaw) {
    p.position.copy(startPos);
    p.velocity.set(0, 0, 0);
    p.yaw = yaw;
    p.pitch = 0;
    p.eye = STAND_EYE;
    p.crouching = false;
    p.height = STAND_HEIGHT;
    p.onGround = true;
  }

  return {
    state: p,
    step,
    look,
    recoil,
    reset,
    groundSpeed() {
      return Math.hypot(p.velocity.x, p.velocity.z);
    },
    eyePos(out) {
      out.set(p.position.x, p.position.y + p.eye, p.position.z);
      return out;
    },
  };
}
