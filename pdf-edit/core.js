import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export function selectionAt(layout, character) {
  const line = layout.lineAt(character);
  if (!line) return null;
  const segments = layout.segments(line);
  if (segments.length === 1) return line;
  if (!layout.charQuad(character)) return null;

  let start = character;
  let end = character + 1;
  while (start > line.start && layout.segments({ start: start - 1, count: end - start + 1 }).length === 1) {
    start--;
  }
  while (end < line.start + line.count && layout.segments({ start, count: end - start + 1 }).length === 1) {
    end++;
  }
  while (start < character && !layout.charQuad(start)) start++;
  while (end > character + 1 && !layout.charQuad(end - 1)) end--;
  return { start, count: end - start };
}

export async function prepareFont(engine, bytes) {
  const fontDocument = await PDFDocument.create();
  fontDocument.registerFontkit(fontkit);
  const font = await fontDocument.embedFont(bytes.slice(), { subset: true });
  await engine.fonts.register({ key: 'lumatek-noto-tc', data: bytes.slice() });
  return font;
}

export async function replaceLine(engine, bytes, pageIndex, selection, replacement, fontSize, font) {
  if (!Number.isFinite(fontSize) || fontSize < 4 || fontSize > 96) {
    throw new Error('字體大小必須介於 4 到 96。');
  }
  if (/[\r\n]/.test(replacement)) throw new Error('目前僅支援單行文字。');

  const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
  try {
    const { pages } = await doc.pages.list();
    const pageInfo = pages[pageIndex];
    if (!pageInfo) throw new Error('找不到所選頁面。');
    const page = doc.page(pageInfo.ref);
    const layout = await page.text.layout();
    const range = selectionAt(layout, selection.start);
    if (!range || range.start !== selection.start || range.count !== selection.count) {
      throw new Error('所選文字已改變，請重新選取。');
    }
    const text = await page.text.slice(range);
    if (text !== selection.text) throw new Error('所選文字已改變，請重新選取。');
    const segments = layout.segments(range);
    if (segments.length !== 1 || segments[0].advance !== 1) {
      throw new Error('此段文字的方向或排版目前不支援編輯。');
    }
    const segment = segments[0];
    const quad = segment.quad;
    if (Math.abs(quad.upperLeft.y - quad.upperRight.y) > 0.1 ||
        Math.abs(quad.upperLeft.x - quad.lowerLeft.x) > 0.1) {
      throw new Error('傾斜或直排文字目前不支援編輯。');
    }
    const rect = segment.rect;
    const availableWidth = pageInfo.size.width - rect.x;
    const textWidth = replacement ? font.widthOfTextAtSize(replacement, fontSize) : 0;
    if (textWidth + 8 > availableWidth) {
      throw new Error('新文字超出頁面寬度，請縮小字體或縮短文字。');
    }
    if (replacement) {
      const { missingCharacters } = await doc.fonts.resolve({
        runs: [{ text: replacement, fontFamily: 'lumatek-noto-tc' }],
      });
      if (missingCharacters.length) {
        throw new Error(`字型不支援這些字元：${missingCharacters.join(' ')}`);
      }
    }
    const mark = await page.annotations.create({ subtype: 'redact', quadPoints: [quad] });
    const applied = await doc.redaction.apply({ annotations: [mark.annotation.ref] });
    if (applied.results[0]?.status !== 'applied') {
      throw new Error('無法移除原文字，未套用修改。');
    }
    if (replacement) {
      const { annotation, meta } = await page.annotations.create({
        subtype: 'free-text',
        box: { x: rect.x, y: rect.y, width: Math.min(availableWidth, Math.max(rect.width, textWidth + 8)), height: Math.max(rect.height, fontSize * 1.6) },
        contents: replacement,
        fontFamily: 'lumatek-noto-tc',
        fontSize,
        strokeWidth: 0,
      });
      if (meta.missingCharacters?.length) throw new Error('新文字包含字型不支援的字元。');
      const flattened = await page.annotations.flatten([annotation.ref]);
      if (flattened.results[0]?.status !== 'applied') throw new Error('無法寫入新文字，未套用修改。');
    }
    return await doc.download({ mode: 'rewrite' });
  } finally {
    await doc.close();
  }
}
