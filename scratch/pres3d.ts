/** 临时：逐面板顶点精确世界包围盒（避免 Box3.setFromObject 的 AABB 近似），检查折叠姿态 */
import * as THREE from 'three';
import fs from 'node:fs';
import { presentoirBox } from '../src/engine/builders/presentoirBox';
import { buildPanelTreeObject, applyFold, groundModel } from '../src/render/render3d';

const params = { sizeType: 'inner' as const, L: 300, W: 220, H: 100, material: 'BC', t: 6, glueFlap: 8, flapGap: 0, tongue: 102, winW: 276, winH: 44, handleW: 130 };
const r = presentoirBox.build(params);
const model = buildPanelTreeObject(r.panels);
applyFold(model, 1);
const box = groundModel(model);
const out: string[] = ['面板顶点精确世界包围盒  x=长 y=竖直 z=深 (mm)'];
const f = (v: number) => v.toFixed(1).padStart(7);
for (const { mesh, node } of model.entries) {
  const pos = (mesh.geometry as THREE.BufferGeometry).attributes.position;
  const tmp = new THREE.Vector3();
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(tmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  out.push(`${node.id.padEnd(8)} x[${f(b.min.x)},${f(b.max.x)}] y[${f(b.min.y)},${f(b.max.y)}] z[${f(b.min.z)},${f(b.max.z)}]`);
}
out.push(`整体 x ${(box.max.x - box.min.x).toFixed(1)}  y ${(box.max.y - box.min.y).toFixed(1)}  z ${(box.max.z - box.min.z).toFixed(1)}`);
fs.writeFileSync('scratch/pres3d.txt', out.join('\n'));
console.log('ok');
