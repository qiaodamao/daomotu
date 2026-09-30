/**
 * 校验：所有盒型成型后是否落在地面网格中心（闭合态包围盒中心 x/z ≈ 0）
 * 跑法：npx tsx src/tools/verify-3d-center.ts
 * 新盒型加进 REGISTRY 后跑一遍，row 里 off=FAIL 说明 builder 画图原点没对齐或居中失效
 */
import * as THREE from 'three';
import { REGISTRY, boxDefaults } from '../engine/registry';
import { buildPanelTreeObject, centerOnGrid, foldedBox } from '../render/render3d';

let bad = 0;
for (const b of REGISTRY) {
  const model = buildPanelTreeObject(b.build(boxDefaults(b.id)).panels);
  centerOnGrid(model);
  const box = foldedBox(model);
  const c = box.getCenter(new THREE.Vector3());
  const ok = Math.abs(c.x) < 1 && Math.abs(c.z) < 1 && Math.abs(box.min.y) < 1;
  if (!ok) bad++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${b.id.padEnd(20)} cx=${Math.round(c.x)} cz=${Math.round(c.z)} minY=${Math.round(box.min.y)}`,
  );
}
console.log(`${bad === 0 ? 'ALL PASS' : bad + ' OFF-CENTER'} / ${REGISTRY.length}`);
