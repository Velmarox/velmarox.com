// Pictures of every weapon for the menus, drawn once from the real models: guns side-on,
// melee weapons from above.

import * as THREE from '../../lib/three.module.js';
import { loadGunModels, gunMesh } from './gunModels.js';

export async function makeGunIcons() {
  const models = await loadGunModels();
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 128, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7090, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 4);
  scene.add(sun);
  const icons = {};
  for (const id of Object.keys(models)) {
    const gun = gunMesh(models, id);
    // Melee weapons lie flat in the game, so their picture is taken from above.
    if (models[id].melee) gun.rotation.x = Math.PI / 2;
    const box = new THREE.Box3().setFromObject(gun);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    gun.position.sub(centre);
    scene.add(gun);
    // Every gun fills the picture's width, with a little room round it.
    const half = Math.max(size.x / 2, size.y) * 1.08;
    const camera = new THREE.OrthographicCamera(-half, half, half / 2, -half / 2, 0.1, 20);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    icons[id] = canvas.toDataURL('image/png');
    scene.remove(gun);
  }
  renderer.dispose();
  return icons;
}
