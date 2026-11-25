import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, degrees, rgb, setTextRenderingMode, TextRenderingMode } from 'pdf-lib';
import { localEngine } from '@embedpdf/engine';
import { characterAt, prepareFont, replaceLine, selectionAt } from './core.js';
import { readTextColor } from './color.js';

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
    const selection = { ...range, text, character: range.start };
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

test('selects and replaces a separated text segment without removing its neighbor', async () => {
  const original = await PDFDocument.create();
  const page = original.addPage([600, 800]);
  page.drawText('API URL', { x: 50, y: 400, size: 14 });
  page.drawText('https://example.test', { x: 150, y: 400, size: 14 });
  const bytes = await original.save();
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const font = await prepareFont(engine, new Uint8Array(await readFile(new URL('./NotoSansTC.ttf', import.meta.url))));
    const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    let selection;
    try {
      const { pages } = await doc.pages.list();
      const source = doc.page(pages[0].ref);
      const layout = await source.text.layout();
      assert.equal(layout.segments(layout.lineAt(0)).length, 2);
      const first = selectionAt(layout, 0);
      assert.equal(await source.text.slice(first), 'API URL');
      const second = selectionAt(layout, 10);
      const text = await source.text.slice(second);
      assert.equal(text, 'https://example.test');
      assert.deepEqual(selectionAt(layout, second.start + second.count - 1), second);
      selection = { ...second, text, character: second.start };
    } finally {
      await doc.close();
    }
    const result = await replaceLine(engine, bytes, 0, selection, 'https://new.test', 14, font);
    const output = await engine.open({ kind: 'bytes', bytes: result.slice() });
    try {
      const { pages } = await output.pages.list();
      const text = (await output.page(pages[0].ref).text.get()).text;
      assert.match(text, /API URL/);
      assert.match(text, /https:\/\/new\.test/);
      assert.doesNotMatch(text, /https:\/\/example\.test/);
    } finally {
      await output.close();
    }
  } finally {
    await engine.destroy();
  }
});

test('selects horizontal text where a diagonal watermark overlaps it', async () => {
  const original = await PDFDocument.create();
  const page = original.addPage([600, 800]);
  page.drawText('Text under watermark', { x: 150, y: 400, size: 14 });
  page.drawText('WATERMARK', { x: 100, y: 320, size: 100, rotate: degrees(45), opacity: 0.25 });
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const doc = await engine.open({ kind: 'bytes', bytes: await original.save() });
    try {
      const { pages } = await doc.pages.list();
      const source = doc.page(pages[0].ref);
      const layout = await source.text.layout();
      const line = layout.lineAt(0);
      let overlaps = 0;
      for (let i = line.start; i < line.start + line.count; i++) {
        const quad = layout.charQuad(i);
        if (!quad) continue;
        for (const x of [0.05, 0.5, 0.95]) {
          for (const y of [0.05, 0.5, 0.95]) {
            const point = {
              x: quad.upperLeft.x + (quad.upperRight.x - quad.upperLeft.x) * x,
              y: quad.upperLeft.y + (quad.lowerLeft.y - quad.upperLeft.y) * y,
            };
            const originalHit = layout.charAt(point);
            if (originalHit === null || originalHit < line.start + line.count) continue;
            overlaps++;
            const hit = characterAt(layout, point);
            assert.deepEqual(selectionAt(layout, hit), line);
          }
        }
      }
      assert.ok(overlaps > 0, 'fixture must contain points originally captured by the watermark');
      const watermark = layout.charQuad(layout.charCount - 1);
      const watermarkPoint = {
        x: (watermark.upperLeft.x + watermark.lowerRight.x) / 2,
        y: (watermark.upperLeft.y + watermark.lowerRight.y) / 2,
      };
      assert.ok(characterAt(layout, watermarkPoint) >= line.start + line.count);
    } finally {
      await doc.close();
    }
  } finally {
    await engine.destroy();
  }
});

test('writes the selected Public Sans weight and rejects unsupported characters', async () => {
  const original = await PDFDocument.create();
  original.addPage().drawText('Original', { x: 50, y: 400, size: 12 });
  const bytes = await original.save();
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    let selection;
    try {
      const { pages } = await doc.pages.list();
      const page = doc.page(pages[0].ref);
      const range = (await page.text.layout()).lineAt(0);
      selection = { ...range, text: await page.text.slice(range), character: range.start };
    } finally {
      await doc.close();
    }
    for (const [style, weight] of [['Regular', 400], ['Medium', 500], ['SemiBold', 600], ['Bold', 700]]) {
      const fontBytes = await readFile(new URL(`./PublicSans-${style}.ttf`, import.meta.url));
      const font = await prepareFont(engine, new Uint8Array(fontBytes), `public-${style}`, weight);
      const output = await replaceLine(engine, bytes, 0, selection, 'Replacement', 12, font);
      const saved = await engine.open({ kind: 'bytes', bytes: output.slice() });
      try {
        const { pages } = await saved.pages.list();
        assert.match((await saved.page(pages[0].ref).text.get()).text, /Replacement/);
        assert.ok((await saved.fonts.list()).fonts.some((entry) =>
          entry.source === 'document' && entry.familyName === 'Public Sans' && entry.weight === weight));
      } finally {
        await saved.close();
      }
      if (style === 'Regular') {
        await assert.rejects(replaceLine(engine, bytes, 0, selection, '中文', 12, font), /不支援/);
      }
    }
  } finally {
    await engine.destroy();
  }
});

test('preserves clicked text color and opacity after replacement', async () => {
  const original = await PDFDocument.create();
  const page = original.addPage();
  page.drawText('Original', { x: 50, y: 400, size: 14, color: rgb(0.2, 0.4, 0.8), opacity: 0.6 });
  const bytes = await original.save();
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const font = await prepareFont(engine, new Uint8Array(await readFile(new URL('./NotoSansTC.ttf', import.meta.url))));
    const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    let selection;
    try {
      const { pages } = await doc.pages.list();
      const page = doc.page(pages[0].ref);
      const range = (await page.text.layout()).lineAt(0);
      selection = { ...range, text: await page.text.slice(range), character: range.start };
    } finally {
      await doc.close();
    }
    const output = await replaceLine(engine, bytes, 0, selection, 'Replacement', 14, font);
    const saved = await engine.open({ kind: 'bytes', bytes: output.slice() });
    try {
      const { pages } = await saved.pages.list();
      const page = saved.page(pages[0].ref);
      const layout = await page.text.layout();
      const range = layout.lineAt(0);
      const text = await page.text.slice({ start: range.start, count: 1 });
      assert.deepEqual(await readTextColor(output, 0, range.start, layout.charCount, text), {
        fontColor: '#3366cc',
        opacity: 0.6,
      });
    } finally {
      await saved.close();
    }
    await assert.rejects(readTextColor(bytes, 0, 0, 999, 'O'), /重新選取/);
  } finally {
    await engine.destroy();
  }
});

test('uses the clicked character color when a line contains multiple colors', async () => {
  const original = await PDFDocument.create();
  const page = original.addPage();
  page.drawText('Red', { x: 50, y: 400, size: 14, color: rgb(1, 0, 0) });
  page.drawText('Blue', { x: 72, y: 400, size: 14, color: rgb(0, 0, 1) });
  const bytes = await original.save();
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const font = await prepareFont(engine, new Uint8Array(await readFile(new URL('./NotoSansTC.ttf', import.meta.url))));
    const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    let selection;
    try {
      const { pages } = await doc.pages.list();
      const page = doc.page(pages[0].ref);
      const layout = await page.text.layout();
      let character = null;
      for (let i = 0; i < layout.charCount; i++) {
        if (await page.text.slice({ start: i, count: 1 }) === 'B') {
          character = i;
          break;
        }
      }
      assert.notEqual(character, null);
      const range = selectionAt(layout, character);
      selection = { ...range, character, text: await page.text.slice(range) };
    } finally {
      await doc.close();
    }
    const output = await replaceLine(engine, bytes, 0, selection, 'Replacement', 14, font);
    const saved = await engine.open({ kind: 'bytes', bytes: output.slice() });
    try {
      const { pages } = await saved.pages.list();
      const page = saved.page(pages[0].ref);
      const layout = await page.text.layout();
      const range = layout.lineAt(0);
      const text = await page.text.slice({ start: range.start, count: 1 });
      assert.deepEqual(await readTextColor(output, 0, range.start, layout.charCount, text), {
        fontColor: '#0000ff', opacity: 1,
      });
    } finally {
      await saved.close();
    }
  } finally {
    await engine.destroy();
  }
});

test('rejects outlined text instead of silently applying the wrong color', async () => {
  const original = await PDFDocument.create();
  const page = original.addPage();
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Outline));
  page.drawText('Outlined', { x: 50, y: 400, size: 14 });
  const bytes = await original.save();
  const engine = localEngine({ defaultFallbackFonts: false, runtime: { prefer: 'wasm' } });
  try {
    const font = await prepareFont(engine, new Uint8Array(await readFile(new URL('./NotoSansTC.ttf', import.meta.url))));
    const doc = await engine.open({ kind: 'bytes', bytes: bytes.slice() });
    let selection;
    try {
      const { pages } = await doc.pages.list();
      const page = doc.page(pages[0].ref);
      const range = (await page.text.layout()).lineAt(0);
      selection = { ...range, text: await page.text.slice(range), character: range.start };
    } finally {
      await doc.close();
    }
    await assert.rejects(replaceLine(engine, bytes, 0, selection, 'Replacement', 14, font), /不支援自動套用顏色/);
  } finally {
    await engine.destroy();
  }
});
