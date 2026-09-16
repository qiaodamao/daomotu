/**
 * 3D 预览视图：Three.js 场景 + 轨道相机 + 展开/闭合动画按钮
 * 场景一次性建立；面板树随 result 重建
 * 折叠分阶段顺序进行（围筒 → 摇盖 → 插舌），由 render3d.applyFold 的阶段窗口驱动
 * 进入 3D 预览时以展开态出现，自动播放一次闭合演示动画
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DielineResult } from '../engine/types';
import { applyFold, buildPanelTreeObject, disposeTree, foldedBox, groundModel, PanelModel } from '../render/render3d';

/** 展开闭合动画时长（ms）：分阶段顺序折叠需要足够时长看清波次推进 */
const ANIM_DUR = 2200;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function Three3DView({ result }: { result: DielineResult }) {
  const mountRef = useRef<HTMLDivElement>(null);
  // 初始展开态：进入 3D 预览自动播放一次闭合演示（展开 → 成型）
  const [fold, setFold] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);

  // 滑块/动画最新值（渲染循环读取，避免重建场景）
  const liveRef = useRef({ fold: 0 });
  liveRef.current = { fold: fold / 100 };

  // 展开/闭合动画：目标值 + 起始值 + 起始时刻（rAF 循环推进）
  const animRef = useRef<{ to: number; from: number; start: number } | null>(null);
  // 挂载生命周期内是否已播过进入演示（改参数不重播）
  const demoedRef = useRef(false);
  const startAnim = (to: number) => {
    if (Math.abs(liveRef.current.fold - to) < 1e-3) return;
    animRef.current = { to, from: liveRef.current.fold, start: performance.now() };
  };

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model: PanelModel | null;
  } | null>(null);

  // 初始化（一次）
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9');
    // 地面网格（地平线，比例感）：比落地基准 y=0 低 0.5mm，避免与盒底面共面闪烁
    const grid = new THREE.GridHelper(3000, 30, 0xd6dde8, 0xe8edf4);
    grid.position.y = -0.5;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 10000);
    camera.position.set(600, 700, 900);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(600, 900, 700);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.35);
    dir2.position.set(-500, 300, -600);
    scene.add(dir2);

    sceneRef.current = { renderer, scene, camera, controls, model: null };

    // 尺寸自适应
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // 渲染循环
    let raf = 0;
    const loop = (now: number) => {
      const s = sceneRef.current;
      if (s?.model) {
        // 展开/闭合动画：ease 推进 fold（滑块同步跟随）
        const anim = animRef.current;
        if (anim) {
          const t = Math.min((now - anim.start) / ANIM_DUR, 1);
          liveRef.current.fold = anim.from + (anim.to - anim.from) * easeInOutCubic(t);
          setFold(Math.round(liveRef.current.fold * 100));
          if (t >= 1) animRef.current = null;
        }
        applyFold(s.model, liveRef.current.fold);
        // 每帧落地锚定：各部件包围盒最低点贴 y=0，盒子始终在地平线上方
        groundModel(s.model);
      }
      controls.autoRotate = autoRotateRef.current;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (sceneRef.current?.model) disposeTree(sceneRef.current.model.root);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  // 面板树随 result 重建（改参数时；播放中的动画按 fold 值继续推进，不中断——
  // StrictMode 下 effect 双执行也会重建，动画保留才能让进入演示正常播放）
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    if (s.model) {
      s.scene.remove(s.model.root);
      disposeTree(s.model.root);
    }
    const model = buildPanelTreeObject(result.panels);
    s.scene.add(model.root);
    s.model = model;

    // 面板树首次就绪：自动播放闭合演示（展开 → 成型）；
    // 后续因改参数重建，保持当前折叠度不重播
    if (!demoedRef.current) {
      demoedRef.current = true;
      startAnim(1);
    }

    // 成型态 fit 相机
    const box = foldedBox(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.length() > 1) {
      const maxDim = Math.max(size.x, size.y, size.z);
      s.controls.target.copy(center);
      s.camera.position.copy(center).add(new THREE.Vector3(maxDim * 1.15, maxDim * 0.85, maxDim * 1.35));
      s.camera.near = Math.max(maxDim / 100, 0.5);
      s.camera.far = maxDim * 50;
      s.camera.updateProjectionMatrix();
      s.controls.update();
    }
  }, [result]);

  const expanded = fold < 50;

  return (
    <div className="canvas-wrap">
      <div ref={mountRef} className="three-mount" />
      <div className="view3d-ctrls">
        <button
          type="button"
          className={`btn small fold-btn ${expanded ? 'active' : ''}`}
          onClick={() => startAnim(0)}
        >
          ⇱ 展开
        </button>
        <button
          type="button"
          className={`btn small fold-btn ${expanded ? '' : 'active'}`}
          onClick={() => startAnim(1)}
        >
          ⇲ 闭合
        </button>
        <label className="ctrl">
          <span>折叠 {fold}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={fold}
            onChange={(e) => {
              animRef.current = null; // 手动拖动接管动画
              setFold(+e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className={`btn small ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate((v) => !v)}
        >
          自动旋转
        </button>
        <span className="ctrl-hint">拖拽旋转 · 滚轮缩放</span>
      </div>
    </div>
  );
}
