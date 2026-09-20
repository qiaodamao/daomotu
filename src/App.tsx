/**
 * 应用壳：顶栏（品牌 / 视图切换 / 工具 / 下载）+ 左侧边栏（盒型选择 + 参数面板）+ 右侧画布
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasView } from './components/CanvasView';
const Three3DView = lazy(() => import('./components/Three3DView').then((m) => ({ default: m.Three3DView })));
import { InfoPanel } from './components/InfoPanel';
import { ParamPanel } from './components/ParamPanel';
import { getBuilder, REGISTRY } from './engine/registry';
import { downloadBlob, downloadText, exportName } from './export/download';
import { toDXF } from './export/dxf';
import { toSVG } from './export/svg';
import { saveLocal, syncURL } from './persist';
import { useStore } from './store';

export default function App() {
  const boxId = useStore((s) => s.boxId);
  const params = useStore((s) => s.params);
  const showDim = useStore((s) => s.showDim);
  const showFaceDim = useStore((s) => s.showFaceDim);
  const printMode = useStore((s) => s.printMode);
  const setBox = useStore((s) => s.setBox);
  const resetParams = useStore((s) => s.resetParams);
  const toggleDim = useStore((s) => s.toggleDim);
  const toggleFaceDim = useStore((s) => s.toggleFaceDim);
  const togglePrint = useStore((s) => s.togglePrint);

  const [fitSignal, setFitSignal] = useState(0);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [exportOpen, setExportOpen] = useState(false);
  const [withDims, setWithDims] = useState(true);
  const exportRef = useRef<HTMLDivElement>(null);

  const builder = getBuilder(boxId);
  // 几何引擎纯函数派生（<1ms）
  const result = useMemo(() => builder.build(params), [builder, params]);

  // 初始化在 store 创建时完成（persist.initState），此处无需恢复逻辑

  // 盒型切换 → 重新适应视图
  useEffect(() => {
    setFitSignal((s) => s + 1);
  }, [boxId]);

  // 状态变化 → URL 同步 + localStorage 防抖保存
  useEffect(() => {
    syncURL(boxId, params);
    const id = setTimeout(() => saveLocal(boxId, params), 600);
    return () => clearTimeout(id);
  }, [boxId, params]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const handleExport = async (kind: 'svg' | 'dxf' | 'pdf' | 'ai') => {
    setBusy(true);
    try {
      const name = exportName(boxId, result.meta.makeSize.l, result.meta.makeSize.w, result.meta.makeSize.h, kind);
      // 带尺寸下载：内容跟随顶栏「整体尺寸 / 各面尺寸」开关（勾选「带尺寸标注」时生效）
      const dims = withDims && (showDim || showFaceDim) ? { overall: showDim, face: showFaceDim } : undefined;
      if (kind === 'svg') {
        downloadText(name, toSVG(result, dims), 'image/svg+xml');
      } else if (kind === 'dxf') {
        downloadText(name, toDXF(result, dims), 'application/dxf');
      } else {
        // pdf-lib 体积大，动态加载做代码分割
        const { toPDF } = await import('./export/pdf');
        const bytes = await toPDF(result, dims);
        // AI 格式与 PDF 同源（Illustrator 可直接打开），仅扩展名/MIME 不同
        const mime = kind === 'ai' ? 'application/illustrator' : 'application/pdf';
        downloadBlob(name, new Blob([bytes as BlobPart], { type: mime }));
      }
      showToast(`已下载 ${name}`);
    } catch (err) {
      console.error(err);
      showToast(`下载失败：${kind.toUpperCase()} 生成出错`);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('链接已复制');
    } catch {
      showToast('复制失败，请手动复制地址栏');
    }
  };

  // 导出下拉：点击外部关闭
  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportOpen]);

  const pickExport = (kind: 'svg' | 'dxf' | 'pdf' | 'ai') => {
    setExportOpen(false);
    handleExport(kind);
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" title="返回首页">
          <img className="brand-logo" src="/logo.svg" alt="Daomotu" width="24" height="24" />
          <b>刀模图生成器</b>
        </a>

        <div className="view-tabs" role="tablist">
          <button type="button" className={`tab ${view === '2d' ? 'active' : ''}`} onClick={() => setView('2d')}>
            2D 刀版
          </button>
          <button type="button" className={`tab ${view === '3d' ? 'active' : ''}`} onClick={() => setView('3d')}>
            3D 预览
          </button>
        </div>

        <div className="spacer" />

        <div className="tools">
          <button type="button" className={`btn ${showDim ? 'active' : ''}`} onClick={toggleDim} title="显示/隐藏整体幅面尺寸（总宽/总高）">
            整体尺寸
          </button>
          <button type="button" className={`btn ${showFaceDim ? 'active' : ''}`} onClick={toggleFaceDim} title="显示/隐藏各面尺寸（相同尺寸的面只标一处）">
            各面尺寸
          </button>
          <button type="button" className={`btn ${printMode ? 'active' : ''}`} onClick={togglePrint} title="全黑线型（打印友好）">
            打印模式
          </button>
          <button type="button" className="btn" onClick={() => setFitSignal((s) => s + 1)} title="适应视图">
            ⤢ 适应视图
          </button>
          <button type="button" className="btn" onClick={copyLink} title="复制分享链接">
            复制链接
          </button>
          <button type="button" className="btn" onClick={resetParams} title="恢复默认参数">
            ⟲ 复位
          </button>
        </div>

        <div className="export-drop" ref={exportRef}>
          <button type="button" className="btn primary" disabled={busy} onClick={() => setExportOpen((o) => !o)} title="下载刀模图">
            {busy ? '下载中…' : '下载'} ▾
          </button>
          {exportOpen && (
            <div className="export-menu" role="menu">
              <label className="export-check" title="勾选后下载文件包含尺寸标注；具体内容跟随顶栏「整体尺寸 / 各面尺寸」开关">
                <input type="checkbox" checked={withDims} onChange={(e) => setWithDims(e.target.checked)} />
                带尺寸标注
              </label>
              <div className="export-sep" />
              <button type="button" role="menuitem" onClick={() => pickExport('svg')}>
                SVG 矢量图
              </button>
              <button type="button" role="menuitem" onClick={() => pickExport('dxf')}>
                DXF CAD 图
              </button>
              <button type="button" role="menuitem" onClick={() => pickExport('pdf')}>
                PDF 文档
              </button>
              <button type="button" role="menuitem" onClick={() => pickExport('ai')}>
                AI Illustrator
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="main">
        <aside className="side">
          <div className="side-top">
            <div className="side-title">盒型库</div>
            <select className="box-select" value={boxId} onChange={(e) => setBox(e.target.value)} title="选择盒型">
              {Object.entries(
                REGISTRY.reduce<Record<string, typeof REGISTRY>>((acc, b) => {
                  (acc[b.category] ??= []).push(b);
                  return acc;
                }, {}),
              ).map(([cat, boxes]) => (
                <optgroup key={cat} label={cat}>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <ParamPanel />
          <InfoPanel result={result} />
        </aside>
        {view === '2d' ? (
          <CanvasView result={result} fitSignal={fitSignal} />
        ) : (
          <Suspense fallback={<div className="three-loading">加载 3D 模块…</div>}>
            <Three3DView result={result} />
          </Suspense>
        )}
      </div>

      <footer className="statusbar">
        <span className="legend">
          <i className="lg cut" /> 裁切线
          <i className="lg crease" /> 压痕线
        </span>
        <span className="disclaimer">⚠ 尺寸/结构仅供参考，正式刀模请以工厂建议为准</span>
        <span className="stat">
          {result.meta.unfold.w.toFixed(0)} × {result.meta.unfold.h.toFixed(0)} mm
        </span>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
