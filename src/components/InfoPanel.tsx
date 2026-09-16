/**
 * 信息面板：尺寸换算表 + 展开信息 + 工艺校验警告
 */
import { useMemo } from 'react';
import { DielineResult } from '../engine/types';
import { sizeTable } from '../engine/params';
import { useStore } from '../store';

export function InfoPanel({ result }: { result: DielineResult }) {
  const t = useStore((s) => s.params.t);
  const { makeSize, unfold, areaM2, flaps, warnings } = result.meta;
  const table = useMemo(() => sizeTable(makeSize, t), [makeSize, t]);

  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

  return (
    <div className="info-panel">
      <section className="param-group">
        <h4>尺寸换算（纸厚 {fmt(t)}mm）</h4>
        <table className="size-table">
          <thead>
            <tr>
              <th></th>
              <th>长</th>
              <th>宽</th>
              <th>高</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>内尺寸</td>
              <td>{fmt(table.inner.l)}</td>
              <td>{fmt(table.inner.w)}</td>
              <td>{fmt(table.inner.h)}</td>
            </tr>
            <tr className="hl">
              <td>制造尺寸</td>
              <td>{fmt(table.make.l)}</td>
              <td>{fmt(table.make.w)}</td>
              <td>{fmt(table.make.h)}</td>
            </tr>
            <tr>
              <td>外尺寸</td>
              <td>{fmt(table.outer.l)}</td>
              <td>{fmt(table.outer.w)}</td>
              <td>{fmt(table.outer.h)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="param-group">
        <h4>展开信息</h4>
        <div className="kv">
          <span>展开幅面</span>
          <b>
            {fmt(unfold.w)} × {fmt(unfold.h)} mm
          </b>
        </div>
        <div className="kv">
          <span>毛面积</span>
          <b>{(Math.round(areaM2 * 100) / 100).toString()} m²</b>
        </div>
        {flaps && (
          <div className="kv">
            <span>摇盖 F1 / F2</span>
            <b>
              {fmt(flaps.f1)} / {fmt(flaps.f2)} mm
            </b>
          </div>
        )}
      </section>

      {warnings.length > 0 && (
        <section className="param-group">
          <h4>工艺提示</h4>
          <ul className="warnings">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
