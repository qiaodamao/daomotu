/** 临时：检查折叠动画中间帧是否有面板穿地（min y 显著为负＝地面以下） */
import * as THREE from 'three';
import fs from 'node:fs';
import { presentoirBox } from '../src/engine/builders/presentoirBox';
import { buildPanelTreeObject, applyFold } from '../src/render/render3d';

const params = { sizeType: 'inner' as const, L: 300, W: 220, H: 100, material: 'BC', t: 6, glueFlap: 8, flapGap: 0, tongue: 102, winW: 276, winH: 44, handleW: 130 };
const r = presentoirBox.build(params);
const model = buildPanelTreeObject(r.panels);
const out: string[] = [];
for (const fold of [0, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
  applyFold(model, fold);
  model.root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(model.root);
  out.push(`fold ${fold.toFixed(2)}  x ${(b.max.x - b.min.x).toFixed(0)}  y ${(b.max.y - b.min.y).toFixed(0)}  z ${(b.max.z - b.min.z).toFixed(0)}  minY ${b.min.y.toFixed(1)}`);
}
fs.writeFileSync('scratch/foldseq.txt', out.join('\n'));
console.log('ok');
