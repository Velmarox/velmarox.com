// His skin sheet: one 1024 x 1024 picture that skins all of him, like a Minecraft skin.
// The top half wraps round his body; the bottom half holds his arms and legs, each laid out
// as its sides unrolled into a strip, plus its two end caps (a fist end and the shoulder end,
// or the hip end and the sole of the foot).
//
// The body and limbs keep the texture coordinates three.js gives them, squeezed into their
// own patch of the sheet (remapPart). The guide and the cut-out for painting are drawn from
// the same numbers, so they always match the model.

import * as THREE from '../../lib/three.module.js';

export const SHEET = 1024;
// Must match the body and limbs in render3d.js.
export const BODY_DETAIL = 1;
export const LIMB_SIDES = 5;

// Each patch, in pixels from the top left. Limbs are named for his own right and left.
const COL = 256;
const limb = (i) => ({
  side: { x: i * COL + 16, y: 560, w: 224, h: 224 },
  top: { x: i * COL + 24, y: 820, w: 96, h: 96 },
  bottom: { x: i * COL + 136, y: 820, w: 96, h: 96 },
});
export const PARTS = {
  body: { body: { x: 0, y: 0, w: SHEET, h: SHEET / 2 } },
  rightArm: limb(0),
  leftArm: limb(1),
  rightLeg: limb(2),
  leftLeg: limb(3),
};
// What each limb's caps are, top cap first (three.js builds cylinders with the top at +y).
export const CAP_NAMES = {
  rightArm: ['FIST', 'SHOULDER'], leftArm: ['FIST', 'SHOULDER'],
  rightLeg: ['HIP', 'FOOT'], leftLeg: ['HIP', 'FOOT'],
};
export const PART_LABELS = { rightArm: 'RIGHT ARM', leftArm: 'LEFT ARM', rightLeg: 'RIGHT LEG', leftLeg: 'LEFT LEG' };

// A texture coordinate (0-1, v up) inside a patch, as sheet coordinates. Textures are
// flipped, so v = 1 is the top of the patch.
const toSheet = (u, v, r) => [(r.x + u * r.w) / SHEET, 1 - (r.y + (1 - v) * r.h) / SHEET];

// Moves a body or limb geometry's texture coordinates into its patch. A cylinder's three
// groups are its side, its top cap, and its bottom cap.
export function remapPart(geometry, part) {
  const uv = geometry.attributes.uv;
  const patches = PARTS[part];
  if (part === 'body') {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ...toSheet(uv.getX(i), uv.getY(i), patches.body));
  } else {
    const order = [patches.side, patches.top, patches.bottom];
    const done = new Set();
    geometry.groups.forEach((group, g) => {
      for (let k = group.start; k < group.start + group.count; k++) {
        const i = geometry.index.getX(k);
        if (done.has(i)) continue;
        done.add(i);
        uv.setXY(i, ...toSheet(uv.getX(i), uv.getY(i), order[g]));
      }
    });
  }
  uv.needsUpdate = true;
  return geometry;
}

// The faces of every part as pixel triangles on the sheet, for the cut-out and the guide.
// The body's faces along his back run past the right edge and wrap round to the left.
export function sheetFaces() {
  const out = [];
  const add = (geometry, shift = 0) => {
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const count = index ? index.count : uv.count;
    for (let k = 0; k < count; k += 3) {
      out.push([0, 1, 2].map((j) => {
        const i = index ? index.getX(k + j) : k + j;
        return [uv.getX(i) * SHEET + shift, (1 - uv.getY(i)) * SHEET];
      }));
    }
  };
  const body = remapPart(new THREE.IcosahedronGeometry(0.5, BODY_DETAIL), 'body');
  add(body);
  add(body, -SHEET);
  for (const part of Object.keys(PARTS)) if (part !== 'body') add(remapPart(new THREE.CylinderGeometry(1, 1, 1, LIMB_SIDES), part));
  return out;
}

// The creases of every part as pixel line segments on the sheet: edges where two faces meet
// at an angle, plus the open rims. Diagonals splitting a flat face in two are left out, so a
// limb's side shows as its flat strips and each cap as one outline.
export function sheetEdges() {
  const out = [];
  const add = (geometry, shifts) => {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    const at = (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    // Rounded, and with -0 counted as 0, so the copies of a point where a cap or the body's
    // seam closes on itself are seen as one point.
    const n = (v) => (Math.round(v * 1e4) / 1e4 + 0).toFixed(4);
    const key = (p) => `${n(p.x)},${n(p.y)},${n(p.z)}`;
    const edges = new Map();
    for (let k = 0; k < count; k += 3) {
      const ids = [0, 1, 2].map((j) => (index ? index.getX(k + j) : k + j));
      const [a, b, c] = ids.map(at);
      const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      for (const [i, j] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
        const ka = key(at(i));
        const kb = key(at(j));
        const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (!edges.has(id)) edges.set(id, []);
        edges.get(id).push({ normal, seg: [[uv.getX(i), uv.getY(i)], [uv.getX(j), uv.getY(j)]] });
      }
    }
    for (const sides of edges.values()) {
      const crease = sides.length === 1 || sides[0].normal.dot(sides[1].normal) < 0.999;
      if (!crease) continue;
      for (const { seg } of sides) {
        for (const shift of shifts) out.push(seg.map(([u, v]) => [u * SHEET + shift, (1 - v) * SHEET]));
      }
    }
  };
  add(remapPart(new THREE.IcosahedronGeometry(0.5, BODY_DETAIL), 'body'), [0, -SHEET]);
  for (const part of Object.keys(PARTS)) if (part !== 'body') add(remapPart(new THREE.CylinderGeometry(1, 0.7, 1, LIMB_SIDES), part), [0]);
  return out;
}
