// The gun models: read once from models/guns.bin (written by tools/extract-guns.mjs) and
// shared by every copy. Each gun is built facing +x with its grip down, sized so the
// pistol is a bit under half the guy's width and the big guns are long without being silly.

import * as THREE from '../../lib/three.module.js';

const SHORTEST = 1.26;   // the pistol's length in the pack
const PISTOL_SIZE = 0.46; // its length in the game, in metres: small enough for his little hands

// Where the hand closes on each gun's handle, as a share of its length from the back.
// Read off the models by eye (tools/view/guns.html). The height is the top of the handle.
// A melee weapon is held at its handle, centred through its thickness.
const GRIP = {
  pistol: 0.22, revolver: 0.16, smg: 0.36, sawnoff: 0.14, pump: 0.27, spas: 0.13,
  rifle: 0.34, aug: 0.44, m60: 0.36, awm: 0.3, m79: 0.36, bazooka: 0.5,
  knife: 0.14, bat: 0.1, katana: 0.1, spear: 0.38, chainsaw: 0.2,
};
const GRIP_HEIGHT = 0.42;

let ready = null;

export function loadGunModels() {
  if (ready) return ready;
  ready = (async () => {
    const [manifest, buffer, palette] = await Promise.all([
      fetch(new URL('../../models/guns.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../../models/guns.bin', import.meta.url)).then((r) => r.arrayBuffer()),
      new THREE.TextureLoader().loadAsync(new URL('../../models/palette.png', import.meta.url).href),
    ]);
    palette.colorSpace = THREE.SRGBColorSpace;
    palette.flipY = false;
    palette.magFilter = THREE.NearestFilter;
    const paint = new THREE.MeshStandardMaterial({ map: palette, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const models = {};
    for (const [id, gun] of Object.entries(manifest.guns)) {
      const length = gun.max[0] - gun.min[0];
      // Long guns grow less than their real length, so a sniper rifle doesn't span the room.
      const scale = (PISTOL_SIZE * Math.sqrt(length / SHORTEST)) / length;
      const grip = { x: gun.min[0] + length * (GRIP[id] ?? 0.3), y: gun.min[1] + (gun.max[1] - gun.min[1]) * (gun.melee ? 0.5 : GRIP_HEIGHT) };
      const meshes = gun.parts.map((part) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.position, part.count * 3), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buffer, part.normal, part.count * 3), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buffer, part.uv, part.count * 2), 2));
        if (part.index !== null) geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, part.index, part.indexCount), 1));
        // The grip sits at the origin: that is where a hand holds it.
        geometry.translate(-grip.x, -grip.y, 0);
        geometry.scale(scale, scale, scale);
        return { geometry, material: part.material === 'glass' ? glass : paint };
      });
      const muzzle = new THREE.Vector3(...gun.muzzle).sub(new THREE.Vector3(grip.x, grip.y, 0)).multiplyScalar(scale);
      models[id] = { meshes, muzzle, length: length * scale, melee: gun.melee };
    }
    return models;
  })();
  return ready;
}

// A new copy of one weapon, ready to add to the scene. Shares the geometry. A rune tints
// the paint toward its colour and makes it glow a little, so an infused weapon stands out.
const tinted = new Map();
export function gunMesh(models, id, runeColor = null) {
  const group = new THREE.Group();
  for (const part of models[id].meshes) {
    let material = part.material;
    if (runeColor !== null) {
      const key = `${material.uuid}:${runeColor}`;
      if (!tinted.has(key)) {
        const m = material.clone();
        m.color = new THREE.Color(0xffffff).lerp(new THREE.Color(runeColor), 0.5);
        m.emissive = new THREE.Color(runeColor);
        m.emissiveIntensity = 0.35;
        tinted.set(key, m);
      }
      material = tinted.get(key);
    }
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.userData.muzzle = models[id].muzzle.clone();
  group.userData.length = models[id].length;
  return group;
}
