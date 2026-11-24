import { zipSync } from 'fflate';
import { protectPdf } from './pdf.js';

export async function processFiles(files, image, password, onProgress, watermarkOptions) {
  const outputs = [];
  const failures = [];
  const warnings = [];
  const names = new Set();

  for (const [index, file] of files.entries()) {
    onProgress(index + 1, files.length);
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('不是 PDF 檔案。');
      }
      const input = new Uint8Array(await file.arrayBuffer());
      const result = await protectPdf(input, image, password, watermarkOptions);
      const stem = file.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\.pdf$/i, '');
      let outputName = `${stem}_protected.pdf`;
      let suffix = 2;
      while (names.has(outputName.toLowerCase())) {
        outputName = `${stem}_protected (${suffix++}).pdf`;
      }
      names.add(outputName.toLowerCase());
      outputs.push({ name: outputName, bytes: result.output });
      warnings.push(...result.warnings.map((warning) => `${file.name}：${warning}`));
    } catch (error) {
      console.error(`處理 ${file.name} 失敗：`, error);
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({
        name: file.name,
        reason: reason.includes('encrypted') ? 'PDF 已加密，請先解除原有密碼。' : reason,
      });
    }
  }

  if (!outputs.length) return { output: null, failures, warnings, successCount: 0 };
  if (files.length === 1) {
    return {
      output: { ...outputs[0], type: 'application/pdf' },
      failures,
      warnings,
      successCount: outputs.length,
    };
  }

  const entries = Object.create(null);
  for (const output of outputs) entries[output.name] = output.bytes;
  return {
    output: { name: 'protected_pdfs.zip', bytes: zipSync(entries, { level: 0 }), type: 'application/zip' },
    failures,
    warnings,
    successCount: outputs.length,
  };
}
