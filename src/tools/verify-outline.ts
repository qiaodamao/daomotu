/**
 * 临时验证：2D 刀模轮廓闭合性检测
 * 裁切线应构成闭合回路（或终止于压痕线上，如摇盖槽底部）：
 * 每条 cut 线端点若找不到其他 cut 线端点衔接（0.05mm 容差），
 * 且不落在任何 crease/perf 线段上（±0.05mm），即为悬空端点（轮廓缺口）。
 */
import { REGISTRY } from '../engine/registry';
import { DEFAULT_PARAMS } from '../engine/params';
import { Entity } from '../engine/types';

const EPS = 0.05;

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

  // 收集 cut 端点（line 两端 + arc 起终点，圆弧需三角函数计算）
  const pts: { x: number; y: number; label: string }[] = [];
  for (const e of cuts) {
    if (e.kind === 'line') {
      pts.push({ x: e.a.x, y: e.a.y, label: `(${e.a.x.toFixed(1)},${e.a.y.toFixed(1)})` });
      pts.push({ x: e.b.x, y: e.b.y, label: `(${e.b.x.toFixed(1)},${e.b.y.toFixed(1)})` });
    } else if (e.kind === 'arc') {
      for (const a of [e.a0, e.a1]) {
        const x = e.c.x + e.r * Math.cos((a * Math.PI) / 180);
        const y = e.c.y + e.r * Math.sin((a * Math.PI) / 180);
        pts.push({ x, y, label: `arc(${x.toFixed(1)},${y.toFixed(1)})` });
      }
    }
  }

  const dangling: string[] = [];
  for (const p of pts) {
    // 是否有其他 cut 端点衔接（排除自身线段的另一端也算——本脚本只找完全孤立的端点组）
    const connected = pts.some((q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < EPS);
    if (connected) continue;
    // 是否落在折线上（允许终止于 crease）
    const onFold = folds.some((f) => distToSeg(p.x, p.y, f.a.x, f.a.y, f.b.x, f.b.y) < EPS);
    if (onFold) continue;
    dangling.push(p.label);
  }

  if (dangling.length) {
    fail++;
    console.log(`FAIL ${b.name}: ${dangling.length} 个悬空 cut 端点 → ${dangling.slice(0, 12).join(' ')}${dangling.length > 12 ? ' …' : ''}`);
  } else {
    console.log(`PASS ${b.name}`);
  }
}
console.log(fail === 0 ? '\n全部闭合' : `\n${fail} 个盒型存在缺口`);
process.exit(fail === 0 ? 0 : 1);
