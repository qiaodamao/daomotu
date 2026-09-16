/** 通用文件下载工具 */

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 生成导出文件名：视觉符号-0201_434x214x278.svg / 视觉符号-book-box_…（统一"视觉符号"前缀） */
export function exportName(boxId: string, l: number, w: number, h: number, ext: string): string {
  const id = boxId.replace(/^fefco-/, '');
  return `视觉符号-${id}_${Math.round(l)}x${Math.round(w)}x${Math.round(h)}.${ext}`;
}
