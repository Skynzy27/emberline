// Procedural textures for Cinder Yard, painted on canvas at load time — no
// image files, no downloads, nothing over the network. Every texture uses a
// fixed seed (mulberry32) so the yard looks identical on every run.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function makeTexture(size, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ground: dark asphalt/concrete, speckle, jagged cracks, glowing ember seams
// where the yard's heat bleeds through, oil stains, painted lane guides.
export function groundTexture() {
  return makeTexture(512, (g, s) => {
    const rnd = mulberry32(1337);
    g.fillStyle = '#241d16';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i += 1) {
      const v = 28 + rnd() * 26;
      g.fillStyle = `rgb(${v | 0},${(v * 0.9) | 0},${(v * 0.72) | 0})`;
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
    // Oil stains: soft dark blobs.
    for (let i = 0; i < 9; i += 1) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 18 + rnd() * 42;
      const grad = g.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, 'rgba(8,6,4,0.5)');
      grad.addColorStop(1, 'rgba(8,6,4,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // Cracks: jagged dark polylines.
    g.strokeStyle = 'rgba(10,7,5,0.85)';
    for (let i = 0; i < 9; i += 1) {
      g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath();
      let x = rnd() * s;
      let y = rnd() * s;
      g.moveTo(x, y);
      for (let j = 0; j < 7; j += 1) {
        x += (rnd() - 0.5) * 90;
        y += (rnd() - 0.5) * 90;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Ember seams: a hot orange line glowing out of a crack.
    for (let i = 0; i < 3; i += 1) {
      let x = 60 + rnd() * (s - 120);
      let y = 60 + rnd() * (s - 120);
      const pts = [[x, y]];
      for (let j = 0; j < 6; j += 1) {
        x += (rnd() - 0.5) * 70;
        y += (rnd() - 0.5) * 70;
        pts.push([x, y]);
      }
      g.strokeStyle = 'rgba(255,122,26,0.9)';
      g.lineWidth = 2;
      g.shadowColor = '#ff7a1a';
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) g.lineTo(px, py);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,214,140,0.95)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) g.lineTo(px, py);
      g.stroke();
    }
    // Painted lane guides: amber dashes down mid, teal dashes to the sites.
    g.fillStyle = '#d9a441';
    for (let y = 30; y < s; y += 44) g.fillRect(252, y, 8, 24);
    g.fillStyle = '#5b8a8a';
    for (let x = 30; x < 250; x += 44) g.fillRect(x, 60, 24, 8);
    for (let x = 280; x < 500; x += 44) g.fillRect(x, 60, 24, 8);
    // Hazard border at both sites.
    g.fillStyle = '#ff7a1a';
    for (let i = 0; i < 8; i += 1) {
      g.fillRect(28 + i * 14, 440, 7, 40);
      g.fillRect(452 - i * 14, 440, 7, 40);
    }
  }, 2, 2);
}

// Walls: poured-concrete panels with seams, rivets, grime streaks and a rust
// wash near the base.
export function wallTexture() {
  return makeTexture(256, (g, s) => {
    const rnd = mulberry32(4242);
    g.fillStyle = '#2b241c';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i += 1) {
      const v = 34 + rnd() * 22;
      g.fillStyle = `rgb(${v | 0},${(v * 0.88) | 0},${(v * 0.7) | 0})`;
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
    // Panel seams.
    g.strokeStyle = 'rgba(12,9,6,0.8)';
    g.lineWidth = 2;
    for (let x = 0; x <= s; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, s);
      g.stroke();
    }
    for (let y = 0; y <= s; y += 128) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(s, y);
      g.stroke();
    }
    // Rivets along the seams.
    g.fillStyle = 'rgba(210,190,160,0.5)';
    for (let x = 32; x < s; x += 64) {
      for (let y = 16; y < s; y += 64) {
        g.beginPath();
        g.arc(x, y, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Grime streaks running down from the top.
    for (let i = 0; i < 14; i += 1) {
      const x = rnd() * s;
      const len = 30 + rnd() * 90;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(10,8,5,0.45)');
      grad.addColorStop(1, 'rgba(10,8,5,0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 3 + rnd() * 5, len);
    }
    // Rust wash near the base.
    const rust = g.createLinearGradient(0, s * 0.72, 0, s);
    rust.addColorStop(0, 'rgba(140,70,25,0)');
    rust.addColorStop(1, 'rgba(140,70,25,0.35)');
    g.fillStyle = rust;
    g.fillRect(0, s * 0.72, s, s * 0.28);
  }, 6, 1);
}

// Containers: corrugated steel — vertical ribs, rust streaks, top/bottom rails.
export function containerTexture(base = '#3d3428') {
  return makeTexture(256, (g, s) => {
    const rnd = mulberry32(777);
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      g.fillStyle = shade(base, 1.28);
      g.fillRect(x, 0, 5, s);
      g.fillStyle = shade(base, 0.62);
      g.fillRect(x + 8, 0, 5, s);
      g.fillStyle = 'rgba(255,240,210,0.10)';
      g.fillRect(x + 5, 0, 2, s);
    }
    // Rust streaks bleeding down from the top rail.
    for (let i = 0; i < 12; i += 1) {
      const x = rnd() * s;
      const len = 20 + rnd() * 80;
      g.fillStyle = `rgba(120,58,20,${0.12 + rnd() * 0.22})`;
      g.fillRect(x, 0, 2 + rnd() * 4, len);
    }
    // Top and bottom rails.
    g.fillStyle = shade(base, 0.55);
    g.fillRect(0, 0, s, 10);
    g.fillRect(0, s - 10, s, 10);
    g.fillStyle = 'rgba(217,164,65,0.85)';
    g.fillRect(0, s - 22, s, 4);
  }, 2, 1);
}

// Crates: wood planks with grain, gaps and nails, steel corner brackets.
export function crateTexture() {
  return makeTexture(256, (g, s) => {
    const rnd = mulberry32(2024);
    const plankH = s / 4;
    for (let p = 0; p < 4; p += 1) {
      const y = p * plankH;
      const tone = 0.9 + rnd() * 0.25;
      g.fillStyle = shade('#6d5136', tone);
      g.fillRect(0, y, s, plankH);
      // Grain: wavy dark lines along the plank.
      g.strokeStyle = 'rgba(40,26,14,0.55)';
      g.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        const gy = y + 4 + rnd() * (plankH - 8);
        g.beginPath();
        g.moveTo(0, gy);
        for (let x = 0; x <= s; x += 32) g.lineTo(x, gy + (rnd() - 0.5) * 5);
        g.stroke();
      }
      // Plank gap.
      g.fillStyle = 'rgba(16,10,6,0.9)';
      g.fillRect(0, y + plankH - 2, s, 2);
    }
    // Nails.
    g.fillStyle = 'rgba(30,28,26,0.9)';
    for (const x of [10, s - 10]) {
      for (let p = 0; p < 4; p += 1) {
        g.beginPath();
        g.arc(x, p * plankH + plankH / 2, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Steel corner brackets.
    g.strokeStyle = 'rgba(60,58,54,0.95)';
    g.lineWidth = 8;
    for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) {
      g.beginPath();
      g.moveTo(cx === 0 ? 0 : s - 26, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy === 0 ? 26 : s - 26);
      g.stroke();
    }
  }, 1, 1);
}

// Brushed vertical metal for the silo and furnace block.
export function metalTexture(base = '#453a2e') {
  return makeTexture(256, (g, s) => {
    const rnd = mulberry32(99);
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i += 1) {
      const x = rnd() * s;
      const tone = 0.75 + rnd() * 0.6;
      g.fillStyle = shade(base, tone);
      g.fillRect(x, 0, 1 + rnd() * 2, s);
    }
    // Weld lines.
    g.fillStyle = 'rgba(10,8,6,0.7)';
    for (let y = 0; y <= s; y += 85) g.fillRect(0, y, s, 2);
    // Heat tint near the bottom.
    const heat = g.createLinearGradient(0, s * 0.6, 0, s);
    heat.addColorStop(0, 'rgba(255,122,26,0)');
    heat.addColorStop(1, 'rgba(255,122,26,0.28)');
    g.fillStyle = heat;
    g.fillRect(0, s * 0.6, s, s * 0.4);
  }, 2, 1);
}
