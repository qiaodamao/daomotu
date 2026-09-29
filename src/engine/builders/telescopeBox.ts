/**
 * 套盖箱（Telescope，底盒 + 盖盒两片式）
 *
 * 结构：两只独立的四摇盖围框套合。
 *   底盒：底部四片半叠摇盖交叉闭合，上口敞开（无盖翼，壁高 = H）
 *   盖盒：顶部四片半叠摇盖闭合，下端敞开，套在底盒外壁上（盖深 = lidH）
 * 盖制造尺寸 = 底制造尺寸 + 3t + 单边间隙（盖内空需让过底盒两壁 + 纸厚）
 *
 * 与天地盖（box-lid）的区别：天地盖是「全底板 + 防尘翼 + 锁舌」的精细礼盒口盖，
 * 本盒型是瓦楞外箱用的摇盖围框套合，承压/堆码更高，常用于搬家箱、家具、重型件。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds, translateEntities, translatePanels } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'lidH', label: '盖深', type: 'number', unit: 'mm', min: 10, max: 500, group: '工艺参数' },
  { key: 'clearance', label: '盖单边间隙', type: 'number', unit: 'mm', min: 0, max: 5, step: 0.1, group: '工艺参数' },
];

export const telescopeBox = {
  id: 'telescope-box',
  name: '套盖箱（两片式天地盖）',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const t = p.t;
    const base = toMakeSize(p);
    const Fin = base.w / 2; // 半叠对口摇盖（四片均 W/2，交叉成缝）

    // 盖内空罩住底盒外壁：盖制造 = 底制造 + 3t + 间隙
    const lidL = base.l + 3 * t + p.clearance;
    const lidW = base.w + 3 * t + p.clearance;
    const lidH = Math.max(p.lidH, 10);
    const lidFin = lidW / 2;
    const gap = 20; // 两片在展开图上的间距

    const b = tubeWithEnds({
      L: base.l,
      W: base.w,
      H: base.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'none' }, // 上口敞开，由盖盒罩住
      bottom: { type: 'rockets', F: Fin, slot: p.slot },
    });
    const l = tubeWithEnds({
      L: lidL,
      W: lidW,
      H: lidH,
      g: p.glueFlap,
      ch: Math.min(p.chamfer, lidH / 2),
      top: { type: 'rockets', F: lidFin, slot: p.slot },
      bottom: { type: 'none' }, // 下口敞开，套入底盒
    });

    const entities = [...b.entities, ...translateEntities(l.entities, b.TW + gap, 0)];
    const panels = [...b.panels, ...translatePanels(l.panels, b.TW + gap, 0)];
    const bb = bbox(entities);

    const warnings = [...commonWarnings(p, base)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    if (p.clearance < 0.3) warnings.push('盖间隙 < 0.3mm，套合可能过紧');
    if (lidH < 30) warnings.push('盖深 < 30mm，套合抓持不足，易脱盖');
    if (lidH >= base.h) warnings.push('盖深 ≥ 底盒高，盖将罩到底边（接近全高套，请确认是否需要）');
    warnings.push('底盒上口与盖盒下口均为敞开围框，对口缝需胶带封合');

    return {
      entities,
      panels,
      meta: {
        makeSize: base,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (b.TW * b.TH + l.TW * l.TH) / 1e6,
        flaps: { f1: Fin, f2: lidFin },
        warnings,
      },
    };
  },
};
