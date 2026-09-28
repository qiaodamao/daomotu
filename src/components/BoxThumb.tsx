/**
 * 盒型缩略图：用几何引擎以默认参数离线渲染 2D 刀版轮廓（暗底展品用）
 */
import { useEffect, useRef } from 'react';
import { DEFAULT_PARAMS } from '../engine/params';
import { getBuilder } from '../engine/registry';
import { bbox } from '../engine/types';

interface Props {
  boxId: string;
  width?: number;
  height?: number;
}

export function BoxThumb({ boxId, width = 240, height = 150 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const result = getBuilder(boxId).build(DEFAULT_PARAMS);
    const bb = bbox(result.entities);
    const bw = Math.max(bb.max.x - bb.min.x, 1);
    const bh = Math.max(bb.max.y - bb.min.y, 1);
    const m = 14;
    const s = Math.min((width - 2 * m) / bw, (height - 2 * m) / bh);
    const ox = (width - bw * s) / 2 - bb.min.x * s;
    const oy = (height - bh * s) / 2 - bb.min.y * s;
    const pt = (x: number, y: number): [number, number] => [x * s + ox, y * s + oy];

    ctx.lineCap = 'round';
    // 先压痕（蓝虚线）后裁切（白实线）
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
  }, [boxId, width, height]);

  return <canvas ref={ref} className="box-thumb" style={{ width, height }} aria-hidden />;
}
