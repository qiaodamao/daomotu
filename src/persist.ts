/**
 * 持久化：URL 查询串同步（分享链接）+ localStorage 自动保存/恢复
 *
 * URL 压缩策略：只序列化与默认值的差异，短键名平铺——
 *   默认状态：https://dm.shijuefuhao.com/（无 query）
 *   改了长宽：?L=440&gf=35
 *   换盒型：?box=book-box&L=300（盒型为默认时可省略）
 * 旧版完整 JSON 格式（?box=xx&p=<encoded JSON>）仍兼容读取
 */
import { BoxParams, DEFAULT_PARAMS, SizeType } from './engine/params';
import { DEFAULT_BOX_ID, REGISTRY } from './engine/registry';

const LS_KEY = 'daomotu:v1';
const VALID_BOX_IDS = new Set(REGISTRY.map((b) => b.id));

/** URL 短键 ↔ 参数字段映射 */
const SHORT_KEYS: Record<string, keyof BoxParams> = {
  st: 'sizeType',
  mt: 'material',
  L: 'L',
  W: 'W',
  H: 'H',
  t: 't',
  gf: 'glueFlap',
  sl: 'slot',
  cf: 'chamfer',
  fg: 'flapGap',
  tg: 'tongue',
  lh: 'lidH',
  cl: 'clearance',
  ww: 'winW',
  wh: 'winH',
  hw: 'handleW',
  hh: 'handleH',
};
const ST_SHORT: Record<SizeType, string> = { inner: 'i', make: 'm', outer: 'o' };
const ST_EXPAND: Record<string, SizeType> = { i: 'inner', m: 'make', o: 'outer' };

function clampParams(p: Partial<BoxParams>): BoxParams {
  const out = { ...DEFAULT_PARAMS, ...p };
  // 数值字段清洗
  for (const k of ['L', 'W', 'H', 't', 'glueFlap', 'slot', 'chamfer', 'flapGap', 'tongue', 'lidH', 'clearance'] as const) {
    const v = out[k] as number;
    if (typeof v !== 'number' || !isFinite(v) || v < 0) (out[k] as number) = DEFAULT_PARAMS[k];
  }
  if (out.sizeType !== 'inner' && out.sizeType !== 'make' && out.sizeType !== 'outer') out.sizeType = 'make';
  return out;
}

export interface SavedState {
  boxId: string;
  params: BoxParams;
}

/** 从 URL 读取（无则读 localStorage，再无则 null → 用默认值） */
export function initState(): SavedState | null {
  try {
    const q = new URLSearchParams(location.search);
    const boxParam = q.get('box');
    const pParam = q.get('p');
    const hasShort = [...q.keys()].some((k) => k in SHORT_KEYS);
    if (boxParam || pParam || hasShort) {
      let params: BoxParams;
      if (pParam) {
        // 旧版完整 JSON 格式
        params = clampParams(JSON.parse(pParam));
      } else {
        params = { ...DEFAULT_PARAMS };
        for (const [sk, key] of Object.entries(SHORT_KEYS)) {
          const raw = q.get(sk);
          if (raw == null) continue;
          if (key === 'sizeType') {
            params.sizeType = ST_EXPAND[raw] ?? 'make';
          } else if (key === 'material') {
            params.material = raw;
          } else {
            const n = parseFloat(raw);
            if (isFinite(n)) (params as unknown as Record<string, unknown>)[key] = n;
          }
        }
        params = clampParams(params);
      }
      const boxId = boxParam && VALID_BOX_IDS.has(boxParam) ? boxParam : DEFAULT_BOX_ID;
      return { boxId, params };
    }
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as SavedState;
      return {
        boxId: VALID_BOX_IDS.has(s.boxId) ? s.boxId : DEFAULT_BOX_ID,
        params: clampParams(s.params),
      };
    }
  } catch (err) {
    /* 损坏数据 → 忽略，回退默认 */
    console.error('initState failed:', err);
  }
  return null;
}

/** 同步到 URL（replaceState 不产生历史记录；仅写差异，默认状态无 query） */
export function syncURL(boxId: string, params: BoxParams) {
  try {
    const q = new URLSearchParams();
    if (boxId !== DEFAULT_BOX_ID) q.set('box', boxId);
    for (const [sk, key] of Object.entries(SHORT_KEYS)) {
      const v = params[key];
      if (v === DEFAULT_PARAMS[key]) continue;
      if (key === 'sizeType') q.set(sk, ST_SHORT[v as SizeType]);
      else q.set(sk, String(v));
    }
    const s = q.toString();
    history.replaceState(null, '', s ? `?${s}` : location.pathname);
  } catch {
    /* 忽略（如 file:// 协议） */
  }
}

/** 保存到 localStorage（debounce 由调用方控制） */
export function saveLocal(boxId: string, params: BoxParams) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ boxId, params }));
  } catch {
    /* 存储满/隐私模式 → 忽略 */
  }
}
