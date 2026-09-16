/**
 * 书型翻盖盒（连体脊书盒）
 * 底托（浅盘：底板 + 三面围板）+ 背脊板（兼作托后壁，高 = 盒总高 H）
 * + 盖（顶板 + 左右围 + 插唇），盖顶绕脊两级 90° 折合盖到托口上方（书页式开合）。
 *
 * 2D 布局（y-down 展开链，从上到下）：
 *   [盖唇 lip][盖顶 Wg][脊 S=H][托底 W][托前围 td]
 *   x：脊/托底/前围 x∈[0,L]；盖顶 x∈[-G, L+G]（加间隙盖住托外围）；
 *      盖左右围在盖顶两端外伸 gd；托左右围在托底两端外伸 td
 * 成型：托围竖起 → 脊竖起（= 托后壁）→ 盖顶绕脊翻折落至托口上方 → 盖围扣住托壁、唇插入
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { DielineResult, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'lidH', label: '托盘深', type: 'number', unit: 'mm', min: 10, max: 200, group: '工艺参数' },
  { key: 'clearance', label: '托盖单边间隙', type: 'number', unit: 'mm', min: 0, max: 5, step: 0.1, group: '工艺参数' },
];

export const bookBox = {
  id: 'book-box',
  name: '书型翻盖盒（连体脊）',
  category: '礼盒 / 组合结构',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const { l: L, w: W, h: H } = make;
    const t = p.t;

    const td = Math.min(Math.max(p.lidH, 10), H - 5); // 托盘深（lidH 复用，须留盖围空间）
    const S = H; // 脊宽 = 盒总高（脊板即托后壁）
    const gd = Math.max(15, H - td - 2); // 盖围深（扣住托壁，留 2mm 不触底）
    const G = Math.max(1, p.clearance); // 托盖单边间隙
    const Wg = W + 2 * G; // 盖顶宽（y 链方向）
    const lip = Math.min(20, Math.max(8, td * 0.35)); // 盖插唇深
    const lipIn = 6; // 盖唇侧收

    const c = new EntCollector();

    // y 布局（自上而下）：盖唇 → 盖顶 → 脊 → 托底 → 托前围
    const yCoverA = 0; // 盖唇|盖顶折线
    const yCoverB = lip; // 盖顶上缘（盖顶段起点）
    const yCoverC = lip + Wg; // 盖顶|脊折线
    const ySpineB = yCoverC + S; // 脊|托底折线
    const yBaseB = ySpineB + W; // 托底|托前围折线
    const TH = yBaseB + td;

    // x 布局
    const xCL = -G; // 盖顶左缘
    const xCR = L + G; // 盖顶右缘
    const xL = xCL - gd; // 盖左围外缘
    const xR = xCR + gd; // 盖右围外缘
    const xTL = -td; // 托左围外缘
    const xTR = L + td; // 托右围外缘
    const TW = xR - xL;

    // 折线（crease）
    c.line('crease', lipIn, yCoverB, L - lipIn, yCoverB); // 盖唇|盖顶（唇宽段；两侧余段为废料边界）
    c.line('crease', 0, yCoverC, L, yCoverC); // 盖顶|脊（脊宽段）
    c.line('crease', 0, ySpineB, L, ySpineB); // 脊|托底
    c.line('crease', 0, yBaseB, L, yBaseB); // 托底|托前围
    c.line('crease', xCL, yCoverB, xCL, yCoverC); // 盖顶|盖左围
    c.line('crease', xCR, yCoverB, xCR, yCoverC); // 盖顶|盖右围
    c.line('crease', 0, ySpineB, 0, yBaseB); // 托底|托左围
    c.line('crease', L, ySpineB, L, yBaseB); // 托底|托右围

    // 裁切线（cut）：各板外缘
    // 盖唇（窄于盖顶：左右侧收 lipIn，盖顶上缘两侧余段为废料边界）
    c.line('cut', lipIn, yCoverA, L - lipIn, yCoverA); // 唇上缘
    c.line('cut', lipIn, yCoverA, lipIn, yCoverB); // 唇左缘
    c.line('cut', L - lipIn, yCoverA, L - lipIn, yCoverB); // 唇右缘
    c.line('cut', xCL, yCoverB, lipIn, yCoverB); // 盖顶上缘左余段
    c.line('cut', L - lipIn, yCoverB, xCR, yCoverB); // 盖顶上缘右余段
    // 盖左/右围外缘（三边）
    c.line('cut', xCL, yCoverB, xL, yCoverB); // 左围上缘（斜：从盖顶上缘到外缘）
    c.line('cut', xL, yCoverB, xL, yCoverC); // 左围外缘
    c.line('cut', xL, yCoverC, xCL, yCoverC); // 左围下缘
    c.line('cut', xCR, yCoverB, xR, yCoverB);
    c.line('cut', xR, yCoverB, xR, yCoverC);
    c.line('cut', xR, yCoverC, xCR, yCoverC);
    // 脊两侧缘（x=0/L，脊段）
    c.line('cut', 0, yCoverC, 0, ySpineB);
    c.line('cut', L, yCoverC, L, ySpineB);
    // 托左/右围外缘（三边）
    c.line('cut', xTL, ySpineB, 0, ySpineB); // 托左围上缘
    c.line('cut', xTL, ySpineB, xTL, yBaseB); // 外缘
    c.line('cut', xTL, yBaseB, 0, yBaseB); // 下缘
    c.line('cut', L, ySpineB, xTR, ySpineB);
    c.line('cut', xTR, ySpineB, xTR, yBaseB);
    c.line('cut', xTR, yBaseB, L, yBaseB);
    // 托前围外缘（下缘 + 左右缘）
    c.line('cut', 0, TH, L, TH);
    c.line('cut', 0, yBaseB, 0, TH);
    c.line('cut', L, yBaseB, L, TH);

    // 3D 面板树：根 = 脊（成型后恰为水平盒底，折叠全程平铺贴地、盒子朝向不变）。
    // 换根后 depth 不再对应成型工序，各铰链用显式 phase 排波次：
    //   托底立起(0.02) → 托围折合(0.14) → 盖顶折合(0.44) → 盖围(0.60) → 唇(0.74)
    const rect = (xa: number, ya: number, xb: number, yb: number): [number, number][] => [
      [xa, ya],
      [xb, ya],
      [xb, yb],
      [xa, yb],
    ];
    const mk = (id: string, poly: [number, number][], hinge: PanelNode['hinge'], finalDeg?: number, phase?: number): PanelNode => ({
      id,
      poly: poly.map(([x, y]) => [r3(x), r3(y)] as [number, number]),
      hinge,
      finalDeg,
      phase,
      children: [],
    });

    // 盖（挂脊）：顶 + 唇 + 左右围（唇挂盖顶前端 yCoverB 折线，折合后垂于盖前缘）
    const coverLip = mk('cover-lip', rect(lipIn, yCoverA, L - lipIn, yCoverB), { kind: 'h', at: yCoverB, sign: 1 }, 85); // 默认 0.74
    const coverLeft = mk('cover-left', rect(xL, yCoverB, xCL, yCoverC), { kind: 'v', at: xCL, sign: 1 }, 89, 0.6);
    const coverRight = mk('cover-right', rect(xCR, yCoverB, xR, yCoverC), { kind: 'v', at: xCR, sign: -1 }, 89, 0.6);
    const coverTop = mk('cover-top', rect(xCL, yCoverB, xCR, yCoverC), { kind: 'h', at: yCoverC, sign: 1 }, 90, 0.44);
    coverTop.children.push(coverLip, coverLeft, coverRight);

    // 托：底（挂脊）+ 前围 + 左右围
    const trayFront = mk('tray-front', rect(0, yBaseB, L, TH), { kind: 'h', at: yBaseB, sign: -1 }, 90, 0.14);
    const trayLeft = mk('tray-left', rect(xTL, ySpineB, 0, yBaseB), { kind: 'v', at: 0, sign: 1 }, 91.2, 0.14);
    const trayRight = mk('tray-right', rect(L, ySpineB, xTR, yBaseB), { kind: 'v', at: L, sign: -1 }, 91.2, 0.14);
    // 托底挂脊下缘（脊在折线上方时 sign +1，互换父子后托底在下方 → sign -1）
    const trayBase = mk('tray-base', rect(0, ySpineB, L, yBaseB), { kind: 'h', at: ySpineB, sign: -1 }, 90, 0.02);
    trayBase.children.push(trayFront, trayLeft, trayRight);

    // 脊 = 根（无铰链，恒平铺贴地）
    const spine: PanelNode = {
      id: 'spine',
      poly: rect(0, yCoverC, L, ySpineB).map(([x, y]) => [r3(x), r3(y)] as [number, number]),
      children: [coverTop, trayBase],
    };

    const warnings = [...commonWarnings(p, make)];
    if (p.clearance < 0.3) warnings.push('托盖间隙 < 0.3mm，翻盖可能过紧');
    if (td < 15) warnings.push('托盘深 < 15mm，内容物易滑出');
    if (H - td < 17) warnings.push('盖围深不足（总高 - 托深 < 17mm），盖扣合量偏浅');
    warnings.push('脊部为连体两级折线，翻盖寿命取决于脊线压痕工艺');

    return {
      entities: c.entities,
      panels: [spine],
      meta: {
        makeSize: make,
        unfold: { w: TW, h: TH },
        areaM2: (TW * TH) / 1e6,
        warnings,
      },
    };
  },
};
