/**
 * 盒型缩略图：用几何引擎以默认参数离线渲染 2D 刀版轮廓（暗底展品用）
 * 宽度随容器自适应（CSS 定宽 100% + aspect-ratio），ResizeObserver 保持清晰
 */
import { useEffect, useRef } from 'react';
import { boxDefaults, getBuilder } from '../engine/registry';
import { bbox } from '../engine/types';

interface Props {
  boxId: string;
  /** 逻辑宽高比（w/h），与 CSS aspect-ratio 保持一致 */
  ratio?: number;
}

export function BoxThumb({ boxId, ratio = 1.6 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const render = () => {
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const w = cv.clientWidth || 240;
      const h = w / ratio;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const result = getBuilder(boxId).build(boxDefaults(boxId));
      const bb = bbox(result.entities);
      const bw = Math.max(bb.max.x - bb.min.x, 1);
      const bh = Math.max(bb.max.y - bb.min.y, 1);
      const m = 14;
      const s = Math.min((w - 2 * m) / bw, (h - 2 * m) / bh);
      const ox = (w - bw * s) / 2 - bb.min.x * s;
      const oy = (h - bh * s) / 2 - bb.min.y * s;
      const pt = (x: number, y: number): [number, number] => [x * s + ox, y * s + oy];

      ctx.lineCap = 'round';
      // 先压痕（青虚线）后裁切（白实线）
      for (const pass of ['crease', 'cut'] as const) {
        const ents = result.entities.filter((e) => e.layer === pass);
        if (!ents.length) continue;
        if (pass === 'crease') {
          ctx.strokeStyle = 'rgba(80, 227, 194, 0.8)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        for (const e of ents) {
          if (e.kind === 'line') {
            const [ax, ay] = pt(e.a.x, e.a.y);
            const [bx, by] = pt(e.b.x, e.b.y);
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
          } else if (e.kind === 'circle') {
            const [cx, cy] = pt(e.c.x, e.c.y);
            ctx.moveTo(cx + e.r * s, cy);
            ctx.arc(cx, cy, e.r * s, 0, Math.PI * 2);
          } else if (e.kind === 'arc') {
            const [cx, cy] = pt(e.c.x, e.c.y);
            ctx.arc(cx, cy, e.r * s, (e.a0 * Math.PI) / 180, (e.a1 * Math.PI) / 180);
          }
        }
        ctx.stroke();
      }
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [boxId, ratio]);

  return <canvas ref={ref} className="box-thumb" style={{ aspectRatio: String(ratio) }} aria-hidden />;
}
