/**
 * 半开槽套盖箱（HSC · Half Slotted Container）
 *
 * 两端不对称：
 *   底端 = 四片 W/2 摇盖对缝闭合（十字缝，同 0201 底）；
 *   顶端 = 前/后满宽双盖（深 W + 修正量，完全叠合盖满箱口）+ 左/右 W/2 防尘翼。
 *
 * 用法：做两只、其中一只倒扣即为套盖（天地）组合；盖子长宽需比盒身
 *   放大 ≈ (2~3)×纸厚 + 2mm 间隙后分别生成。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '盖翼加长', type: 'number', unit: 'mm', min: 0, max: 200, group: '工艺参数' },
];

export const hscBox = {
  id: 'hsc-box',
  name: '半开槽套盖箱（HSC）',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const Fin = make.w / 2; // 内摇盖 / 侧面防尘翼
    const Fout = make.w + p.flapGap; // 顶端满宽双盖（+ 修正量）

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      // 顶端满宽双盖错层稍大，避免 3D 共面
      top: { type: 'rockets', F: Fin, Fout, slot: p.slot, degStep: 1.6 },
      // 底端对缝四摇盖
      bottom: { type: 'rockets', F: Fin, Fout: Fin, slot: p.slot },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    if (p.flapGap >= make.w) warnings.push('盖翼加长 ≥ 盒宽，双盖将绕到箱底，请减小修正量');
    warnings.push('套盖用法：做两只、一只倒扣作盖；盖的长宽各放大 ≈ (2~3)×纸厚 + 2mm 后单独生成');

    return {
      entities,
      panels,
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (TW * TH) / 1e6,
        flaps: { f1: Fin, f2: Fout },
        warnings,
      },
    };
  },
};
