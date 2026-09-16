/**
 * 一页成型箱（0447 变体，无糊口）
 * 一张纸板折成完整纸箱，无糊口、无钉：
 *   布局（2D）：中央底板 L×W；上/下各接前/后壁（高 H）；左右各接侧壁（宽 W）；
 *   前后壁两端各连一片端盖（深 W），折合后包贴侧壁外壁，锁合成型。
 * 折合顺序：前后壁 + 侧壁立起 → 四片端盖折 90° 包住侧壁 → 封箱（胶带/扎带）。
 * 电商「一页箱 / 免胶箱」常用，免开槽、免粘合工序。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { DielineResult, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

const fields: FieldSpec[] = [...COMMON_FIELDS];

export const onePageBox = {
  id: 'one-page-box',
  name: '一页成型箱（无糊口 0447）',
  category: '快递 / 电商',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const { l: L, w: W, h: H } = make;

    const c = new EntCollector();
    // 列/行边界：x = [0..W | W..W+L | W+L..2W+L]，y = [0..H | H..H+W | H+W..2H+W]
    const X1 = W;
    const X2 = W + L;
    const TW = 2 * W + L;
    const Y1 = H;
    const Y2 = H + W;
    const TH = 2 * H + W;

    // 折线（crease）：x=X1/X2 全高三段（端盖|壁 → 壁|底 → 壁|端盖）；
    // y=Y1/Y2 底板上下缘（前壁|底、底|后壁）
    c.line('crease', X1, 0, X1, TH);
    c.line('crease', X2, 0, X2, TH);
    c.line('crease', X1, Y1, X2, Y1);
    c.line('crease', X1, Y2, X2, Y2);

    // 裁切线（cut）：
    // 板间分界（不相连的板：端盖与侧壁）
    c.line('cut', 0, Y1, X1, Y1); // 前端盖|左壁
    c.line('cut', X2, Y1, TW, Y1); // 前端盖|右壁
    c.line('cut', 0, Y2, X1, Y2); // 左壁|后端盖
    c.line('cut', X2, Y2, TW, Y2); // 右壁|后端盖
    // 外框（矩形周界；左右边在 Y1/Y2 处分段，使 T 形衔接变为端点闭合）
    c.line('cut', 0, 0, TW, 0);
    c.line('cut', 0, TH, TW, TH);
    c.line('cut', 0, 0, 0, Y1);
    c.line('cut', 0, Y1, 0, Y2);
    c.line('cut', 0, Y2, 0, TH);
    c.line('cut', TW, 0, TW, Y1);
    c.line('cut', TW, Y1, TW, Y2);
    c.line('cut', TW, Y2, TW, TH);

    // 3D 面板树：根 = 前壁（成型后恰为水平盒底，折叠全程平铺贴地、盒子朝向不变）；
    // 底板挂前壁（h 折），back/left/right 挂底板，四片端盖挂前后壁（包贴侧壁外壁）。
    // 换根后 depth 不再对应成型工序，各铰链用显式 phase 排波次：
    //   底板立起(0.02) → 左右壁(0.14) → 后壁折平(0.44) → 端盖包贴(0.60)
    const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
    const mk = (id: string, poly: [number, number][], hinge: PanelNode['hinge'], finalDeg?: number, phase?: number): PanelNode => ({
      id,
      poly: poly.map(([x, y]) => [r3(x), r3(y)] as [number, number]),
      hinge,
      finalDeg,
      phase,
      children: [],
    });

    // 端盖：挂前后壁，v 折 90° 后平行侧壁、贴其外壁（错层 1.2°/2.4° 避共面）
    const frontLeft = mk('fgl', rect(0, 0, X1, Y1), { kind: 'v', at: X1, sign: 1 }, 91.2, 0.6);
    const frontRight = mk('fgr', rect(X2, 0, TW, Y1), { kind: 'v', at: X2, sign: -1 }, 92.4, 0.6);
    const backLeft = mk('bgl', rect(0, Y2, X1, TH), { kind: 'v', at: X1, sign: 1 }, 92.4, 0.6);
    const backRight = mk('bgr', rect(X2, Y2, TW, TH), { kind: 'v', at: X2, sign: -1 }, 91.2, 0.6);

    const front: PanelNode = {
      id: 'front',
      poly: rect(X1, 0, X2, Y1).map(([x, y]) => [r3(x), r3(y)] as [number, number]),
      children: [frontLeft, frontRight],
    };
    const back = mk('back', rect(X1, Y2, X2, TH), { kind: 'h', at: Y2, sign: -1 }, 90, 0.44);
    back.children.push(backLeft, backRight);
    const left = mk('left', rect(0, Y1, X1, Y2), { kind: 'v', at: X1, sign: 1 }, 90, 0.14);
    const right = mk('right', rect(X2, Y1, TW, Y2), { kind: 'v', at: X2, sign: -1 }, 90, 0.14);

    // 底板：挂前壁上缘（前壁在折线上方时 sign +1，互换父子后底板在下方 → sign -1）
    const base = mk('base', rect(X1, Y1, X2, Y2), { kind: 'h', at: Y1, sign: -1 }, 90, 0.02);
    base.children.push(back, left, right);
    front.children.push(base);

    const root = front;

    const warnings = [...commonWarnings(p, make)];
    if (H < 25) warnings.push('箱高 < 25mm，端盖折合空间局促，建议打样确认');
    if (H > W) warnings.push('箱高大于箱宽，端盖（深=宽）可能无法完全锁合侧壁');
    warnings.push('一页箱封箱依赖端盖摩擦锁合 + 外部胶带/扎带加固');

    return {
      entities: c.entities,
      panels: [root],
      meta: {
        makeSize: make,
        unfold: { w: TW, h: TH },
        areaM2: (TW * TH) / 1e6,
        warnings,
      },
    };
  },
};
