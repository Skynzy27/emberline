// EMBERLINE look plan, in one place. Dusk in an industrial yard: warm ember orange
// against cold steel teal, on dark slate. The same names are the CSS custom
// properties in index.html, so the HUD and the 3D scene share one palette.
export const PALETTE = {
  canvas: '#17120d', // dusk sky / ground haze
  surface: '#262019', // concrete, containers
  hairline: '#453a2e', // trim, crate edges
  ink: '#f0e6d4', // HUD text, lamp light
  muted: '#a89a83', // secondary text, dust
  accent: '#ff7a1a', // ember orange: site A, tracers, the charge
  cool: '#5b8a8a', // steel teal: site B, Warden armour
  gold: '#d9a441', // hazard paint, money
  danger: '#e5484d', // damage flash, defuse alarm
};

export function hex(name) {
  return PALETTE[name];
}
