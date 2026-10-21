// The hats, built from a few flat-shaded shapes. Each sits on the crown of his head with its
// front facing +x, the way he faces. Sized for his 0.5 m body.

import * as THREE from '../../lib/three.module.js';

const flat = (color, extra) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.05, ...extra });

function part(geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// A dome that fits the top of his head.
const dome = (r, color) => part(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat(color), 0, -0.02, 0);

const BUILD = {
  cap(g) {
    g.add(dome(0.3, 0xe84848));
    // The brim sticks out the front.
    g.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10, 1, false, -Math.PI / 2, Math.PI), flat(0xb83030), 0.22, 0.0, 0));
    g.add(part(new THREE.SphereGeometry(0.04, 6, 4), flat(0xf8f8f8), 0, 0.29, 0));
  },
  hardhat(g) {
    g.add(dome(0.32, 0xf8c838));
    g.add(part(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 14), flat(0xe0a820), 0, -0.01, 0));
    g.add(part(new THREE.BoxGeometry(0.5, 0.05, 0.06), flat(0xe0a820), 0, 0.27, 0));
  },
  cowboy(g) {
    const brown = flat(0x8a5a30);
    g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 16), brown, 0, 0, 0));
    g.add(part(new THREE.CylinderGeometry(0.22, 0.26, 0.26, 10), brown, 0, 0.13, 0));
    g.add(part(new THREE.CylinderGeometry(0.265, 0.265, 0.05, 10), flat(0x3c2418), 0, 0.04, 0));
  },
  beanie(g) {
    g.add(dome(0.31, 0x38b8d8));
    g.add(part(new THREE.TorusGeometry(0.29, 0.045, 5, 14).rotateX(Math.PI / 2), flat(0x2a8ca8), 0, 0.01, 0));
    g.add(part(new THREE.IcosahedronGeometry(0.08, 1), flat(0xf8f8f8), 0, 0.33, 0));
  },
  party(g) {
    g.add(part(new THREE.ConeGeometry(0.2, 0.48, 10), flat(0xf06aa8), 0, 0.22, 0));
    g.add(part(new THREE.TorusGeometry(0.15, 0.03, 4, 10).rotateX(Math.PI / 2), flat(0xf8d030), 0, 0.12, 0));
    g.add(part(new THREE.IcosahedronGeometry(0.06, 1), flat(0xf8d030), 0, 0.48, 0));
  },
  crown(g) {
    const gold = flat(0xf8c838, { metalness: 0.6, roughness: 0.3, emissive: 0x403010, emissiveIntensity: 0.4 });
    g.add(part(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10, 1, true), gold, 0, 0.06, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(part(new THREE.ConeGeometry(0.05, 0.14, 4), gold, Math.cos(a) * 0.22, 0.19, Math.sin(a) * 0.22));
    }
    g.add(part(new THREE.OctahedronGeometry(0.045), flat(0xe0203c, { emissive: 0x600010 }), 0.24, 0.07, 0));
  },
  wizard(g) {
    const blue = flat(0x3a40b8);
    g.add(part(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 16), blue, 0, 0, 0));
    const tip = part(new THREE.ConeGeometry(0.24, 0.62, 10), blue, -0.04, 0.3, 0);
    tip.rotation.z = 0.22;
    g.add(tip);
    g.add(part(new THREE.OctahedronGeometry(0.05), flat(0xf8d030, { emissive: 0x806010 }), 0.18, 0.2, 0.08));
  },
  tophat(g) {
    const black = flat(0x2b1f30);
    g.add(part(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 16), black, 0, 0, 0));
    g.add(part(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 12), black, 0, 0.21, 0));
    g.add(part(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 12), flat(0xc2264b), 0, 0.06, 0));
  },
};

export function makeHat(id) {
  const group = new THREE.Group();
  BUILD[id]?.(group);
  return group;
}
