/** PDF 生成验证：用引擎输出直接生成 PDF，检查文件头与大小 */
import { writeFileSync } from 'fs';
import { DEFAULT_PARAMS } from '../engine/params';
import { getBuilder } from '../engine/registry';
import { toPDF } from '../export/pdf';

async function main() {
  const result = getBuilder('fefco-0201').build(DEFAULT_PARAMS);
  const bytes = await toPDF(result);

  const header = Buffer.from(bytes.slice(0, 5)).toString();
  const size = bytes.byteLength;
  console.log(`PDF header: ${header}`);
  console.log(`PDF size: ${size} bytes`);
  writeFileSync('pdf-check.tmp.pdf', bytes);

  if (header !== '%PDF-' || size < 1000) {
    console.error('FAIL: PDF 生成异常');
    process.exit(1);
  }
  console.log('PASS: PDF 生成正常');
}
main();
