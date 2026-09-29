/**
 * 首页落地页：Apple 风格 tile 体系（黑导航 / Hero / 功能 / 盒型展品 / 流程 / FAQ / 页脚）
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoxThumb } from '../components/BoxThumb';
import { REGISTRY } from '../engine/registry';
import '../landing.css';

const FAQS: { q: string; a: string }[] = [
  {
    q: '有没有免费的纸盒设计软件？',
    a: '刀模图生成器完全免费在线使用，无需安装，电脑和手机浏览器都可以直接开始设计。',
  },
  {
    q: '可以在线生成纸盒刀版图吗？',
    a: '可以。输入纸盒长宽高和结构参数后，即可生成包含裁切线、压痕线的包装展开图，并进行 3D 折叠预览。',
  },
  {
    q: '手机可以做纸盒设计吗？',
    a: '可以使用手机浏览器打开，进行参数调整和 3D 预览；精确的刀版查看与导出建议使用电脑。',
  },
  {
    q: '导出的刀模图是什么格式？',
    a: '支持导出 SVG 矢量图、DXF CAD 图、PDF 文档和 AI（Illustrator）四种毫米尺寸的刀版图，下载时可选包含尺寸标注。',
  },
  {
    q: '我输入的尺寸会被上传到服务器吗？',
    a: '不会。所有刀版几何都在你的浏览器本地计算生成，不发送任何尺寸数据到服务器。',
  },
];

const FEATURES = [
  {
    title: '完全免费',
    desc: '全部功能免费开放，导出文件不带水印，无需注册登录。',
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 15h24v17H8z" />
        <path d="M20 12v23M8 21c4-6 8 0 12 0M20 21c4-6 8 0 12 0" />
        <path d="M20 12c-2-5-8-4-8 0s6 4 8 0zM20 12c2-5 8-4 8 0s-6 4-8 0z" />
      </svg>
    ),
  },
  {
    title: '本地计算',
    desc: '刀版几何全部在浏览器内生成，尺寸数据不出本机。',
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6l12 5v9c0 8-5 12.5-12 14.5C13 30.5 8 26 8 20v-9l12-5z" />
        <path d="M14.5 20l4 4 7-8" />
      </svg>
    ),
  },
  {
    title: '2D 刀版 + 3D 预览',
    desc: '裁切线与压痕线分层呈现，一键查看纸盒折叠成型效果。',
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6l13 7v14l-13 7-13-7V13l13-7z" />
        <path d="M7 13l13 7 13-7M20 20v14" />
      </svg>
    ),
  },
  {
    title: '四种专业格式',
    desc: 'SVG / DXF / PDF / AI 一键导出，支持带尺寸标注。',
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6v18m0 0l-7-7m7 7l7-7" />
        <path d="M8 26v6h24v-6" />
      </svg>
    ),
  },
];

// 落地页展示用：把注册表里近义的分类名合并成四大类
const CAT_ALIAS: Record<string, string> = {
  折叠纸盒: '折叠纸盒（卡纸/彩盒）',
  '礼盒 / 折叠纸盒': '礼盒 / 组合结构',
};

export default function Landing() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  // .landing 本身是滚动容器（overflow-y:auto），监听须挂它而非 window
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const cats = REGISTRY.reduce<Record<string, typeof REGISTRY>>((acc, b) => {
    const cat = CAT_ALIAS[b.category] ?? b.category;
    (acc[cat] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="landing" ref={scrollRef}>
      {/* 全局导航（纯黑） */}
      <nav className="gnav">
        <div className="gnav-inner">
          <Link className="gnav-brand" to="/">
            <img src="/logo.svg" alt="" width="18" height="18" />
            <span>刀模图生成器</span>
          </Link>
          <div className="gnav-links">
            <a href="#features">功能</a>
            <a href="#boxes">盒型库</a>
            <a href="#flow">使用流程</a>
            <a href="#faq">常见问题</a>
          </div>
          <Link className="gnav-cta" to="/editor">
            进入编辑器
          </Link>
        </div>
      </nav>

      {/* Hero（白底 + mesh 渐变，全页唯一装饰系统） */}
      <header className="tile hero">
        <div className="hero-mesh" aria-hidden />
        <div className="hero-inner">
          <h1>刀模图，三分钟出稿。</h1>
          <p className="hero-lead">
            输入长宽高，即刻得到 {REGISTRY.length} 种常见纸盒纸箱的生产级刀版展开图与 3D 折叠预览，
            一键导出 SVG / DXF / PDF / AI。免费、无需安装、本地计算。
          </p>
          <div className="hero-ctas">
            <Link className="pill primary" to="/editor">
              免费进入编辑器
            </Link>
            <a className="pill ghost" href="#boxes">
              浏览盒型库
            </a>
          </div>
        </div>
      </header>

      {/* 功能介绍（parchment tile） */}
      <section className="tile white" id="features">
        <div className="wrap-narrow">
          <span className="eyebrow">功能特性</span>
          <h2>为包装设计与打样而生</h2>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 盒型库（深色展品 tile） */}
      <section className="tile dark" id="boxes">
        <div className="wrap">
          <span className="eyebrow">盒型库</span>
          <h2>{REGISTRY.length} 种盒型，点开即改</h2>
          <p className="tile-sub">每一种都是经过验证的结构模板，点击任意盒型直接进入编辑器。</p>
          {Object.entries(cats).map(([cat, boxes]) => (
            <div className="box-cat" key={cat}>
              <h3 className="box-cat-title">{cat}</h3>
              <div className="box-grid">
                {boxes.map((b) => (
                  <Link className="box-card" key={b.id} to={`/editor?box=${b.id}`}>
                    <BoxThumb boxId={b.id} />
                    <span className="box-name">{b.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 使用流程（白色 tile） */}
      <section className="tile" id="flow">
        <div className="wrap-narrow">
          <span className="eyebrow">使用流程</span>
          <h2>三步完成</h2>
          <ol className="flow-list">
            <li>
              <span className="flow-no">1</span>
              <div>
                <h3>选择盒型</h3>
                <p>从瓦楞箱、飞机盒、卡纸盒、礼盒等 {REGISTRY.length} 种结构中选一个起点。</p>
              </div>
            </li>
            <li>
              <span className="flow-no">2</span>
              <div>
                <h3>调整参数</h3>
                <p>输入内尺寸、制造尺寸或外尺寸，刀版与 3D 效果实时更新。</p>
              </div>
            </li>
            <li>
              <span className="flow-no">3</span>
              <div>
                <h3>下载交付</h3>
                <p>导出带尺寸标注的刀模图，直接对接印刷与模切打样。</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* FAQ（hairline 卡片列表） */}
      <section className="tile white" id="faq">
        <div className="wrap-narrow">
          <span className="eyebrow">常见问题</span>
          <h2>你可能想问</h2>
          <div className="faq-list">
            {FAQS.map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="cta-band">
        <h2>现在就画出你的第一个盒子。</h2>
        <Link className="pill primary" to="/editor">
          免费开始
        </Link>
      </section>

      {/* 页脚 */}
      <footer className="landing-footer">
        <div className="wrap-narrow">
          <div className="footer-links">
            <Link to="/editor">进入编辑器</Link>
            <a href="#features">功能介绍</a>
            <a href="#boxes">盒型库</a>
            <a href="#faq">常见问题</a>
          </div>
          <p className="footer-legal">
            尺寸与结构仅供参考，正式刀模请以工厂建议为准。所有计算在你的浏览器本地完成。
          </p>
          <p className="footer-legal">© 2026 视觉符号 · 刀模图生成器</p>
        </div>
      </footer>

      {/* 返回顶部 */}
      <button
        type="button"
        className={`to-top${showTop ? ' show' : ''}`}
        title="返回顶部"
        aria-label="返回顶部"
        aria-hidden={!showTop}
        tabIndex={showTop ? 0 : -1}
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
