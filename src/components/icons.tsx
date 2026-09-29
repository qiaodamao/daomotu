/**
 * 顶栏图标：移动端工具按钮收起为图标态时使用（桌面端靠 CSS 隐藏）。
 * 统一 16×16 线性图标，stroke 继承按钮文字色，禁用 text 字符当符号（字符基线会偏）。
 */
import type { ReactNode } from 'react';

type P = { className?: string };

const svg = (children: ReactNode, className?: string, sw = 1.5) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** 整体幅面尺寸：四角括框 + 横向双箭头 */
export const IcoOverall = ({ className }: P) =>
  svg(
    <>
      <path d="M2.6 6V2.6H6M10 2.6h3.4V6M13.4 10v3.4H10M6 13.4H2.6V10" />
      <path d="M5.2 8h5.6M6.6 6.6 5.2 8l1.4 1.4M9.4 6.6l1.4 1.4-1.4 1.4" />
    </>,
    className
  );

/** 各面尺寸：分成两格的面板，每格一个量尺短刻 */
export const IcoFace = ({ className }: P) =>
  svg(
    <>
      <rect x="2.6" y="3.6" width="10.8" height="8.8" rx="1" />
      <path d="M8 3.6v8.8M4.5 6.4h1.4M10.1 6.4h1.4" />
    </>,
    className
  );

/** 打印模式：打印机 */
export const IcoPrint = ({ className }: P) =>
  svg(
    <>
      <path d="M4.6 6V2.8h6.8V6" />
      <rect x="2.6" y="6" width="10.8" height="5.2" rx="1.4" />
      <path d="M5 11.2v2.2h6v-2.2" />
    </>,
    className
  );

/** 适应视图：对角括框 */
export const IcoFit = ({ className }: P) =>
  svg(
    <>
      <path d="M2.8 6.4V2.8h3.6M13.2 9.6v3.6H9.6" />
      <path d="M6.4 6.4 9.6 9.6M9.6 6.4 6.4 9.6" />
    </>,
    className
  );

/** 复制链接：链条 */
export const IcoLink = ({ className }: P) =>
  svg(
    <>
      <path d="M6.5 9.5 9.5 6.5" />
      <path d="M7.4 4.7 8.6 3.5a3 3 0 0 1 4.2 4.2l-1.2 1.2" />
      <path d="M8.6 11.3 7.4 12.5a3 3 0 0 1-4.2-4.2l1.2-1.2" />
    </>,
    className,
    1.4
  );

/** 复位：逆时针回转箭头 */
export const IcoReset = ({ className }: P) =>
  svg(
    <>
      <path d="M3.05 8a4.95 4.95 0 1 0 4.95-4.95 5.36 5.36 0 0 0-3.71 1.51L3.05 5.8" />
      <path d="M3.05 3.05v2.75h2.75" />
    </>,
    className,
    1.4
  );

/** 下拉箭头（下载菜单） */
export const IcoChevron = ({ className }: P) =>
  svg(
    <>
      <path d="M3.8 6.1 8 9.9l4.2-3.8" />
    </>,
    className,
    1.6
  );
