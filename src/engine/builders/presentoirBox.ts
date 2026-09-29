/**
 * 斜口展示盒（boîte présentoir：低前墙展示开口 + 连体翻盖 + 端部双层卷边）
 *
 * 按参考刀版（83 实体，幅面 756×758 @ 300×220×100 · t=6）逐线参数化重画。
 * 尺寸模型（内尺寸 L/B/H + 纸厚 t，k = t/3）：
 *   中列宽 Lb = L + 8k     底板深 Bd = B + 4k     前墙总高 Hf = H + 2k
 *   后墙高 = H + k         盖面深 Ld = B + k（+ 盖深修正）    插舌宽 Lt = L + 2k
 *   端部卷边（由底板向外）：外墙 H | 条带 2t | 内墙 H − t | 胶舌 4k
 *   ——外墙与内墙沿条带翻折叠合成双层端壁，内墙比外墙短 t 以补偿两道折边占去的纸厚
 *   前后墙各带一对端翼：立墙后绕墙侧折线内折 90°，贴合作为端壁内衬的前后半
 *   连体翻盖总深 = B + k（比底板浅一个纸厚），中折线只用于扁平包装，成型时盖面与叶面共面
 *   角部斜切 3k×2k（条带斜接 2t×t）；底板让位锁口宽 7k / 5k、高 Bd/3
 *   展示开口 = 梯形：上沿宽 = Lb − 20k，下沿在前墙高度方向内收
 *   （左收 开口高/3，右收 开口高×0.2974——参考样版两侧斜率不等，按实测保留）
 *   盖面中折线上开手扣半圆孔（半径 = 孔径/2）；插舌端部 R20 圆角为固定设计值
 */
import { BoxParams, COMMON_FIELDS, FieldSpec, toMakeSize } from '../params';
import { bbox, DielineResult, Layer, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

/* ---------- 固定设计值（参考样版标定） ---------- */
const RT = 20; // 插舌端部圆角
const KNOCK_IN = 7; // 底板让位锁口宽（近角侧，×k）
const KNOCK_OUT = 5; // 锁口宽（远角侧，参考样版两侧不等宽）
const OP_INSET = 10; // 展示开口上沿单边内缩（×k）
const SLANT_IN = 1 / 3; // 开口侧边斜率：左 dx = 开口高 / 3
const SLANT_OUT = 17.842 / 60; // 右：参考样版实测斜率

const rad = (d: number) => (d * Math.PI) / 180;
/** 圆弧采样成折线点（3D 面板轮廓用，角度制 a0→a1） */
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n = 8): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });

const fields: FieldSpec[] = [
  ...COMMON_FIELDS.filter((f) =>
    f.key === 'sizeType' || f.key === 'L' || f.key === 'W' || f.key === 'H' || f.key === 'material' || f.key === 't'
  ),
  { key: 'glueFlap', label: '端壁胶舌宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
  { key: 'flapGap', label: '盖深修正', type: 'number', unit: 'mm', min: -30, max: 80, group: '工艺参数' },
  { key: 'tongue', label: '插舌深（0=自动）', type: 'number', unit: 'mm', min: 0, max: 200, group: '工艺参数' },
  { key: 'winW', label: '展示开口宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 1200, group: '工艺参数' },
  { key: 'winH', label: '前墙净高（0=自动）', type: 'number', unit: 'mm', min: 0, max: 600, group: '工艺参数' },
  { key: 'handleW', label: '盖手扣孔径（0=自动）', type: 'number', unit: 'mm', min: 0, max: 400, group: '工艺参数' },
];

export const presentoirBox = {
  id: 'presentoir-display',
  name: '斜口展示盒（连体翻盖）',
  category: '展示 / 陈列',
  /** 推荐尺寸即参考刀版样版参数（300×220×100 · BC 双瓦 t=6，工艺参数为样版标定值） */
  sample: {
    sizeType: 'inner' as const,
    L: 300,
    W: 220,
    H: 100,
    material: 'BC',
    t: 6,
    glueFlap: 8,
    flapGap: 0,
    tongue: 102,
    winW: 276,
    winH: 44,
    handleW: 130,
  },
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    // 刀版以内容尺寸为基准（余量链已含内→制造换算）
    const L = make.l - p.t, B = make.w - p.t, H = Math.max(make.h - 2 * p.t, 10);
    const { t } = p;
    const k = t / 3;

    // ---- 工艺参数（面板可编辑，0 = 自动；推荐值即参考样版标定值）----
    const gt = p.glueFlap > 0 ? p.glueFlap : Math.max(4 * k, 5); // 端壁胶舌宽
    const tk = p.tongue > 0 ? p.tongue : H + k; // 插舌深
    const opW = p.winW > 0 ? p.winW : L + 8 * k - OP_INSET * 2 * k; // 展示开口上沿宽
    const HF = p.winH > 0 ? p.winH : Math.max(H / 2 - 3 * k, 2); // 前墙净高
    const LFt = p.handleW > 0 ? p.handleW : Math.max(B * 0.6, 40); // 盖手扣孔径

    // ---- 派生尺寸 ----
    const Hf = H + 2 * k; // 前墙总高
    const Hb = H + k; // 后墙高
    const Lb = L + 8 * k; // 中列宽
    const Bd = B + 4 * k; // 底板深
    const Ld = Math.max(B + k + p.flapGap, 10); // 盖面深
    const Lt = Math.min(L + 2 * k, Lb - 2 * k); // 插舌宽
    const ws = 6 * k; // 端壁条带宽（= 2t，双层壁的纸厚补偿）
    const Wi = Math.max(H - 3 * k, 5); // 内端壁高
    const NR = Math.min(LFt / 2, Ld / 2 - 2 * k, Lb / 2 - 10 * k); // 手扣半径
    const Rsl = Math.max(Math.min(opW / 2, Lb / 2 - 4 * k), 10); // 开口上沿半幅
    const cutH = Math.max(Hf - HF, 8); // 开口高（自前墙自由边量入）
    const rIn = Math.min(cutH * SLANT_IN, Rsl - 10); // 左斜收
    const rOut = Math.min(cutH * SLANT_OUT, Rsl - 10); // 右斜收

    // 关键坐标：rel 系（原点=底板中心，y 向下指向盖端），输出时绕 x 轴翻转
    const h0 = Lb / 2, h1 = h0 + 3 * k, h2 = h1 + H, h3 = h2 + ws, h4 = h3 + Wi, h5 = h4 + gt;
    const hT = Lt / 2;
    const y0 = -(Bd / 2 + Hf), y1 = -Bd / 2, y2 = -y1;
    const y3 = y2 + Hb, y4 = y3 + Ld, y5 = y4 + tk, ym = y3 + Ld / 2;
    const yop = y1 - HF; // 开口下沿
    const kh = Bd / 6; // 锁口 / 胶舌半高
    const klIn = h1 - KNOCK_IN * k, klOut = h1 - KNOCK_OUT * k;

    const c = new EntCollector();
    /** rel → 引擎坐标：y 翻转，使展示开口段位于展开图上方、翻盖位于下方 */
    const line = (layer: Layer, x1: number, a: number, x2: number, b: number) => c.line(layer, x1, -a, x2, -b);
    const cutArc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
      c.entities.push({ kind: 'arc', layer: 'cut', c: { x: r3(cx), y: r3(-cy) }, r: r3(r), a0: r3(-a1), a1: r3(-a0) });

    /* ---------- 中列折线：底板 ↔ 前后墙 ↔ 盖 ↔ 插舌 ---------- */
    line('crease', -h0, y1, h0, y1);
    line('crease', h0, y2, -h0, y2);
    line('crease', -h0, y1, -h0, y0);
    line('crease', h0, y0, h0, y1);
    line('crease', -h0, y2, -h0, y3);
    line('crease', h0, y3, h0, y2);
    line('crease', -h0, y3, h0, y3);
    line('crease', -hT, y4, hT, y4);
    line('cut', -h0, y3, -h0, y4);
    line('cut', h0, y3, h0, y4);
    line('cut', -h0, y4, -hT, y4);
    line('cut', hT, y4, h0, y4);

    /* ---------- 前墙自由边 + 梯形展示开口 ---------- */
    line('cut', -h0, y0, -Rsl, y0);
    line('cut', Rsl, y0, h0, y0);
    line('cut', -(Rsl - rIn), yop, Rsl - rOut, yop);
    line('cut', -(Rsl - rIn), yop, -Rsl, y0);
    line('cut', Rsl - rOut, yop, Rsl, y0);

    /* ---------- 角部斜切 ---------- */
    line('cut', -h0, y0, -h1, y0 + 2 * k);
    line('cut', h0, y0, h1, y0 + 2 * k);
    line('cut', -h0, y1, -h1, y1 - k);
    line('cut', h0, y1, h1, y1 - k);
    line('cut', -h0, y2, -h1, y2 + k);
    line('cut', h0, y2, h1, y2 + k);
    line('cut', -h1, y3 - 2 * k, -h0, y3);
    line('cut', h1, y3 - 2 * k, h0, y3);

    /* ---------- 插舌（端部 R20 圆角） ---------- */
    line('cut', -hT, y5 - RT, -hT, y4);
    line('cut', hT, y5 - RT, hT, y4);
    line('cut', hT - RT, y5, -(hT - RT), y5);
    cutArc(-(hT - RT), y5 - RT, RT, 90, 180);
    cutArc(hT - RT, y5 - RT, RT, 0, 90);

    /* ---------- 盖面中折线 + 手扣半圆孔 ---------- */
    line('crease', -h0, ym, -NR, ym);
    line('crease', NR, ym, h0, ym);
    cutArc(0, ym, NR, 180, 270);
    cutArc(0, ym, NR, 270, 360);

    /* ---------- 端部双层卷边（左右镜像） ---------- */
    for (const sx of [1, -1] as const) {
      const kd = sx > 0 ? klOut : klIn; // 锁口内缘
      line('cut', sx * h1, y0 + 2 * k, sx * h2, y0 + 2 * k); // 外墙顶边
      line('cut', sx * h2, y0 + 2 * k, sx * h2, y1 - k);
      line('cut', sx * h2, y1 - k, sx * h1, y1 - k);
      line('cut', sx * h3, y1 + 2 * k, sx * h2, y1 - k); // 条带上端斜接
      line('cut', sx * h2, y2 + k, sx * h3, y2 - 2 * k); // 条带斜接
      line('cut', sx * h3, y2 - 2 * k, sx * h4, y2 - 2 * k); // 内墙底边
      line('cut', sx * h4, y1 + 2 * k, sx * h3, y1 + 2 * k);
      line('cut', sx * h4, y2 - 2 * k, sx * h4, kh); // 内墙外缘（中段让位胶舌）
      line('cut', sx * h4, -kh, sx * h4, y1 + 2 * k);
      line('cut', sx * h4, kh, sx * h5, kh); // 胶舌
      line('cut', sx * h5, kh, sx * h5, -kh);
      line('cut', sx * h5, -kh, sx * h4, -kh);
      line('cut', sx * h2, y2 + k, sx * h1, y2 + k); // 外墙底边
      line('cut', sx * h1, y3 - 2 * k, sx * h2, y3 - 2 * k);
      line('cut', sx * h2, y3 - 2 * k, sx * h2, y2 + k);
      line('crease', sx * h2, y2 + k, sx * h2, y1 - k); // 外墙 ↔ 条带
      line('crease', sx * h3, y2 - 2 * k, sx * h3, y1 + 2 * k); // 条带 ↔ 内墙
      line('crease', sx * h1, y2 + k, sx * h1, kh); // 底板 ↔ 外墙
      line('crease', sx * h1, y1 - k, sx * h1, -kh);
      line('cut', sx * h1, kh, sx * kd, kh); // 底板让位锁口
      line('cut', sx * kd, -kh, sx * kd, kh);
      line('cut', sx * kd, -kh, sx * h1, -kh);
      line('cut', sx * h1, kh, sx * h1, -kh);
    }

    /* ---------- 3D 面板树（根=底板，成型后为平躺 L×B×H；展示开口在前墙，连体翻盖平铺顶面） ----------
     * 折叠链（与样版折线一一对应）：
     *   前墙 90° 立起 → 前墙端翼绕 x=±Lb/2 折 90°，成为端壁内衬的前半
     *   后墙 90° 立起 → 后墙端翼同上，成为端壁内衬的后半（与内卷边壁贴合成双层端壁）
     *   端部卷边：外墙 90° 立起 → 条带 90° 内翻压顶 → 内墙 90° 下垂 → 胶舌 90° 平贴底板锁口
     *   后墙顶 → 盖面 90° 平铺（深 B+k，比底板浅一个纸厚）→ 中折线处叶面与盖面共面（finalDeg=0，
     *   该折线只是扁平包装折与手扣孔所在）→ 插舌 90°+ 下垂，压在前墙内侧面
     */
    const E = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [r3(x), r3(-y)] as [number, number]);
    const rect = (x0: number, ya: number, x1: number, yb: number) => E([[x0, ya], [x1, ya], [x1, yb], [x0, yb]]);
    /** 侧向面板：给出 |x| 轮廓 + 对应 y，sx<0 时镜像 */
    const side = (xs: number[], ys: number[], sx: 1 | -1) => E(xs.map((x, i) => [sx * x, ys[i]]));
    const node = (
      id: string,
      poly: [number, number][],
      hinge: { kind: 'v' | 'h'; at: number; sign: 1 | -1 },
      phase: number,
      finalDeg: number,
      children: PanelNode[] = []
    ): PanelNode => ({ id, poly, hinge, phase, finalDeg, children });

    /** 端翼轮廓（前后墙共用）：墙侧折线 x=h0 → 斜切 → 端壁内衬外缘 x=h2（ys 按样版逐点给出） */
    const wingPoly = (ys: number[], sx: 1 | -1) => side([h0, h1, h2, h2, h1, h0], ys, sx);
    const wings = (ys: number[], ph: number, tag: string) =>
      ([1, -1] as const).map((sx) =>
        node(
          `${tag}${sx > 0 ? 'R' : 'L'}`,
          wingPoly(ys, sx),
          { kind: 'v', at: sx * h0, sign: sx > 0 ? -1 : 1 },
          ph,
          90
        )
      );

    const wallF = node(
      'wallF',
      E([[-h0, y0], [-Rsl, y0], [-(Rsl - rIn), yop], [Rsl - rOut, yop], [Rsl, y0], [h0, y0], [h0, y1], [-h0, y1]]),
      { kind: 'h', at: -y1, sign: -1 },
      0.05,
      90,
      wings([y0, y0 + 2 * k, y0 + 2 * k, y1 - k, y1 - k, y1], 0.2, 'wingF')
    );

    /* 盖面（靠后墙那半）：远端边上开 ØLFt 手扣半圆，孔朝后墙方向凸出 */
    const lidPoly = E([
      [-h0, y3], [h0, y3], [h0, ym],
      ...arcPts(0, ym, NR, 0, -180, 16),
      [-h0, ym],
    ]);
    const tuckPoly = E([
      [-hT, y4], [hT, y4], [hT, y5 - RT],
      ...arcPts(hT - RT, y5 - RT, RT, 0, 90, 5),
      [-(hT - RT), y5],
      ...arcPts(-(hT - RT), y5 - RT, RT, 90, 180, 5),
      [-hT, y5 - RT],
    ]);
    const lid = node(
      'lid',
      lidPoly,
      { kind: 'h', at: -y3, sign: 1 },
      0.5,
      90,
      [
        node('lidLeaf', rect(-h0, ym, h0, y4), { kind: 'h', at: -ym, sign: 1 }, 0.62, 0, [
          node('tuck', tuckPoly, { kind: 'h', at: -y4, sign: 1 }, 0.74, 91),
        ]),
      ]
    );
    const wallB = node('wallB', rect(-h0, y2, h0, y3), { kind: 'h', at: -y2, sign: 1 }, 0.3, 90, [
      ...wings([y3, y3 - 2 * k, y3 - 2 * k, y2 + k, y2 + k, y2], 0.42, 'wingB'),
      lid,
    ]);

    const endStack = (sx: 1 | -1): PanelNode => {
      const s = sx > 0 ? -1 : 1;
      const glue = node(`glue${sx > 0 ? 'R' : 'L'}`, side([h4, h5, h5, h4], [kh, kh, -kh, -kh], sx), { kind: 'v', at: sx * h4, sign: s }, 0.44, 90);
      const inner = node(
        `inner${sx > 0 ? 'R' : 'L'}`,
        side([h3, h4, h4, h3], [y1 + 2 * k, y1 + 2 * k, y2 - 2 * k, y2 - 2 * k], sx),
        { kind: 'v', at: sx * h3, sign: s },
        0.34,
        91,
        [glue]
      );
      const band = node(
        `band${sx > 0 ? 'R' : 'L'}`,
        side([h2, h3, h3, h2], [y1 - k, y1 + 2 * k, y2 - 2 * k, y2 + k], sx),
        { kind: 'v', at: sx * h2, sign: s },
        0.24,
        90,
        [inner]
      );
      return node(
        `end${sx > 0 ? 'R' : 'L'}`,
        side([h1, h2, h2, h1], [y1 - k, y1 - k, y2 + k, y2 + k], sx),
        { kind: 'v', at: sx * h1, sign: s },
        0.14,
        90,
        [band]
      );
    };

    const base: PanelNode = {
      id: 'base',
      poly: rect(-h1, y1, h1, y2),
      holes: [E([[-h1, -kh], [-klIn, -kh], [-klIn, kh], [-h1, kh]]), E([[h1, -kh], [klOut, -kh], [klOut, kh], [h1, kh]])],
      children: [wallF, wallB, endStack(1), endStack(-1)],
    };

    const bb = bbox(c.entities);
    const warnings: string[] = [];
    if (t < 2 || t > 8) warnings.push('本盒型端部为双层卷边，余量按瓦楞纸板标定，建议纸厚 2~8mm');
    if (Hf - HF < 10) warnings.push('展示开口高不足 10mm，前墙接近整壁');
    if (HF < 10) warnings.push('前墙净高 < 10mm，开口下沿难以压贴');
    if (Rsl > Lb / 2 - 4 * k) warnings.push('展示开口过宽，将与端部卷边斜切相交');
    if (Wi < 20) warnings.push('内端壁高 < 20mm，双层卷边难以叠合');
    if (NR < 15) warnings.push('手扣孔过小，建议孔径 ≥ 30mm');
    if (tk > Hf) warnings.push('插舌深大于前墙高，翻盖合拢后会顶到底板');
    warnings.push('端部双层卷边需胶水粘合内墙与胶舌，模切后请先试折');

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
