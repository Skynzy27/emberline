// Cinder Yard minimap: a 2D canvas overlay, top-down. Walls and cover read as
// blocks, the two sites as rings with letters, the player as an orange arrow,
// Wardens as teal dots, and the charge as an orange dot on its carrier or a
// blinking red square once planted. Pure DOM canvas — it never touches the
// simulation, main.js just pushes the live state in every frame.
import { PALETTE } from './palette.js';

const MIN_X = -18.6;
const MAX_X = 18.6;
const MIN_Z = -14.6;
const MAX_Z = 14.6;

const KIND_COLORS = {
  wall: '#5a5142',
  container: '#7a6435',
  crate: '#8a744a',
  platform: '#3a342a',
  block: '#6b5c46',
  silo: '#5b8a8a',
  barrel: '#8a6a2a',
};

export function createMinimap(canvas, layout, sites) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const pad = 8;
  const sx = (W - pad * 2) / (MAX_X - MIN_X);
  const sz = (H - pad * 2) / (MAX_Z - MIN_Z);
  const scale = Math.min(sx, sz);
  const ox = pad + ((W - pad * 2) - (MAX_X - MIN_X) * scale) / 2;
  const oy = pad + ((H - pad * 2) - (MAX_Z - MIN_Z) * scale) / 2;
  const px = (x) => ox + (x - MIN_X) * scale;
  const py = (z) => oy + (z - MIN_Z) * scale;

  function drawRect(x, z, w, d, color) {
    ctx.fillStyle = color;
    ctx.fillRect(px(x - w / 2), py(z - d / 2), Math.max(1.5, w * scale), Math.max(1.5, d * scale));
  }

  return {
    update(state, player, bots, time) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(18,14,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      // Cover blocks.
      for (const r of layout) drawRect(r.x, r.z, r.w, r.d, KIND_COLORS[r.kind] || '#4a4034');
      // Site rings + letters.
      for (const site of Object.values(sites)) {
        const cx = px(site.pos.x);
        const cy = py(site.pos.z);
        ctx.strokeStyle = site.id === 'A' ? PALETTE.accent : PALETTE.cool;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.7 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = site.id === 'A' ? PALETTE.accent : PALETTE.cool;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(site.id, cx, cy);
      }
      // Planted charge: blinking red square.
      if (state.bomb.state === 'planted' && state.bomb.pos && Math.sin(time * 10) > -0.2) {
        const bx = px(state.bomb.pos.x);
        const by = py(state.bomb.pos.z);
        ctx.fillStyle = PALETTE.danger;
        ctx.fillRect(bx - 4, by - 4, 8, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 4, by - 4, 8, 8);
      }
      // Wardens: teal dots; the defuser gets a red ring.
      for (const bot of bots) {
        if (!bot.alive) continue;
        const bx = px(bot.group.position.x);
        const by = py(bot.group.position.z);
        ctx.fillStyle = PALETTE.cool;
        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        ctx.fill();
        if (bot.state === 'defuse') {
          ctx.strokeStyle = PALETTE.danger;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // Player: orange arrow pointing along the view yaw.
      const p = player.state;
      const cx = px(p.position.x);
      const cy = py(p.position.z);
      const angle = Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = PALETTE.accent;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Charge on the carrier: small orange dot trailing the arrow.
      if (state.player.hasBomb && state.bomb.state === 'carried') {
        ctx.fillStyle = PALETTE.accent;
        ctx.beginPath();
        ctx.arc(cx - Math.cos(angle) * 9, cy - Math.sin(angle) * 9, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a120c';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },
  };
}
