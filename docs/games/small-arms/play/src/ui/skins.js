// Skins: each character's colours and face are painted onto one flat picture that wraps
// round its ball body, the way a map wraps a globe. Nothing here is a separate model part.
//
// On the picture, the middle column is the front of the body, the top edge is the top of
// the head, and the bottom edge is underneath.

import * as THREE from '../../lib/three.module.js';

const W = 1024;
const H = 512;

function canvas() {
  const el = document.createElement('canvas');
  el.width = W;
  el.height = H;
  return { el, ctx: el.getContext('2d') };
}

function texture(el) {
  const map = new THREE.CanvasTexture(el);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

// turn: angle round the body from straight ahead. rise: angle up from the middle.
const px = (turn) => W * (0.5 + turn / (2 * Math.PI));
const py = (rise) => H * (0.5 - rise / Math.PI);

// The picture stretches sideways towards the top and bottom of a ball, so shapes are
// drawn wider there to come out round on the body.
function patch(ctx, turn, rise, size, color, { squash = 1, tilt = 0, wide = 1 } = {}) {
  ctx.save();
  ctx.translate(px(turn), py(rise));
  ctx.scale(1 / Math.cos(rise), 1);
  ctx.rotate(tilt);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, (size / (2 * Math.PI)) * W * wide, (size / Math.PI) * H * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(ctx, top, low) {
  const fill = ctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, top);
  fill.addColorStop(1, low);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);
}

// The player: peach by default, with shiny dark eyes, blush, and a small mouth. look is a
// skin from content/loot.js: its colours, or a painted picture (png) laid out like
// models/skins/skin-template.png, which replaces the whole thing.
export function guySkin(look = { top: '#f9bd9b', low: '#e08876', blush: 'rgba(245, 140, 150, 0.75)' }) {
  if (look.png) {
    const map = new THREE.TextureLoader().load(look.png);
    map.colorSpace = THREE.SRGBColorSpace;
    return { map };
  }
  const { el, ctx } = canvas();
  shade(ctx, look.top, look.low);
  const eye = look.eyes ?? '#2b1f30';
  for (const side of [-1, 1]) {
    patch(ctx, side * 0.72, 0.28, 0.13, look.blush, { squash: 0.7 });
    patch(ctx, side * 0.42, 0.5, 0.17, eye);
    patch(ctx, side * 0.42 - 0.05, 0.56, 0.06, '#ffffff');
    patch(ctx, side * 0.42 + 0.05, 0.44, 0.03, '#ffffff');
  }
  patch(ctx, 0, 0.3, 0.07, eye, { squash: 0.3 });
  return { map: texture(el) };
}

// The guide for painting a skin: the same picture size and layout, with the face drawn
// where it sits, and lines showing the front, sides, and back. For models/skins/.
export function skinTemplate() {
  const { el, ctx } = canvas();
  // Flat colours, so it's clear which parts are paint and which are guides.
  ctx.fillStyle = '#f9bd9b';
  ctx.fillRect(0, 0, W, H);
  for (const side of [-1, 1]) {
    patch(ctx, side * 0.72, 0.28, 0.13, '#f58c96', { squash: 0.7 });
    patch(ctx, side * 0.42, 0.5, 0.17, '#2b1f30');
    patch(ctx, side * 0.42 - 0.05, 0.56, 0.06, '#ffffff');
  }
  patch(ctx, 0, 0.3, 0.07, '#2b1f30', { squash: 0.3 });
  ctx.strokeStyle = 'rgba(40, 30, 60, 0.6)';
  ctx.fillStyle = 'rgba(40, 30, 60, 0.85)';
  ctx.lineWidth = 2;
  ctx.font = '20px monospace';
  // Checked on the model: the left quarter of the picture is his right side.
  for (const [turn, label] of [[-Math.PI, 'BACK'], [-Math.PI / 2, 'HIS RIGHT'], [0, 'FRONT (face)'], [Math.PI / 2, 'HIS LEFT'], [Math.PI, 'BACK']]) {
    const x = Math.min(W - 2, Math.max(2, px(turn)));
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.fillText(label, Math.min(W - 70, Math.max(6, x + 6)), 56);
  }
  for (const [rise, label] of [[Math.PI / 4, 'upper body'], [0, 'middle'], [-Math.PI / 4, 'lower body']]) {
    const y = py(rise);
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(label, 8, y - 6);
  }
  ctx.fillText('TOP of head (hidden under a hat)', 8, 24);
  ctx.fillText('UNDERNEATH', 8, H - 10);
  return el;
}

// Enemy types share one build and are told apart by size and colour. Size comes from the
// creature's radius in the fight; these are the colours.
export const LOOKS = {
  charger: { top: 0x77557c, low: 0x3f2c45, belly: 0xa33248, limb: 0xa33248, spike: 0x3a2440, eye: 0xff4a2a, core: 0xffd23f },
  spitter: { top: 0x8fae5a, low: 0x4f6b35, belly: 0xe2c044, limb: 0xe2c044, spike: 0x34451f, eye: 0xfff07a, core: 0xffffff },
  swarm:   { top: 0xf09a4a, low: 0xb85c28, belly: 0x7a2e1a, limb: 0x7a2e1a, spike: 0x4d1d10, eye: 0xfff3c4, core: 0xffffff },
  thrower: { top: 0x4f9fb8, low: 0x2a5d75, belly: 0xe8e2c8, limb: 0xe8e2c8, spike: 0x18384a, eye: 0xffb347, core: 0xfff1b8 },
  shell:   { top: 0x8792a8, low: 0x4a5266, belly: 0xd9c9a3, limb: 0xd9c9a3, spike: 0xf1ead8, eye: 0x6fe3ff, core: 0xffffff },
  bouncer: { top: 0xf06aa8, low: 0xb23a78, belly: 0xffd0e2, limb: 0xffd0e2, spike: 0x6e1f4a, eye: 0xffffff, core: 0x9af0ff },
  bigone:  { top: 0x3a2d47, low: 0x15101c, belly: 0xd9a441, limb: 0xd9a441, spike: 0xd9a441, eye: 0xff3b30, core: 0xffe08a },
};

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// An enemy: shaded body with a belly, slanted glowing eyes under heavy brows, and fangs.
export function creatureSkin(look) {
  const { el, ctx } = canvas();
  shade(ctx, hex(look.top), hex(look.low));
  // Belly: everything below a jagged line, so it follows the facets instead of a ruler.
  ctx.fillStyle = hex(look.belly);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let i = 0; i <= 20; i++) ctx.lineTo((i / 20) * W, py(-0.5) + (i % 2 ? -14 : 14));
  ctx.lineTo(W, H);
  ctx.fill();

  const glowLayer = canvas();
  glowLayer.ctx.fillStyle = '#000';
  glowLayer.ctx.fillRect(0, 0, W, H);
  for (const side of [-1, 1]) {
    const tilt = side * -0.38;
    for (const layer of [ctx, glowLayer.ctx]) {
      patch(layer, side * 0.4, 0.5, 0.2, hex(look.eye), { squash: 0.5, tilt });
      patch(layer, side * 0.4, 0.49, 0.1, hex(look.core), { squash: 0.5, tilt });
    }
    // The brow cuts across the top of the eye, which is what makes it a scowl.
    for (const layer of [ctx, glowLayer.ctx]) {
      patch(layer, side * 0.4, 0.62, 0.26, layer === ctx ? hex(look.spike) : '#000', { squash: 0.3, tilt });
    }
    // Fangs hang from the mouth line.
    ctx.fillStyle = '#fff3e6';
    ctx.beginPath();
    ctx.moveTo(px(side * 0.13) - 9, py(0.2));
    ctx.lineTo(px(side * 0.13) + 9, py(0.2));
    ctx.lineTo(px(side * 0.13), py(0.2) + 26);
    ctx.fill();
  }
  ctx.strokeStyle = hex(look.spike);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(px(-0.3), py(0.17));
  ctx.lineTo(px(0), py(0.22));
  ctx.lineTo(px(0.3), py(0.17));
  ctx.stroke();

  return { map: texture(el), emissiveMap: texture(glowLayer.el) };
}
