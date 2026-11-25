import { createPdfRuntime } from '@embedpdf/engine-runtime';
import wasmUrl from '@embedpdf/engine-runtime-wasm32/wasm-url';

let runtimePromise;

async function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = createPdfRuntime(typeof window === 'undefined' ? { prefer: 'wasm' } : { wasmUrl })
      .then((runtime) => {
        runtime.fn.EPDF_InitThread();
        return runtime;
      });
  }
  try {
    return await runtimePromise;
  } catch (error) {
    runtimePromise = undefined;
    throw error;
  }
}

export async function readTextColor(bytes, pageIndex, character, charCount, expectedText) {
  const { fn, mem } = await getRuntime();
  const data = mem.alloc(bytes.length);
  let doc;
  let page;
  let textPage;
  let values;
  try {
    mem.writeBytes(data, bytes);
    doc = fn.FPDF_LoadMemDocument64(data, bytes.length, '');
    if (!doc) throw new Error('無法開啟 PDF 以讀取原文字顏色。');
    page = fn.FPDF_LoadPage(doc, pageIndex);
    if (!page) throw new Error('無法讀取所選頁面的文字顏色。');
    textPage = fn.FPDFText_LoadPage(page);
    if (!textPage || fn.FPDFText_CountChars(textPage) !== charCount ||
        character < 0 || character >= charCount ||
        String.fromCodePoint(fn.FPDFText_GetUnicode(textPage, character)) !== expectedText) {
      throw new Error('無法確認所選文字的顏色，請重新選取。');
    }
    const object = fn.FPDFText_GetTextObject(textPage, character);
    if (!object || fn.FPDFTextObj_GetTextRenderMode(object) !== 0) {
      throw new Error('此文字的繪製方式不支援自動套用顏色。');
    }
    values = mem.alloc(16);
    if (!fn.FPDFText_GetFillColor(textPage, character, values, values + 4n, values + 8n, values + 12n)) {
      throw new Error('無法擷取原文字顏色。');
    }
    const rgba = [0, 4, 8, 12].map((offset) => mem.peek(values, 'i32', offset));
    if (rgba.some((value) => value < 0 || value > 255)) {
      throw new Error('擷取的原文字顏色無效。');
    }
    return {
      fontColor: `#${rgba.slice(0, 3).map((value) => value.toString(16).padStart(2, '0')).join('')}`,
      opacity: rgba[3] / 255,
    };
  } finally {
    if (values) mem.free(values);
    if (textPage) fn.FPDFText_ClosePage(textPage);
    if (page) fn.FPDF_ClosePage(page);
    if (doc) fn.FPDF_CloseDocument(doc);
    mem.free(data);
  }
}
