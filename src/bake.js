// ==========================================
// STATIC MESH BAKING: collapse decorative groups into one mesh per material
// (hundreds of planks/posts/petals -> a handful of draw calls)
// ==========================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function bakeStaticGroup(group, { castShadow = true, receiveShadow = true } = {}) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse(obj => {
    if (!obj.isMesh) return;
    const geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    Object.keys(geo.attributes).forEach(name => {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    });
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    geo.applyMatrix4(obj.matrixWorld);
    if (!buckets.has(obj.material)) buckets.set(obj.material, []);
    buckets.get(obj.material).push(geo);
  });

  const baked = new THREE.Group();
  buckets.forEach((geos, material) => {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixAutoUpdate = false;
    baked.add(mesh);
  });
  return baked;
}

// Bake the static children of a group in place. Children that move, light up the scene or need
// their own attributes stay as they are: lights, sprites, points, vertex-coloured or custom-shader
// meshes, and whatever keep(child) returns true for.
export function bakeChildren(group, keep = () => false) {
  const special = (c) => {
    let found = false;
    c.traverse(o => {
      if (o.isLight || o.isSprite || o.isPoints || o.isLine) found = true;
      else if (o.isMesh && (Array.isArray(o.material) || o.material.vertexColors || o.material.isShaderMaterial || o.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile)) found = true;
    });
    return found;
  };
  const statics = new THREE.Group();
  [...group.children].forEach(c => { if (!keep(c) && !special(c)) statics.add(c); });
  if (statics.children.length) group.add(bakeStaticGroup(statics));
}
