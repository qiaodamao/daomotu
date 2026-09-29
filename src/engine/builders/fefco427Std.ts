/**
 * 0427 一体式飞机盒（标准瓦楞双层扣，免胶）
 *
 * 按参考刀版（FEFCO 0427，140 条线段）逐线参数化重画：
 * 底板（含 4 个锁槽）+ 前后壁 + 角翼（合拢成内侧壁）+ 侧壁双层扣（侧壁→条带→内壁→锁舌穿槽）
 * + 连体盖（盖侧耳内折锁紧）+ 端部花瓣插舌。
 *
 * 尺寸模型（内尺寸 L/B/H + 纸厚 t）：
 *   k = t/3（参考样版为 BC 双瓦 t=6 → k=2，工艺余量均按 k 线性缩放）
 *   L2 = L + 9k      前后壁宽           L1 = L2 + A    底板宽
 *   B1 = B + 7k      底板深             B2 = B + 10k   侧壁/盖深
 *   Hf = H + 2k      前后壁高            Hs = H + k     外侧壁高
 *   Hi = H - k       内壁高             dbw = 8k       条带宽
 *   T1 = 4k          锁舌凸出            e = 3k         花瓣折线内缩
 *   A / mth / Ra / H7 / R3 / R10 / 锁槽 / 各斜切角 = 固定设计值（不随尺寸缩放）
 */
import { BoxParams, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, Entity, Layer, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

/* ---------- 固定设计值（参考样版标定） ---------- */
const A = 20; // 锁槽宽 / 盖耳根部内缩
const MTH = 20; // 插舌端部收边
const RA = 20; // 花瓣小圆角半径
const H7 = 50; // 盖侧耳外伸
const R3 = 3; // 微圆角（亦为花瓣弧与舌端边的工艺间隙）
const R10 = 10; // 盖耳角圆角 / 插舌端部缺口
const SLOT = 33; // 锁槽长
const SLOT_OFF = 37; // 锁槽近盖端距底板边
const FLAP_DROP = 15; // 角翼外角下沉
const CREASE_GAP = 1; // 角翼折线端部与切线留空（避免刀锋重合）
const D30 = R3 * Math.cos(Math.PI / 6); // 微圆角圆心纵向偏移 2.598
const CHAMFER = 15; // 通用斜切角（盖耳修边、锁舌导向）
const PETAL_IN = 20; // 花瓣内缘线角度
const PETAL_OUT = 55; // 花瓣外缘线角度
const PETAL_END = 43.295; // 大弧起始角（参考样版标定）

const rad = (deg: number) => (deg * Math.PI) / 180;
const degOf = (v: number) => (v * 180) / Math.PI;
const norm = (a: number) => ((a % 360) + 360) % 360;
const ang = (c: P, p: P) => degOf(Math.atan2(p.y - c.y, p.x - c.x));

type P = { x: number; y: number };

/** 过点 lineP、方向角 ang 的直线 上，圆 (c,r) 的切点 */
function tangentPoint(lineP: P, ang: number, c: P, r: number): P {
  const n = { x: Math.sin(rad(ang)), y: -Math.cos(rad(ang)) };
  const D = (c.x - lineP.x) * n.x + (c.y - lineP.y) * n.y;
  return { x: c.x - D * n.x, y: c.y - D * n.y };
}

/** 自外点 q 向圆 (c,r) 作切线，取 x 较小的切点 */
function tangentFromPoint(c: P, r: number, q: P): P {
  const dx = q.x - c.x, dy = q.y - c.y;
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, r / d)));
  const cand = [1, -1].map((s) => {
    const a = base + s * off;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });
  return cand[0].x < cand[1].x ? cand[0] : cand[1];
}

/** 两直线（过 pi、方向角 angi）各沿法向偏移 offi 后的交点 */
function offsetIntersect(p1: P, ang1: number, off1: number, p2: P, ang2: number, off2: number): P {
  const d1 = { x: Math.cos(rad(ang1)), y: Math.sin(rad(ang1)) };
  const n1 = { x: Math.sin(rad(ang1)), y: -Math.cos(rad(ang1)) };
  const d2 = { x: Math.cos(rad(ang2)), y: Math.sin(rad(ang2)) };
  const n2 = { x: Math.sin(rad(ang2)), y: -Math.cos(rad(ang2)) };
  const a1 = { x: p1.x + off1 * n1.x, y: p1.y + off1 * n1.y };
  const a2 = { x: p2.x + off2 * n2.x, y: p2.y + off2 * n2.y };
  const det = -d1.x * d2.y + d2.x * d1.y;
  const t = -(a2.x - a1.x) * d2.y + d2.x * (a2.y - a1.y);
  return { x: a1.x + (t / det) * d1.x, y: a1.y + (t / det) * d1.y };
}

/** 弧实体：构造空间角 a0→a1（度，递增扫掠）；奇数次反射时扫掠反向，起点改取原终点 */
function arcOut(c: EntCollector, layer: Layer, cx: number, cy: number, r: number, a0: number, a1: number, sx: 1 | -1, sy: 1 | -1) {
  let span = a1 - a0;
  if (span < 0) span += 360;
  const mcx = r3(cx * sx) || 0;
  const mcy = r3(cy * sy) || 0;
  const pt = (a: number) => ({ x: (cx + r * Math.cos(rad(a))) * sx, y: (cy + r * Math.sin(rad(a))) * sy });
  const start = sx * sy < 0 ? pt(a1) : pt(a0);
  const from = norm(degOf(Math.atan2(start.y - mcy, start.x - mcx)));
  c.entities.push({ kind: 'arc', layer, c: { x: mcx, y: mcy }, r: r3(r), a0: r3(from), a1: r3(from + span) });
}

/** 弧上采样点（3D 轮廓用，度数区间） */
function arcPts(c: P, r: number, a0: number, a1: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push([r3(c.x + r * Math.cos(a)), r3(c.y + r * Math.sin(a))]);
  }
  return out;
}

const fields: FieldSpec[] = COMMON_FIELDS.filter((f) =>
  f.key === 'sizeType' || f.key === 'L' || f.key === 'W' || f.key === 'H' || f.key === 'material' || f.key === 't'
);

export const fefco427Std = {
  id: 'fefco-427-std',
  name: '一体式飞机盒（免胶双层扣）',
  category: '快递 / 电商',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    // 刀版以内容尺寸为基准（余量链已含内→制造换算）
    const L = make.l - p.t, B = make.w - p.t, H = Math.max(make.h - 2 * p.t, 10);
    const k = p.t / 3;

    const L2 = L + 9 * k, L1 = L2 + A;
    const B1 = B + 7 * k, B2 = B + 10 * k, B4 = B;
    const Hf = H + 2 * k, Hs = H + k, Hi = Math.max(H - k, 5);
    const dbw = 8 * k, T1 = 4 * k, e = 3 * k;

    // 关键坐标（基准 = 底板中心，y 向下）
    const x199 = L1 / 2 - A, x209 = L2 / 2, x213 = L1 / 2 - e, x219 = L1 / 2;
    const x321 = x219 + Hs, x337 = x321 + dbw, x435 = x337 + Hi, x443 = x435 + T1;
    // 盖耳外伸：样版为固定 50mm，盒体矮于样版时收到壁高以内（否则成型后耳穿底、盒被顶离地面）
    const earOut = Math.max(2 * R10, Math.min(H7, Hf - 2 * k));
    const x249 = x199 + earOut, x366 = x209 + B1 / 2;
    const y157 = B1 / 2, y160 = B2 / 2, y150 = B4 / 2, y261 = y157 + Hf;
    const lidY0 = y261 + k, lidY1 = lidY0 + B2, lidC = (lidY0 + lidY1) / 2;
    const ear0 = lidC - (B2 / 2 - R10), ear1 = lidC + (B2 / 2 - R10);
    const tuck = lidY1 + H, petalTop = lidY1 + 2 * k, petalEnd = tuck - R3;
    const slotT = y157 - SLOT_OFF, slotB = slotT - SLOT;
    const taper = T1 * Math.tan(rad(CHAMFER));
    const tabT = slotT - taper, tabB = slotB + taper;

    // 盖耳：CHAMFER 修边线 + R10 圆角
    const m = Math.tan(rad(CHAMFER));
    const earCy = ear0 + m * (x249 - R10 - x199) + R10 * Math.hypot(1, m);
    const earUpC = { x: x249 - R10, y: earCy };
    const earTangUp = tangentPoint({ x: x199, y: ear0 }, CHAMFER, earUpC, R10);
    const earCyDn = 2 * lidC - earCy;
    const earDnC = { x: x249 - R10, y: earCyDn };
    const earTangDn = { x: earTangUp.x, y: 2 * lidC - earTangUp.y };

    // 角翼：R3 圆角 + 切线到翼尖
    const filC = { x: x321 + R3, y: y160 + D30 };
    const flapTip = { x: x366, y: y160 + FLAP_DROP };
    const filTan = tangentFromPoint(filC, R3, flapTip);

    // 花瓣插舌：PETAL_IN 斜线 + Ra 圆角 + PETAL_OUT 斜线 + 大弧 R=(H-R3)
    const petalC = { x: x213, y: lidY1 };
    const petalR = H - R3;
    const petalE = { x: petalC.x + petalR * Math.cos(rad(PETAL_END)), y: petalC.y + petalR * Math.sin(rad(PETAL_END)) };
    const petalP = { x: x213, y: petalTop };
    const raC = offsetIntersect(petalP, PETAL_IN, -RA, petalE, -PETAL_OUT, RA);
    const raT1 = tangentPoint(petalP, PETAL_IN, raC, RA);
    const raT2 = tangentPoint(petalE, -PETAL_OUT, raC, RA);

    const c = new EntCollector();
    const line = (layer: Layer, x1: number, y1: number, x2: number, y2: number, sx: 1 | -1, sy: 1 | -1) =>
      c.line(layer, x1 * sx, y1 * sy, x2 * sx, y2 * sy);

    /* ---------- 十字区（四象限同构） ---------- */
    for (const sx of [1, -1] as const) {
      for (const sy of [1, -1] as const) {
        // 前后壁：底板折线 + 壁顶切线 + 角翼折线
        line('crease', x209, y157, 0, y157, sx, sy);
        line('crease', x209, y157, x209, y261 - CREASE_GAP, sx, sy);
        line('cut', x219, y160, x209, y157, sx, sy);
        line('cut', x209, y261, x366, y261, sx, sy);
        // 角翼轮廓（翼尖竖边 + 切线 + R3 圆角）
        line('cut', x366, flapTip.y, x366, y261, sx, sy);
        line('cut', filTan.x, filTan.y, flapTip.x, flapTip.y, sx, sy);
        line('cut', x321, y160, x321, filC.y, sx, sy);
        arcOut(c, 'cut', filC.x, filC.y, R3, ang(filC, filTan), 180, sx, sy);
        // 侧壁（顶边 + 根折线）
        line('cut', x219, y160, x321, y160, sx, sy);
        line('crease', x321, y160, x321, 0, sx, sy);
        // 条带 + 内壁（侧壁顶→条带→内壁自由边）
        line('cut', x337, y150, x321, y160, sx, sy);
        line('crease', x337, y150, x337, 0, sx, sy);
        line('cut', x435, y150, x337, y150, sx, sy);
        line('cut', x435, slotT, x435, y150, sx, sy);
        line('cut', x435, slotB, x435, 0, sx, sy);
        // 锁舌（两侧 CHAMFER 导向斜切）
        line('cut', x435, slotT, x443, tabT, sx, sy);
        line('cut', x443, tabT, x443, tabB, sx, sy);
        line('cut', x435, slotB, x443, tabB, sx, sy);
        // 底板↔侧壁折线（锁槽段断开）+ 锁槽四边
        line('crease', x219, slotT, x219, y160, sx, sy);
        line('crease', x219, slotB, x219, 0, sx, sy);
        line('cut', x219, slotT, x219, slotB, sx, sy);
        line('cut', x219, slotB, x199, slotB, sx, sy);
        line('cut', x219, slotT, x199, slotT, sx, sy);
        line('cut', x199, slotT, x199, slotB, sx, sy);
        // 前壁顶边（靠盖一侧由盖面连体，不画）
        if (sy < 0) line('cut', 0, y261, x209, y261, sx, sy);
      }
    }

    /* ---------- 连体盖 + 盖侧耳 + 花瓣插舌 ---------- */
    for (const sx of [1, -1] as const) {
      // 盖折线（根 / 端）与外缘、耳根
      line('crease', x199, lidY0, 0, lidY0, sx, 1);
      line('crease', x199, lidY1, 0, lidY1, sx, 1);
      line('cut', x199, lidY0, x199, ear0, sx, 1);
      line('crease', x199, ear0, x199, ear1, sx, 1);
      line('cut', x199, ear1, x199, lidY1, sx, 1);
      line('cut', x199, lidY1, x199, petalTop, sx, 1);
      line('cut', x199, petalTop, x213, petalTop, sx, 1);
      line('cut', x199, lidY0, x209, y261, sx, 1);
      // 盖侧耳：CHAMFER 修边 + R10 圆角 + 外直边
      line('cut', x199, ear0, earTangUp.x, earTangUp.y, sx, 1);
      line('cut', x249, earCy, x249, earCyDn, sx, 1);
      line('cut', x199, ear1, earTangDn.x, earTangDn.y, sx, 1);
      arcOut(c, 'cut', earUpC.x, earUpC.y, R10, ang(earUpC, earTangUp), 0, sx, 1);
      arcOut(c, 'cut', earDnC.x, earDnC.y, R10, 0, ang(earDnC, earTangDn), sx, 1);
      // 插舌：花瓣折线 + 舌端边 + 端部缺口
      line('crease', x213, petalTop, x213, petalEnd, sx, 1);
      line('cut', x213, tuck, x213, petalEnd, sx, 1);
      line('cut', x213, tuck, MTH / 2, tuck, sx, 1);
      arcOut(c, 'cut', 0, tuck, R10, 270, 360, sx, 1);
      // 花瓣轮廓
      line('cut', petalP.x, petalP.y, raT1.x, raT1.y, sx, 1);
      line('cut', petalE.x, petalE.y, raT2.x, raT2.y, sx, 1);
      arcOut(c, 'cut', raC.x, raC.y, RA, ang(raC, raT1), ang(raC, raT2), sx, 1);
      arcOut(c, 'cut', petalC.x, petalC.y, petalR, PETAL_END, 90, sx, 1);
    }

    /* ---------- 3D 面板树（根 = 底板，全程平躺贴地） ---------- */
    const PV = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [r3(x), r3(y)] as [number, number]);
    const rect = (x0: number, y0: number, x1: number, y1: number) => PV([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    const mirX = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [r3(-x), y] as [number, number]);
    const node = (
      id: string,
      poly: [number, number][],
      hinge: { kind: 'v' | 'h'; at: number; sign: 1 | -1 },
      phase: number,
      finalDeg: number,
      children: PanelNode[] = []
    ): PanelNode => ({ id, poly, hinge, phase, finalDeg, children });

    const tabPoly = (sx: 1 | -1) => PV([[x435 * sx, slotB], [x443 * sx, tabB], [x443 * sx, tabT], [x435 * sx, slotT]]);
    const lockTab = (sx: 1 | -1) =>
      node(`lock${sx > 0 ? 'R' : 'L'}`, tabPoly(sx), { kind: 'v', at: sx * x435, sign: sx > 0 ? -1 : 1 }, 0.32, 60);
    const innerWall = (sx: 1 | -1) =>
      node(`inner${sx > 0 ? 'R' : 'L'}`, sx > 0 ? rect(x337, -y150, x435, y150) : mirX(rect(x337, -y150, x435, y150)),
        { kind: 'v', at: sx * x337, sign: sx > 0 ? -1 : 1 }, 0.24, 90, [lockTab(sx)]);
    const strap = (sx: 1 | -1) =>
      node(`strap${sx > 0 ? 'R' : 'L'}`, sx > 0 ? rect(x321, -y150, x337, y150) : mirX(rect(x321, -y150, x337, y150)),
        { kind: 'v', at: sx * x321, sign: sx > 0 ? -1 : 1 }, 0.16, 90, [innerWall(sx)]);
    const sideWall = (sx: 1 | -1) =>
      node(`side${sx > 0 ? 'R' : 'L'}`, sx > 0 ? rect(x219, -y160, x321, y160) : mirX(rect(x219, -y160, x321, y160)),
        { kind: 'v', at: sx * x219, sign: sx > 0 ? -1 : 1 }, 0.02, 90, [strap(sx)]);

    // 角翼（挂前后壁侧缘，合拢成内侧壁）
    const cornerFlap = (sx: 1 | -1, sy: 1 | -1) =>
      node(`corner${sx > 0 ? 'R' : 'L'}${sy > 0 ? 'B' : 'F'}`,
        sx > 0 ? rect(x209, sy * y157, x366, sy * y261) : mirX(rect(x209, sy * y157, x366, sy * y261)),
        { kind: 'v', at: sx * x209, sign: sx > 0 ? -1 : 1 }, 0.1, 90);

    // 花瓣（插舌两侧内折锁紧片，轮廓含 Ra 圆角弧与大弧）
    const petalPoly = PV([
      [x213, petalTop], [raT1.x, raT1.y],
      ...arcPts(raC, RA, ang(raC, raT1), ang(raC, raT2), 7),
      [raT2.x, raT2.y], [petalE.x, petalE.y],
      ...arcPts(petalC, petalR, PETAL_END, 90, 9),
      [x213, petalEnd],
    ]);
    const petal = (sx: 1 | -1) =>
      node(`petal${sx > 0 ? 'R' : 'L'}`, sx > 0 ? petalPoly : mirX(petalPoly),
        { kind: 'v', at: sx * x213, sign: sx > 0 ? -1 : 1 }, 0.66, 90);
    const tuckFlap = node('tuck', rect(-x213, lidY1, x213, tuck), { kind: 'h', at: lidY1, sign: -1 }, 0.56, 90, [
      petal(1), petal(-1),
    ]);
    const earPoly = rect(x199, ear0, x249, ear1);
    const lid = node('lid', rect(-x199, lidY0, x199, lidY1), { kind: 'h', at: lidY0, sign: -1 }, 0.4, 90, [
      node('earR', earPoly, { kind: 'v', at: x199, sign: -1 }, 0.5, 90),
      node('earL', mirX(earPoly), { kind: 'v', at: -x199, sign: 1 }, 0.5, 90),
      tuckFlap,
    ]);

    const frontWall = node('wallF', rect(-x209, -y261, x209, -y157), { kind: 'h', at: -y157, sign: 1 }, 0.02, 90, [
      cornerFlap(1, -1), cornerFlap(-1, -1),
    ]);
    const backWall = node('wallB', rect(-x209, y157, x209, y261), { kind: 'h', at: y157, sign: -1 }, 0.02, 90, [
      cornerFlap(1, 1), cornerFlap(-1, 1), lid,
    ]);

    // 底板锁槽（4 处，锁舌穿出处）
    const slotHole = (sx: 1 | -1, sy: 1 | -1): [number, number][] =>
      PV([[sx * x199, sy * slotB], [sx * x219, sy * slotB], [sx * x219, sy * slotT], [sx * x199, sy * slotT]]);

    const base: PanelNode = {
      id: 'base',
      poly: rect(-x219, -y157, x219, y157),
      holes: [slotHole(1, 1), slotHole(1, -1), slotHole(-1, 1), slotHole(-1, -1)],
      children: [frontWall, backWall, sideWall(1), sideWall(-1)],
    };

    const bb = bbox(c.entities);
    const warnings: string[] = [];
    if (p.t < 2 || p.t > 8) warnings.push('本盒型工艺余量按瓦楞纸板标定，建议纸厚 2~8mm');
    if (Hi < 20) warnings.push('内壁高 < 20mm，双层扣结构难以成型');
    if (slotB < 0) warnings.push('盒深过小，底板锁槽已越出边缘');
    if (H > B) warnings.push('盒高大于盒深，端部花瓣插舌会穿出对面内壁（本盒型适用于扁平面快递盒）');
    if (H7 > x366 - x249) warnings.push('盖侧耳外伸过大，可能与角翼干涉');
    warnings.push('免胶双层扣：锁舌需穿过底板锁槽，请确认模切精度');

    return {
      entities: c.entities,
      panels: [base],
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: ((bb.max.x - bb.min.x) * (bb.max.y - bb.min.y)) / 1e6,
        warnings,
      },
    };
  },
};
