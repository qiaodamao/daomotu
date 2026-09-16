/** 调试：成型后各面板世界包围盒（0201） */
import * as THREE from 'three';
import { fefco0201 } from '../engine/builders/fefco0201';
import { DEFAULT_PARAMS } from '../engine/params';
import { buildPanelTreeObject, applyFold } from '../render/render3d';

const result = fefco0201.build(DEFAULT_PARAMS);
const model = buildPanelTreeObject(result.panels);
applyFold(model, 1);
model.root.updateMatrixWorld(true);

const total = new THREE.Box3().setFromObject(model.root);
console.log('成型总包围盒:', total.min.toArray().map((v) => v.toFixed(0)).join(','), '→', total.max.toArray().map((v) => v.toFixed(0)).join(','));

// 主体 4 壁 + 糊口
for (const { mesh, node } of model.entries) {
  if (/^col|^glue$/.test(node.id)) {
    const b = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
    mesh.updateMatrixWorld(true);
    b.applyMatrix4(mesh.matrixWorld);
    const s = b.getSize(new THREE.Vector3());
    console.log(
      `${node.id.padEnd(6)} x∈[${b.min.x.toFixed(0)},${b.max.x.toFixed(0)}] y∈[${b.min.y.toFixed(0)},${b.max.y.toFixed(0)}] z∈[${b.min.z.toFixed(0)},${b.max.z.toFixed(0)}] size=${s.x.toFixed(0)}x${s.y.toFixed(0)}x${s.z.toFixed(0)}`
    );
  }
}
