/**
 * 甜点展示盒（Patisserie / FEFCO F_0426 系）：一体式连盖 + 双折铰边 + 前翻展示片
 *
 * 尺寸基准：内尺寸 L×B×H，全部工艺余量为纸厚 t 的整数/半整数倍
 *   底板 (L+10t)×(B+9t)；侧墙（两端大翼）宽 H+4t；
 *   后墙高 H+4t、前墙高 H+3.5t、内衬片高 H+t、展示翻片 H+1.5t，
 *   双折铰边带 th = 6t（锁口槽 th×2th）、盖深 B+2t、端翼圆角 R = 5t、粘舌/内挡舌宽 mtl = 20t
 *   （样版 200×120×80 · t=2 → 幅面 388×625，逐线复现参考刀版最大偏差 0.067mm）
 *
 * 结构（原点 = 底板中心，y 向下）：
 *   横向：底板两侧各一张大翼（宽 H+4t）折成侧墙，大翼在 ±(B/2+4.5t) 处再折 90° 成盒口沿内撑
 *   纵向：后墙 → 双折铰边带（th，中部开锁口槽）→ 内衬片（+ 两枚粘舌）
 *         前墙 → 盖（两侧带 R 圆角端翼）→ 展示翻片（底角 R 圆角）
 *
 * 参考样版本身的不对称几何（按实测常量复现）：
 *   盖列整体右移 0.5t（左右缘 = -103/+105，铰边带上下斜接线自然得出 9/7 之差）；
 *   端翼端边距幅面边缘左 4t、右 7t；端翼两圆弧圆心半距 12.8t（中间直边长 25.6t）；
 *   端翼斜边 = 自盖顶角向圆弧（R=5t，圆心 (tip∓R, 盖带中线±12.8t)）所作的切线
 */
import { BoxParams, COMMON_FIELDS, FieldSpec, commonWarnings, toMakeSize } from '../params';
import { bbox, DielineResult, Layer, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

const rad = (d: number) => (d * Math.PI) / 180;

/** 弧上采样点（3D 轮廓用，度，a0→a1 线性插值） */
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n = 7): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    return [r3(cx + r * Math.cos(a)), r3(cy + r * Math.sin(a))] as [number, number];
  });

/** 自外点 q 向圆 (c,r) 的两条切线的切点 */
function tangents(c: { x: number; y: number }, r: number, q: { x: number; y: number }) {
  const base = Math.atan2(q.y - c.y, q.x - c.x);
  const off = Math.acos(Math.max(-1, Math.min(1, r / Math.hypot(q.x - c.x, q.y - c.y))));
  return [1, -1].map((s) => {
    const a = base + s * off;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });
}

const fields: FieldSpec[] = [
  ...COMMON_FIELDS.filter((f) => ['sizeType', 'L', 'W', 'H', 'material', 't'].includes(String(f.key))),
  { key: 'slot', label: '双折铰边带宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
  { key: 'lidH', label: '盖片深（0=自动）', type: 'number', unit: 'mm', min: 0, max: 400, group: '工艺参数' },
  { key: 'handleH', label: '内衬片高（0=自动）', type: 'number', unit: 'mm', min: 0, max: 300, group: '工艺参数' },
  { key: 'flapGap', label: '展示翻片加深', type: 'number', unit: 'mm', min: -30, max: 120, group: '工艺参数' },
  { key: 'handleW', label: '端翼伸出宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 200, group: '工艺参数' },
  { key: 'winH', label: '端翼直边高（0=自动）', type: 'number', unit: 'mm', min: 0, max: 200, group: '工艺参数' },
];

export const patisserieBox = {
  id: 'patisserie-display',
  name: '甜点展示盒（连盖双折铰边）',
  category: '展示 / 陈列',
  /** 参考刀版样版参数：200×120×80 · E 楞 t=2，幅面 388×625（工艺档位全部走自动公式） */
  sample: { sizeType: 'inner' as const, L: 200, W: 120, H: 80, material: 'E', t: 2, slot: 0, lidH: 0, handleH: 0, handleW: 0, winH: 0, flapGap: 0 },
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const L = make.l - p.t, B = make.w - p.t, H = Math.max(make.h - 2 * p.t, 20);
    const t = p.t;
    const hv = 0.5 * t; // 刀锋避让 / 盖列右移量
    const rf = 1.5 * t; // 小圆角、粘舌高
    const tabD = 2.5 * t; // 内挡舌深

    // ---- 工艺参数（0=自动） ----
    const th = p.slot > 0 ? Math.max(p.slot, 2 * t) : 6 * t; // 双折铰边带宽
    const lidD = p.lidH > 0 ? p.lidH : B + 2 * t; // 盖深
    const linerH = p.handleH > 0 ? p.handleH : H + t; // 内衬片高
    const flapD = Math.max(H + 1.5 * t + p.flapGap, 20); // 展示翻片深
    const R = 5 * t; // 端翼 / 翻片圆角
    const mtl = 20 * t; // 粘舌与内挡舌宽
    const hh = (p.winH > 0 ? Math.max(p.winH, 2 * R) : 25.6 * t) / 2; // 端翼圆弧圆心半距（直边 = 2hh）

    // ---- 派生坐标 ----
    const baseH = L / 2 + 5 * t; // 底板半宽
    const wallH = baseH + t; // 墙列半宽
    const earX = wallH + 2 * rf; // 翼端台阶竖边
    const lidH = L / 2 + 2 * t; // 盖列半宽
    const SH = baseH + H + 2 * t; // 幅面半宽
    const baseY = B / 2 + 4.5 * t; // 底板半高
    const wallY = baseY + t; // 墙脚半高
    const backTop = -(wallY + H + 4 * t); // 后墙顶 = 铰边下折线
    const bandTop = backTop - th; // 铰边上折线
    const linerTop = bandTop - linerH;
    const sheetTop = linerTop - rf;
    const wingTop = backTop - 10 * t; // 大翼顶（盒口沿）
    const frontBot = wallY + H + 3.5 * t; // 前墙底
    const lidTop = frontBot + hv; // 盖铰线
    const lidY0 = frontBot + t;
    const lidY1 = lidY0 + lidD;
    const lidMid = (lidY0 + lidY1) / 2;
    const flapCrease = lidY1 + t;
    const flapEnd = flapCrease + flapD;
    const flapStraight = flapEnd - R;
    const halfW = th / 2; // 锁口槽半宽
    const slotY0 = bandTop - halfW;
    const slotY1 = backTop + halfW;
    const tabC = B / 2 - rf; // 舌中心距
    const tabIn = tabC - mtl / 2;
    const tabOut = tabC + mtl / 2;
    /** 盖列左右缘（整体右移 hv ⇒ 左 -103 / 右 +105） */
    const lidE = (sx: number) => sx * (lidH + sx * hv);
    /** 端翼外边：自动 = 距幅面边缘左 4t / 右 7t */
    const tipX = (sx: number) => (p.handleW > 0 ? lidE(sx) + sx * p.handleW : sx * (SH - (sx > 0 ? 7 * t : 4 * t)));

    const c = new EntCollector();
    const line = (layer: Layer, x1: number, y1: number, x2: number, y2: number) => c.line(layer, x1, y1, x2, y2);
    const arc = (layer: Layer, cx: number, cy: number, r: number, a0: number, a1: number) =>
      c.entities.push({ kind: 'arc', layer, c: { x: r3(cx), y: r3(cy) }, r: r3(r), a0: r3(a0), a1: r3(a1) });
    const angOf = (cx: number, cy: number, x: number, y: number) => ((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 360) % 360;

    /** 端翼几何：圆弧半径 R、圆心 (tip - sx*R, lidMid ± hh)，自盖角点作切线定出斜边 */
    const earGeo = (sx: number) => {
      const le = lidE(sx);
      const tip = tipX(sx);
      const ecx = tip - sx * R;
      const mk = (syc: 1 | -1) => {
        const cy = lidMid + syc * hh;
        const cand = tangents({ x: ecx, y: cy }, R, { x: le, y: syc < 0 ? lidY0 : lidY1 }).sort((a, b) => a.y - b.y);
        const T = syc < 0 ? cand[0] : cand[1]; // 上斜边取上切点，下斜边取下切点
        return { cy, T, aT: angOf(ecx, cy, T.x, T.y) };
      };
      return { tip, ecx, up: mk(-1), dn: mk(1) };
    };
    /** 圆弧扫描区间（度，a0→a1 与参考样版同向递增） */
    const sweep = (aT: number, sx: number, syc: 1 | -1): [number, number] =>
      syc < 0 ? (sx > 0 ? [aT, 360] : [180, aT]) : sx > 0 ? [0, aT] : [aT, 180];


    /* ---------------- 中央共有线 ---------------- */
    line('crease', -wallH, wallY, wallH, wallY); // 前墙脚折线
    line('crease', -tabIn, -wallY, tabIn, -wallY); // 后墙脚折线（中段）
    line('cut', -tabIn, linerTop, tabIn, linerTop); // 内衬片顶边（中段）
    line('cut', -halfW + hv, slotY0, halfW - hv, slotY0);
    line('cut', -halfW + hv, slotY1, halfW - hv, slotY1);
    line('crease', lidE(-1), lidTop, lidE(1), lidTop); // 盖铰线
    line('crease', lidE(-1), flapCrease, lidE(1), flapCrease); // 翻片铰线
    line('cut', lidE(-1) + R, flapEnd, lidE(1) - R, flapEnd); // 翻片底边

    /* ---------------- 左右同构（含各自不对称量） ---------------- */
    for (const sx of [1, -1] as const) {
      const le = lidE(sx);
      // 内衬片粘舌
      line('cut', sx * tabOut, linerTop, sx * tabOut, sheetTop);
      line('cut', sx * tabIn, linerTop, sx * tabIn, sheetTop);
      line('cut', sx * tabIn, sheetTop, sx * tabOut, sheetTop);
      line('cut', le, linerTop, sx * tabOut, linerTop);
      line('cut', le, linerTop, le, bandTop); // 内衬片侧边
      // 双折铰边带
      line('crease', le, bandTop, sx * halfW, bandTop);
      line('cut', sx * wallH, backTop, le, bandTop); // 上下折线端斜接线
      line('crease', sx * wallH, backTop, sx * halfW, backTop);
      // 带端角：小切线 + 圆角 + 翼端台阶 + 大翼顶 + 幅面外缘
      line('cut', sx * (wallH + rf), backTop, sx * wallH, backTop);
      arc('cut', sx * (wallH + rf), backTop - rf, rf, sx > 0 ? 0 : 90, sx > 0 ? 90 : 180);
      line('cut', sx * earX, backTop - rf, sx * earX, wingTop);
      line('cut', sx * earX, wingTop, sx * SH, wingTop);
      line('cut', sx * SH, wingTop, sx * SH, frontBot);
      // 锁口槽竖边（被两条折线分成三段）
      line('cut', sx * halfW, slotY0 + hv, sx * halfW, bandTop);
      line('cut', sx * halfW, bandTop, sx * halfW, backTop);
      line('cut', sx * halfW, backTop, sx * halfW, slotY1 - hv);
      // 底板 ↔ 墙
      line('crease', sx * baseH, -baseY, sx * baseH, baseY);
      line('cut', sx * wallH, -wallY, sx * baseH, -baseY); // 45° 斜接
      line('cut', sx * baseH, baseY, sx * wallH, wallY);
      line('cut', sx * wallH, backTop, sx * wallH, -wallY); // 墙列侧切线
      line('cut', sx * wallH, wallY, sx * wallH, frontBot);
      // 大翼（侧墙 + 上下内撑）
      line('crease', sx * baseH, -baseY, sx * SH, -baseY);
      line('crease', sx * baseH, baseY, sx * SH, baseY);
      line('cut', sx * SH, frontBot, le, frontBot);
      // 后墙脚内挡舌
      line('crease', sx * wallH, -wallY, sx * tabOut, -wallY);
      line('cut', sx * tabOut, -wallY, sx * tabIn, -wallY);
      line('cut', sx * tabIn, -wallY, sx * tabIn, -wallY + tabD);
      line('cut', sx * tabOut, -wallY, sx * tabOut, -wallY + tabD);
      line('cut', sx * tabIn, -wallY + tabD, sx * tabOut, -wallY + tabD);
      // 盖面：端翼铰线 + 桥接
      line('crease', le, lidY0, le, lidY1);
      line('cut', le, frontBot, le, lidY0);
      line('cut', le, lidY1, le, flapCrease);
      // 展示翻片
      line('cut', le, flapCrease, le, flapStraight);
      arc('cut', le - sx * R, flapStraight, R, sx > 0 ? 0 : 90, sx > 0 ? 90 : 180);
      // 端翼：斜切线 + 圆弧 + 直边
      const ear = earGeo(sx);
      for (const syc of [-1, 1] as const) {
        const e = syc < 0 ? ear.up : ear.dn;
        const [a0, a1] = sweep(e.aT, sx, syc);
        line('cut', le, syc < 0 ? lidY0 : lidY1, e.T.x, e.T.y);
        arc('cut', ear.ecx, e.cy, R, a0, a1);
      }
      line('cut', ear.tip, lidMid - hh, ear.tip, lidMid + hh);
    }

    /* ---------------- 3D 面板树（根 = 底板，全程平躺） ---------------- */
    const PV = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [r3(x), r3(y)] as [number, number]);
    const rect = (x0: number, y0: number, x1: number, y1: number) => PV([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    const node = (
      id: string,
      poly: [number, number][],
      hinge: { kind: 'v' | 'h'; at: number; sign: 1 | -1 },
      phase: number,
      finalDeg: number,
      children: PanelNode[] = [],
      holes?: [number, number][][]
    ): PanelNode => ({ id, poly, hinge, phase, finalDeg, children, holes });

    const tabs = (sx: 1 | -1) => [0, 1].map((i) =>
      node(`glue${sx > 0 ? 'R' : 'L'}${i}`, rect(sx * tabOut, linerTop, sx * tabIn, sheetTop), { kind: 'h', at: linerTop, sign: 1 }, 0.74, 88)
    );
    const dust = (sx: 1 | -1) => [0, 1].map((i) =>
      node(`dust${sx > 0 ? 'R' : 'L'}${i}`, rect(sx * tabOut, -wallY, sx * tabIn, -wallY + tabD), { kind: 'h', at: -wallY, sign: -1 }, 0.4, 90)
    );
    const liner = node('liner', rect(lidE(-1), bandTop, lidE(1), linerTop), { kind: 'h', at: bandTop, sign: 1 }, 0.5, 92, [...tabs(1), ...tabs(-1)]);
    const band = node('band', rect(lidE(-1), backTop, lidE(1), bandTop), { kind: 'h', at: backTop, sign: 1 }, 0.44, 90, [liner], [
      rect(-halfW, bandTop, halfW, backTop),
    ]);

    /** 端翼轮廓：盖顶角 → 切线 → 圆弧 → 直边 → 圆弧 → 切线 → 盖底角 */
    const earPoly = (sx: 1 | -1) => {
      const le = lidE(sx);
      const ear = earGeo(sx);
      const pts: [number, number][] = [[le, lidY0], [r3(ear.up.T.x), r3(ear.up.T.y)]];
      pts.push(...arcPts(ear.ecx, ear.up.cy, R, ear.up.aT, sx > 0 ? 360 : 180).slice(1));
      pts.push([r3(ear.tip), r3(lidMid + hh)]);
      pts.push(...arcPts(ear.ecx, ear.dn.cy, R, sx > 0 ? 0 : 180, ear.dn.aT).slice(1));
      pts.push([le, lidY1]);
      return PV(pts);
    };

    const flap = node('flap', rect(lidE(-1), flapCrease, lidE(1), flapEnd), { kind: 'h', at: flapCrease, sign: -1 }, 0.84, 90);
    const lid = node('lid', rect(lidE(-1), lidTop, lidE(1), flapCrease), { kind: 'h', at: lidTop, sign: -1 }, 0.62, 90, [
      node('earR', earPoly(1), { kind: 'v', at: lidE(1), sign: -1 }, 0.78, 90),
      node('earL', earPoly(-1), { kind: 'v', at: lidE(-1), sign: 1 }, 0.78, 90),
      flap,
    ]);
    const wallB = node('wallB', rect(-wallH, backTop, wallH, -wallY), { kind: 'h', at: -wallY, sign: 1 }, 0.05, 90, [band, ...dust(1), ...dust(-1)]);
    const wallF = node('wallF', rect(-wallH, wallY, wallH, frontBot), { kind: 'h', at: wallY, sign: -1 }, 0.05, 90, [lid]);

    const wing = (sx: 1 | -1) =>
      node(`wing${sx > 0 ? 'R' : 'L'}`, rect(sx * SH, -baseY, sx * baseH, baseY), { kind: 'v', at: sx * baseH, sign: sx > 0 ? -1 : 1 }, 0.12, 90, [
        node(`shelf${sx > 0 ? 'R' : 'L'}T`, rect(sx * SH, wingTop, sx * wallH, -baseY), { kind: 'h', at: -baseY, sign: 1 }, 0.3, 90),
        node(`shelf${sx > 0 ? 'R' : 'L'}B`, rect(sx * SH, baseY, sx * wallH, frontBot), { kind: 'h', at: baseY, sign: -1 }, 0.3, 90),
      ]);

    const base: PanelNode = { id: 'base', poly: rect(-baseH, -wallY, baseH, wallY), children: [wallB, wallF, wing(1), wing(-1)] };

    const bb = bbox(c.entities);
    const warnings = commonWarnings(p, make);
    if (t < 1.5 || t > 6) warnings.push('本盒型余量按瓦楞纸板标定，建议纸厚 1.5~6mm');
    if (tabOut > wallH) warnings.push('粘舌位置过外，已超出墙列范围');
    if (hh * 2 > lidD) warnings.push('端翼直边高接近盖深，端翼轮廓会失真');
    if (tipX(-1) < -SH || tipX(1) > SH) warnings.push('端翼伸出幅面之外，请减小端翼伸出宽');
    if (flapD > lidD + B) warnings.push('展示翻片过深，翻折后会穿出盒底');
    if (th < 2 * t) warnings.push('双折铰边带宽不足 2 倍纸厚，锁口槽无法成型');
    warnings.push('双折铰边与锁口槽依赖模切精度，请试折后再批量');

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
