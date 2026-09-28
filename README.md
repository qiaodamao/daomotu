# 刀模图在线生成器

参数化纸箱 / 纸盒 **刀模图（Dieline）** 在线生成工具：选择盒型、输入尺寸与工艺参数，实时生成 2D 展开图与 3D 折叠预览，并导出生产可用的矢量文件（SVG / DXF / PDF / AI）。

纯前端实现，无后端依赖，几何计算全部在浏览器完成。

---

## 功能特性

- **25 种盒型库**，覆盖瓦楞外箱、快递电商箱、折叠彩盒、礼盒组合结构（FEFCO 编号体系），详见[下方盒型清单](#盒型清单)。
- **实时 2D 刀版**：裁切线（红实线）/ 压痕线（蓝虚线）/ 齿孔线分层显示，滚轮缩放、拖拽平移、双指捏合、一键适应视图。
- **3D 折叠预览**：基于展开图的铰链父子树做折叠 / 展开动画，与 2D 同源，保证几何一致。
- **尺寸体系换算**：内尺寸 / 制造尺寸 / 外尺寸三选一，按瓦楞纸厚自动换算。
- **工艺参数**：糊口、糊口斜切、开槽缝、摇盖修正、插舌、天地盖间隙、开窗、提手孔等，随盒型声明式显隐。
- **矢量导出**：SVG（mm 直读）、DXF R12（分图层 CUT / CREASE）、PDF（1:1 毫米，pdf-lib）、AI（与 PDF 同源，Illustrator 直接打开）；可选带尺寸标注版本。
- **参数持久化与分享**：状态实时同步到 URL query（`?box=…&L=…`）+ localStorage 防抖保存，一键复制当前链接即可分享。
- **PWA 离线可用**，移动端自适应布局。

---

## 技术栈

| 用途 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 状态管理 | Zustand 5 |
| 路由 | react-router-dom 7 |
| 3D | three.js 0.186 |
| PDF 导出 | pdf-lib |
| PWA | vite-plugin-pwa（Workbox） |
| 字体 | @fontsource-variable/geist + geist-mono（本地打包，不依赖外网） |

几何引擎是与框架解耦的**纯函数库**：`builder(params) → DielineResult`，React 只负责壳层与渲染。

---

## 快速开始

需要 Node.js 18+。

```bash
npm install        # 安装依赖
npm run dev        # 本地开发（默认 http://localhost:5173）
npm run build      # 类型检查 + 生产构建，产物输出到 dist/
npm run preview    # 预览生产构建
```

---

## 项目结构

```
src/
  main.tsx              入口：挂载字体与全局样式
  App.tsx               路由壳（/ 落地页，/editor 编辑器）
  store.ts              Zustand 全局状态（当前盒型 + 参数 + 视图选项）
  persist.ts            URL query ↔ localStorage 双向同步
  styles.css            编辑器样式（含 ≤768px 移动端布局）
  landing.css           落地页样式
  pages/
    Landing.tsx         首页落地页（Hero + 盒型库 + 功能 + 流程 + FAQ）
    Editor.tsx          编辑器主界面（顶栏 / 侧栏 / 画布 / 导出 / 状态栏）
  components/
    CanvasView.tsx      Canvas 2D 渲染 + 交互（缩放 / 平移 / 捏合）
    Three3DView.tsx     three.js 3D 折叠预览
    ParamPanel.tsx      参数面板（按盒型 fields 声明式渲染）
    InfoPanel.tsx       展开信息面板（幅面 / 面积 / 校验警告）
    BoxThumb.tsx        盒型缩略图（流式绘制，落地页卡片用）
  engine/
    types.ts            核心数据模型（Entity / PanelNode / DielineResult）
    params.ts           尺寸换算 + 材质库 + 参数字段声明 + 工艺校验
    registry.ts         盒型注册表（统一入口）
    dims.ts             尺寸标注计算
    builders/           各盒型几何 builder（每盒型一文件）
      shared.ts         builder 公共工具（EntCollector 等）
      fefco0201.ts …    见盒型清单
  render/
    render2d.ts         2D 绘制（draw / fitView）+ 线色规范
    render3d.ts         3D 折叠场景
  export/
    svg.ts  dxf.ts  pdf.ts        三种矢量序列化
    download.ts         下载 / 文件命名工具
  tools/                几何校验 / 调试脚本（开发用）
public/                 图标、logo
```

---

## 数据流

```
用户改参数 → store 更新
  → builder.build(params) 纯函数重算 DielineResult（<1ms）
    → 2D（render2d）/ 3D（render3d）各自订阅重绘
    → 导出时从同一 DielineResult 序列化 SVG / DXF / PDF
  → 状态变化 → syncURL 写 query + localStorage 防抖保存
```

---

## 盒型清单

`src/engine/registry.ts` 中的 `REGISTRY` 按分类注册全部盒型，直达链接格式为 `/editor?box=<id>`。

**瓦楞纸箱（FEFCO 02xx 开槽箱系）**
`fefco-0201` 开槽箱 · `fefco-0200` · `fefco-0202` · `fefco-0203` · 短翼箱 · 开窗盒 · 水果箱 · 卷边托盘（0422 / 0421）· 耳朵锁托盘（427）· 提手盒

**快递 / 电商**
`0427` 飞机盒 · 平口快递箱 · 双联箱 · 蛋糕箱 · 一页盒 · 书型盒（bookWrap）

**折叠纸盒（卡纸 / 彩盒）**
正反插口盒（tuck-tuck）· 反插盒（reverse tuck）· 自锁底 0700 · 枕头盒

**礼盒 / 组合结构**
天地盖 · 抽屉盒 · 书型礼盒 · 六角柱礼盒

默认打开 `fefco-0201`。

---

## 如何新增一个盒型

1. 在 `src/engine/builders/` 新建 `<yourBox>.ts`，导出一个实现 `BoxBuilder` 接口的对象：

   ```ts
   export const yourBox = {
     id: 'your-box',
     name: '你的盒型',
     category: '折叠纸盒（卡纸/彩盒）',
     fields,                       // 参数面板字段（可复用 COMMON_FIELDS 过滤/追加）
     build(p: BoxParams): DielineResult {
       const make = toMakeSize(p); // 尺寸换算
       const c = new EntCollector();
       c.line('cut', x1, y1, x2, y2);   // 裁切线
       c.line('crease', ...);           // 压痕线
       // ... 生成 entities + panels + meta
       return { entities: c.entities, panels: [...], meta: {...} };
     },
   };
   ```

2. 在 `src/engine/registry.ts` 中 `import` 并加入 `REGISTRY` 数组对应分类。

3. 完成 —— 落地页盒型库、编辑器、缩略图、导出均自动接入（无硬编码盒型数量）。

坐标约定：单位 mm、Canvas 系 y 轴向下，导出 DXF 时统一翻转为 CAD 的 y-up；内部全精度浮点，导出保留 3 位小数。

---

## 部署

产物为纯静态文件（`dist/`），任意静态托管即可（Vercel / 腾讯云 EdgeOne / OSS+CDN 等）。

> **SPA 回退（重要）**：由于使用 BrowserRouter 且 `/editor` 为客户端路由，托管平台需将 404 回退 rewrite 到 `index.html`，否则直接访问或刷新 `/editor`（及 `/editor?box=…` 直达链接）会 404。

---

## 免责声明

导出的刀模图尺寸与结构**仅供参考**，正式生产刀模请以工厂实际制版建议为准。
