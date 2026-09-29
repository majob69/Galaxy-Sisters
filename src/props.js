// Small shared prop builders
import * as THREE from 'three';

// A treasure chest whose lid opens by rotating lidPivot.rotation.x (about -1.9 = open)
export function createChest(scale = 1) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a5b34, flatShading: true });
  const gold = new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.0), wood);
  body.position.y = 0.43;
  body.castShadow = true;
  group.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 1.06), gold);
  band.position.y = 0.6;
  group.add(band);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.86, -0.5);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; // half cylinder lying along X, round side up
  lid.position.set(0, 0, 0.5);
  lidPivot.add(lid);
  group.add(lidPivot);
  group.scale.setScalar(scale);
  return { group, lidPivot };
}

// Emoji drawn on a canvas as a texture (for sprites and altar symbols)
export function emojiTexture(emoji, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.font = `${Math.round(size * 0.72)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size * 0.56);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
