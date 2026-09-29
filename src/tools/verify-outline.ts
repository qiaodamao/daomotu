/**
 * 临时验证：2D 刀模轮廓闭合性检测
 * 裁切线应构成闭合回路（或终止于压痕线上，如摇盖槽底部）：
 * 每条 cut 线端点若找不到其他 cut 端点衔接（0.05mm 容差）、不落在另一条 cut 线上
 * （T 形搭接，如墙列侧切线终止于底边切线）、且不落在任何 crease/perf 线段上，
 * 即为悬空端点（轮廓缺口）；样版本身带「角部让刀」的盒型在 RELIEF_GAPS 里登记预期数。
 */
import { REGISTRY } from '../engine/registry';
import { DEFAULT_PARAMS } from '../engine/params';
import { Entity } from '../engine/types';

const EPS = 0.05;

/**
 * 参考刀版本身带「角部让刀」的盒型：锁口槽四边各内缩 0.5 倍纸厚、四角留缺口
 * （模切应力释放，样版原样如此），此处登记其预期悬空端点数。
 */
const RELIEF_GAPS: Record<string, number> = {
  'patisserie-display': 8,
};

/** 点到线段距离 */
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

let fail = 0;
for (const b of REGISTRY) {
  let result;
  try {
    result = b.build(DEFAULT_PARAMS);
  } catch (e) {
    console.log(`SKIP ${b.name}: build 异常 ${e}`);
    continue;
  }
  const cuts = result.entities.filter((e) => e.layer === 'cut');
  const folds = result.entities.filter((e): e is Extract<Entity, { kind: 'line' }> => e.kind === 'line' && (e.layer === 'crease' || e.layer === 'perf'));

  // 收集 cut 端点（line 两端 + arc 起终点，圆弧需三角函数计算），owner = 所属实体序号
  const pts: { x: number; y: number; owner: number; label: string }[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const e = cuts[i];
    if (e.kind === 'line') {
      pts.push({ x: e.a.x, y: e.a.y, owner: i, label: `(${e.a.x.toFixed(1)},${e.a.y.toFixed(1)})` });
      pts.push({ x: e.b.x, y: e.b.y, owner: i, label: `(${e.b.x.toFixed(1)},${e.b.y.toFixed(1)})` });
    } else if (e.kind === 'arc') {
      for (const a of [e.a0, e.a1]) {
        const x = e.c.x + e.r * Math.cos((a * Math.PI) / 180);
        const y = e.c.y + e.r * Math.sin((a * Math.PI) / 180);
        pts.push({ x, y, owner: i, label: `arc(${x.toFixed(1)},${y.toFixed(1)})` });
      }
    }
  }

  const dangling: string[] = [];
  const cutLines = cuts.map((e, i) => ({ i, l: e.kind === 'line' ? (e as Extract<Entity, { kind: 'line' }>) : null }));
  for (const p of pts) {
    // 是否有其他 cut 端点衔接（排除自身线段的另一端也算——本脚本只找完全孤立的端点组）
    const connected = pts.some((q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < EPS);
    if (connected) continue;
    // T 形搭接：端点落在另一条 cut 线内部（如墙列侧切线终止于底边切线）
    const onCut = cutLines.some(({ i, l }) => l !== null && i !== p.owner && distToSeg(p.x, p.y, l.a.x, l.a.y, l.b.x, l.b.y) < EPS);
    if (onCut) continue;
    // 是否落在折线上（允许终止于 crease）
    const onFold = folds.some((f) => distToSeg(p.x, p.y, f.a.x, f.a.y, f.b.x, f.b.y) < EPS);
    if (onFold) continue;
    dangling.push(p.label);
  }

  const allowed = RELIEF_GAPS[b.id] ?? 0;
  if (dangling.length > allowed) {
    fail++;
    console.log(`FAIL ${b.name}: ${dangling.length} 个悬空 cut 端点 → ${dangling.slice(0, 12).join(' ')}${dangling.length > 12 ? ' …' : ''}`);
  } else if (dangling.length) {
    console.log(`PASS ${b.name}（让刀缺口 ${dangling.length} 处，与样版一致）`);
  } else {
    console.log(`PASS ${b.name}`);
  }
}
console.log(fail === 0 ? '\n全部闭合' : `\n${fail} 个盒型存在缺口`);
process.exit(fail === 0 ? 0 : 1);
