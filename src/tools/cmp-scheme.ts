/**
 * 临时比对工具：把生成器输出逐线与参考刀版 JSON 对齐比对
 * 用法：npx --yes tsx src/tools/cmp-scheme.ts <builderId> <scheme.json>
 */
import fs from 'node:fs';
import { REGISTRY } from '../engine/registry';
import { DEFAULT_PARAMS, BoxParams } from '../engine/params';
import { Entity } from '../engine/types';

const [boxId, jsonPath, basis] = process.argv.slice(2);
if (!boxId || !jsonPath) {
  console.log('用法: npx --yes tsx src/tools/cmp-scheme.ts <builderId> <scheme.json>');
  process.exit(1);
}

const box = REGISTRY.find((b) => b.id === boxId);
if (!box) {
  console.log(`未注册盒型 ${boxId}`);
  process.exit(1);
}

const ref = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const refEnts = ref.geometry.payload.entities as { type: string; lineType: string }[];

/** 从参考样版自带的参数表取尺寸与纸厚（内尺寸语义），缺省回退 400×300×100 / t=3 */
const rp = (ref.parameters ?? []) as { name: string; value: number; role: string | null }[];
const num = (role: string, fallback: number) => rp.find((x) => x.role === role)?.value ?? fallback;
const params: BoxParams = {
  ...DEFAULT_PARAMS,
  sizeType: basis === 'make' ? 'make' : 'inner',
  L: num('length', 400),
  W: num('width', 300),
  H: num('height', 100),
  t: num('thickness', 3),
};
console.log(`样版参数 L=${params.L} W=${params.W} H=${params.H} t=${params.t}`);
const mine = box.build(params);

type Seg = { x1: number; y1: number; x2: number; y2: number; cut: boolean };

const toSegs = (ents: Entity[]): Seg[] => {
  const out: Seg[] = [];
  const pt = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) });
  for (const e of ents) {
    if (e.kind === 'line') out.push({ x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, cut: e.layer === 'cut' });
    else if (e.kind === 'arc') {
      const n = 24;
      let prev = pt(e.c.x, e.c.y, e.r, e.a0);
      for (let i = 1; i <= n; i++) {
        const a = e.a0 + ((e.a1 - e.a0) * i) / n;
        const cur = pt(e.c.x, e.c.y, e.r, a);
        out.push({ x1: prev.x, y1: prev.y, x2: cur.x, y2: cur.y, cut: e.layer === 'cut' });
        prev = cur;
      }
    } else if (e.kind === 'circle') {
      const n = 32;
      let prev = pt(e.c.x, e.c.y, e.r, 0);
      for (let i = 1; i <= n; i++) {
        const cur = pt(e.c.x, e.c.y, e.r, (360 * i) / n);
        out.push({ x1: prev.x, y1: prev.y, x2: cur.x, y2: cur.y, cut: e.layer === 'cut' });
        prev = cur;
      }
    }
  }
  return out;
};

// 参考弧拆成多段
const refFine: Seg[] = [];
for (const e of refEnts) {
  if (e.type === 'arc') refFine.push(...toSegs([{ kind: 'arc', layer: e.lineType === 'CUT' ? 'cut' : 'crease', c: { x: e.cx, y: e.cy }, r: e.radius, a0: e.angleBeg, a1: e.angleEnd } as Entity]));
  else refFine.push({ x1: e.x0, y1: e.y0, x2: e.x1, y2: e.y1, cut: e.lineType === 'CUT' });
}
const mineSegs0 = toSegs(mine.entities);
// 参考与生成器的 y 朝向可能相反（盖部在 +y 或 -y），flipy=1 时把我们的输出绕 x 轴翻转再比
const flipy = process.argv[5] === '1';
const mineSegs = mineSegs0.map((g) => (flipy ? { ...g, y1: -g.y1, y2: -g.y2 } : g));

const bb = (s: Seg[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of s) for (const [x, y] of [[g.x1, g.y1], [g.x2, g.y2]] as const) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
};
const a = bb(refFine), b = bb(mineSegs);
console.log('参考幅面', `${(a.maxX - a.minX).toFixed(2)} × ${(a.maxY - a.minY).toFixed(2)}`, 'mine', `${(b.maxX - b.minX).toFixed(2)} × ${(b.maxY - b.minY).toFixed(2)}`);
// 平移对齐（左上角重合）
const dx = a.minX - b.minX, dy = a.minY - b.minY;
console.log(`对齐平移 dx=${dx.toFixed(3)} dy=${dy.toFixed(3)}`);
const shifted = mineSegs.map((g) => ({ ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy }));

const dist = (px: number, py: number, g: Seg) => {
  const vx = g.x2 - g.x1, vy = g.y2 - g.y1;
  const wx = px - g.x1, wy = py - g.y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  return Math.hypot(px - (g.x1 + t * vx), py - (g.y1 + t * vy));
};

const sample = (list: Seg[]) => {
  const pts: { x: number; y: number; cut: boolean }[] = [];
  for (const g of list) {
    const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    const n = Math.max(2, Math.ceil(len / 0.5));
    for (let i = 0; i <= n; i++) pts.push({ x: g.x1 + ((g.x2 - g.x1) * i) / n, y: g.y1 + ((g.y2 - g.y1) * i) / n, cut: g.cut });
  }
  return pts;
};
const pr = sample(refFine), pm = sample(shifted);

const cover = (from: typeof pr, to: typeof pr) => {
  let worst = 0, sum = 0, bad = 0, badCut = 0, badCre = 0, sumCut = 0, nCut = 0, sumCre = 0, nCre = 0;
  for (const q of from) {
    let d = Infinity;
    for (const g of to) {
      if (g.cut !== q.cut) continue; // 切/压分层比对
      const dd = dist(q.x, q.y, g as Seg);
      if (dd < d) d = dd;
    }
    if (!isFinite(d)) d = 9999;
    worst = Math.max(worst, d);
    sum += d;
    if (d > 0.1) bad++;
    if (q.cut) { badCut += d > 0.1 ? 1 : 0; sumCut += d; nCut++; } else { badCre += d > 0.1 ? 1 : 0; sumCre += d; nCre++; }
  }
  return { worst, mean: sum / from.length, bad, badCut, badCre, meanCut: sumCut / nCut, meanCre: sumCre / nCre, nCut, nCre };
};

const rc = cover(pr, shifted), mc = cover(pm, refFine);
console.log(`参考→我  max=${rc.worst.toFixed(3)} mean=${rc.mean.toFixed(3)} cutMean=${rc.meanCut.toFixed(3)} creaseMean=${rc.meanCre.toFixed(3)} 超差=${rc.bad}/${pr.length} (cut ${rc.badCut}, crease ${rc.badCre})`);
console.log(`我→参考 max=${mc.worst.toFixed(3)} mean=${mc.mean.toFixed(3)} 超差=${mc.bad}/${pm.length} (cut ${mc.badCut}, crease ${mc.badCre})`);
console.log(`段数：参考 ${refFine.length}（${refEnts.length} 实体） vs 我 ${mineSegs.length}（${mine.entities.length} 实体）`);
console.log(`切线：参考 ${refFine.filter((g) => g.cut).length} vs 我 ${shifted.filter((g) => g.cut).length}；压痕：参考 ${refFine.filter((g) => !g.cut).length} vs 我 ${shifted.filter((g) => !g.cut).length}`);

/** 实体级定位：逐条找出对不上的一侧，便于列出待修清单 */
const perEnt = (label: string, ents: { kind: string }[], segsOf: (e: unknown, i: number) => Seg[], other: Seg[], off: { dx: number; dy: number }) => {
  const bad: string[] = [];
  ents.forEach((e, i) => {
    const gs = segsOf(e, i);
    let worst = 0;
    for (const q of sample(gs)) {
      let d = Infinity;
      for (const g of other) {
        if (g.cut !== q.cut) continue;
        d = Math.min(d, dist(q.x + off.dx, q.y + off.dy, g));
      }
      worst = Math.max(worst, isFinite(d) ? d : 9999);
    }
    if (worst > 0.1) bad.push(`  [${i}] max=${worst.toFixed(2)} ${JSON.stringify(e)}`);
  });
  console.log(`${label}：${bad.length}/${ents.length} 条对不上`);
  bad.slice(0, 40).forEach((s) => console.log(s));
};
const refEntOf = (e: { type: string; lineType: string }) =>
  e.type === 'arc'
    ? ({ kind: 'arc', layer: e.lineType === 'CUT' ? 'cut' : 'crease', c: { x: e.cx, y: e.cy }, r: e.radius, a0: e.angleBeg, a1: e.angleEnd } as Entity)
    : ({ kind: 'line', layer: e.lineType === 'CUT' ? 'cut' : 'crease', a: { x: e.x0, y: e.y0 }, b: { x: e.x1, y: e.y1 } } as Entity);
perEnt('参考未覆盖', refEnts as { type: string }[], (_e, i) => toSegs([refEntOf(refEnts[i] as never)]), shifted, { dx: 0, dy: 0 });
perEnt('我多出', mine.entities, (_e, i) => toSegs([mine.entities[i]]).map((g) => (flipy ? { ...g, y1: -g.y1, y2: -g.y2 } : g)), refFine, { dx, dy });

