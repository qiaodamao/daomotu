/**
 * 全局状态（Zustand）：当前盒型 + 参数 + 视图选项
 * 几何结果在组件内 useMemo 派生（build 是纯函数，<1ms）
 */
import { create } from 'zustand';
import { BoxParams, DEFAULT_PARAMS, MATERIALS } from './engine/params';
import { DEFAULT_BOX_ID, getBuilder } from './engine/registry';
import { initState } from './persist';

const MATERIAL_T: Record<string, number> = Object.fromEntries(MATERIALS.map((m) => [m.id, m.t]));

// 模块加载时即从 URL / localStorage 恢复——store 创建即是正确状态，
// 避免 App 首轮 render 用默认参数触发 syncURL 清掉 URL query
const initial = initState() ?? { boxId: DEFAULT_BOX_ID, params: { ...DEFAULT_PARAMS } };

interface AppState {
  boxId: string;
  params: BoxParams;
  showDim: boolean;
  showFaceDim: boolean;
  printMode: boolean;
  setBox: (id: string) => void;
  setParam: <K extends keyof BoxParams>(key: K, value: BoxParams[K]) => void;
  resetParams: () => void;
  toggleDim: () => void;
  toggleFaceDim: () => void;
  togglePrint: () => void;
}

export const useStore = create<AppState>((set) => ({
  boxId: initial.boxId,
  params: { ...initial.params },
  showDim: true,
  showFaceDim: true,
  printMode: false,

  setBox: (id) => set({ boxId: getBuilder(id).id }),

  setParam: (key, value) =>
    set((s) => {
      const params = { ...s.params, [key]: value };
      // 材质切换时同步纸厚（自定义除外）
      if (key === 'material' && value !== 'custom') {
        const t = MATERIAL_T[value as string];
        if (t) params.t = t;
      }
      return { params };
    }),

  resetParams: () => set({ params: { ...DEFAULT_PARAMS }, boxId: DEFAULT_BOX_ID }),

  toggleDim: () => set((s) => ({ showDim: !s.showDim })),
  toggleFaceDim: () => set((s) => ({ showFaceDim: !s.showFaceDim })),
  togglePrint: () => set((s) => ({ printMode: !s.printMode })),
}));
