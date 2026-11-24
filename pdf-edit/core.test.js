import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { localEngine } from '@embedpdf/engine';
import { prepareFont, replaceLine } from './core.js';

test('replaces page text and rewrites the PDF without losing other lines', async () => {
  const original = await PDFDocument.create();
  const page = original.addPage();
  page.drawText('Original sentence', { x: 50, y: 700, size: 14 });
  page.drawText('Keep this sentence', { x: 50, y: 650, size: 14 });
  const bytes = await original.save();
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const font = await prepareFont(engine, new Uint8Array(await readFile(new URL('./NotoSansTC.ttf', import.meta.url))));
    const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    const { pages } = await doc.pages.list();
    const source = doc.page(pages[0].ref);
    const layout = await source.text.layout();
    const range = layout.lineAt(0);
    const text = await source.text.slice(range);
    assert.equal(text, 'Original sentence');
    await doc.close();
    const selection = { ...range, text };
    const result = await replaceLine(engine, bytes, 0, selection, '繁體中文 New', 14, font);
    const output = await engine.open({ kind: 'bytes', bytes: result.slice() });
    try {
      const { pages: savedPages } = await output.pages.list();
      const saved = await output.page(savedPages[0].ref).text.get();
      assert.match(saved.text, /繁體中文 New/);
      assert.match(saved.text, /Keep this sentence/);
      assert.doesNotMatch(saved.text, /Original sentence/);
    } finally {
      await output.close();
    }
    await assert.rejects(replaceLine(engine, bytes, 0, { ...selection, text: 'wrong' }, 'New', 14, font), /重新選取/);
    await assert.rejects(replaceLine(engine, bytes, 0, selection, 'New\nline', 14, font), /單行/);
    await assert.rejects(replaceLine(engine, bytes, 0, selection, 'W'.repeat(200), 14, font), /頁面寬度/);
    await assert.rejects(replaceLine(engine, bytes, 0, selection, '🚀', 14, font), /不支援/);
    const deleted = await replaceLine(engine, bytes, 0, selection, '', 14, font);
    const withoutLine = await engine.open({ kind: 'bytes', bytes: deleted.slice() });
    try {
      const { pages: deletedPages } = await withoutLine.pages.list();
      const remaining = await withoutLine.page(deletedPages[0].ref).text.get();
      assert.doesNotMatch(remaining.text, /Original sentence/);
      assert.match(remaining.text, /Keep this sentence/);
    } finally {
      await withoutLine.close();
    }
    const again = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    try {
      const { pages: originalPages } = await again.pages.list();
      assert.match((await again.page(originalPages[0].ref).text.get()).text, /Original sentence/);
    } finally {
      await again.close();
    }
  } finally {
    await engine.destroy();
  }
});
