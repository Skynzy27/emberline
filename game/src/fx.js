// Pooled visual effects: tracers and explosion bursts. Pools are created once;
// nothing is allocated per shot, so the hot loop stays garbage-free.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACERS = 14;
const BURSTS = 6;

export function createFx(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0 });
  const tracers = [];
  for (let i = 0; i < TRACERS; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, tracerMat.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const bursts = [];
  for (let i = 0; i < BURSTS; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.visible = false;
    scene.add(mesh);
    const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 9, 1.6);
    scene.add(light);
    bursts.push({ mesh, light, life: 0 });
  }
  let tracerIndex = 0;
  let burstIndex = 0;

  return {
    tracer(from, to, color) {
      const t = tracers[tracerIndex];
      tracerIndex = (tracerIndex + 1) % TRACERS;
      const pos = t.line.geometry.attributes.position;
      pos.setXYZ(0, from.x, from.y, from.z);
      pos.setXYZ(1, to.x, to.y, to.z);
      pos.needsUpdate = true;
      t.line.material.color.set(color);
      t.line.material.opacity = 0.9;
      t.line.visible = true;
      t.life = 0.09;
    },
    burst(pos, color, scale = 1) {
      const b = bursts[burstIndex];
      burstIndex = (burstIndex + 1) % BURSTS;
      b.mesh.position.copy(pos);
      b.mesh.material.color.set(color);
      b.mesh.scale.setScalar(0.3 * scale);
      b.mesh.visible = true;
      b.light.position.copy(pos);
      b.light.intensity = 40 * scale;
      b.life = 0.45;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
      for (const b of bursts) {
        if (b.life <= 0) continue;
        b.life -= dt;
        const k = Math.max(0, b.life / 0.45);
        b.mesh.scale.setScalar((1 - k) * 3.2 + 0.3);
        b.mesh.material.opacity = k * 0.75;
        b.light.intensity = k * 40;
        if (b.life <= 0) {
          b.mesh.visible = false;
          b.light.intensity = 0;
        }
      }
    },
  };
}
