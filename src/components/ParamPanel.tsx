/**
 * 参数面板：按 builder.fields 声明式渲染（分组 / 条件显隐）
 */
import { useEffect, useMemo, useState } from 'react';
import { BoxParams, FieldSpec } from '../engine/params';
import { getBuilder } from '../engine/registry';
import { useStore } from '../store';

export function ParamPanel() {
  const boxId = useStore((s) => s.boxId);
  const params = useStore((s) => s.params);
  const setParam = useStore((s) => s.setParam);
  const builder = getBuilder(boxId);

  const groups = useMemo(() => {
    const map = new Map<string, FieldSpec[]>();
    for (const f of builder.fields) {
      if (f.when && !f.when(params)) continue;
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return [...map.entries()];
  }, [builder, params]);

  return (
    <div className="param-panel">
      <div className="param-head">
        <span className="param-title">{builder.name}</span>
        <span className="param-cat">{builder.category}</span>
      </div>
      {groups.map(([group, fields]) => (
        <section key={group} className="param-group">
          <h4>{group}</h4>
          <div className="param-rows">
            {fields.map((f) => (
              <FieldRow key={String(f.key)} spec={f} params={params} onChange={(v) => setParam(f.key, v as never)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldRow({ spec, params, onChange }: { spec: FieldSpec; params: BoxParams; onChange: (v: string | number) => void }) {
  const value = params[spec.key];
  return (
    <div className="field-row">
      <label className="field-label">{spec.label}</label>
      {spec.type === 'number' && <NumberField spec={spec} value={Number(value)} onChange={onChange} />}
      {spec.type === 'select' && (
        <select className="field-select" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {spec.type === 'segment' && (
        <div className="segment">
          {spec.options?.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`seg-btn ${String(value) === o.value ? 'active' : ''}`}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 数字输入：草稿字符串避免中间态解析问题（支持外部 reset 同步） */
function NumberField({ spec, value, onChange }: { spec: FieldSpec; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <span className="field-number">
      <input
        type="number"
        value={draft}
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseFloat(e.target.value);
          if (isFinite(v)) onChange(v);
        }}
      />
      {spec.unit && <em className="unit">{spec.unit}</em>}
    </span>
  );
}
