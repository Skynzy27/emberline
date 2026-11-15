// Rendering setup only: renderer, camera, dusk lighting. The simulation never
// touches these; main.js renders the scene the modules build.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createRender() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.canvas);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 24, 62);
  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
  scene.add(camera);

  // Dusk: warm low sun from the west, cool sky fill, faint ember bounce from below.
  const sky = new THREE.HemisphereLight(new THREE.Color('#8a7a66'), new THREE.Color('#1a120c'), 0.85);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb066'), 2.4);
  sun.position.set(-22, 11, 6);
  sun.target.position.set(4, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5b8a8a'), 0.5);
  fill.position.set(14, 10, 12);
  scene.add(fill);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
