// Rendering setup only: renderer, camera, dusk lighting, skybox. The
// simulation never touches these; main.js renders the scene the modules build.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { mulberry32 } from './util.js';

export function createRender() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.canvas);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 24, 62);
  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
  scene.add(camera);

  // Dusk skybox: a vertex-coloured dome — ember orange at the horizon, dusk
  // purple mid-sky, deep indigo at the zenith, warmest toward the low sun in
  // the west — plus the sun disc, its halo and a few early stars. All
  // fog-free so the haze never swallows the sky.
  const skyGeo = new THREE.SphereGeometry(120, 32, 18);
  const skyPos = skyGeo.attributes.position;
  const skyCol = new Float32Array(skyPos.count * 3);
  const cHorizon = new THREE.Color('#ff8a3c');
  const cMid = new THREE.Color('#5a3040');
  const cZenith = new THREE.Color('#14101f');
  const cGround = new THREE.Color('#1a120c');
  const cWarm = new THREE.Color('#ffb066');
  const sunDir = new THREE.Vector3(-22, 11, 6).normalize();
  const v = new THREE.Vector3();
  const tmp = new THREE.Color();
  for (let i = 0; i < skyPos.count; i += 1) {
    v.fromBufferAttribute(skyPos, i).normalize();
    const h = v.y;
    if (h >= 0) {
      tmp.copy(cHorizon).lerp(cMid, Math.min(1, h * 2.2));
      tmp.lerp(cZenith, Math.max(0, h - 0.45) / 0.55);
    } else {
      tmp.copy(cHorizon).lerp(cGround, Math.min(1, -h * 3));
    }
    const warmth = Math.pow(Math.max(0, v.dot(sunDir)), 3) * (1 - Math.max(0, h));
    tmp.lerp(cWarm, Math.min(0.55, warmth));
    skyCol[i * 3] = tmp.r;
    skyCol[i * 3 + 1] = tmp.g;
    skyCol[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  skyDome.renderOrder = -1;
  scene.add(skyDome);

  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(5, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0'), fog: false }));
  sunDisc.position.set(-108, 12, 30);
  sunDisc.lookAt(0, 2, 0);
  scene.add(sunDisc);
  const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff7a1a'), transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
    }));
  sunHalo.position.set(-110, 12, 30.5);
  sunHalo.lookAt(0, 2, 0);
  scene.add(sunHalo);

  const starRnd = mulberry32(7);
  const starCount = 140;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const a = starRnd() * Math.PI * 2;
    const y = 10 + starRnd() * 100;
    const r = Math.sqrt(Math.max(0, 115 * 115 - y * y));
    starPos[i * 3] = Math.cos(a) * r;
    starPos[i * 3 + 1] = y;
    starPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: new THREE.Color('#f0e6d4'), size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.7, fog: false, depthWrite: false,
  }));
  scene.add(stars);

  // Dusk: warm low sun from the west, cool sky fill, faint ember bounce from below.
  const sky = new THREE.HemisphereLight(new THREE.Color('#9a8a70'), new THREE.Color('#1a120c'), 0.9);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ff9a4d'), 3.0);
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
  // Warm hearth glow over the mid corridor, so the middle of the yard never
  // reads flat black.
  const hearth = new THREE.PointLight(new THREE.Color('#ff7a1a'), 9, 15, 1.8);
  hearth.position.set(0, 3.4, 0);
  scene.add(hearth);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
