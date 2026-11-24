import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, decodePDFRawStream, degrees } from 'pdf-lib';
import { createQpdf } from '@mssio/qpdf-wasm';
import { protectPdf } from '../src/pdf.js';

const png = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=',
  'base64',
));

test('adds a watermark to every page and requires the password', async () => {
  const original = await PDFDocument.create();
  original.addPage();
  original.addPage();
  const { output } = await protectPdf(await original.save(), png, '測試-password');
  const qpdf = await createQpdf();
  try {
    await assert.rejects(qpdf.decrypt(output.slice(), { password: 'wrong' }), { code: 'INVALID_PASSWORD' });
    const { output: decrypted } = await qpdf.decrypt(output.slice(), { password: '測試-password' });
    const document = await PDFDocument.load(decrypted);
    assert.equal(document.getPageCount(), 2);
    for (const page of document.getPages()) {
      assert.ok(page.node.Resources().lookup(PDFName.of('XObject')).keys().length > 0);
    }
  } finally {
    qpdf.terminate();
  }
});

test('rejects invalid PDFs', async () => {
  await assert.rejects(protectPdf(new Uint8Array([1, 2, 3]), png, 'password'));
});

test('adds only a watermark when the password is omitted', async () => {
  const original = await PDFDocument.create();
  original.addPage();
  original.addPage();
  const { output } = await protectPdf(await original.save(), png, '');
  const document = await PDFDocument.load(output);
  assert.equal(document.getPageCount(), 2);
  for (const page of document.getPages()) {
    assert.ok(page.node.Resources().lookup(PDFName.of('XObject')).keys().length > 0);
  }
});

test('adds only a password when the watermark is omitted', async () => {
  const original = await PDFDocument.create();
  original.addPage();
  const { output } = await protectPdf(await original.save(), null, 'password');
  const qpdf = await createQpdf();
  try {
    await assert.rejects(qpdf.decrypt(output.slice(), { password: 'wrong' }), { code: 'INVALID_PASSWORD' });
    const { output: decrypted } = await qpdf.decrypt(output, { password: 'password' });
    const document = await PDFDocument.load(decrypted);
    assert.equal(document.getPageCount(), 1);
    assert.equal(document.getPages()[0].node.Resources().lookup(PDFName.of('XObject')), undefined);
  } finally {
    qpdf.terminate();
  }
});

test('requires at least one protection option', async () => {
  const original = await PDFDocument.create();
  original.addPage();
  await assert.rejects(protectPdf(await original.save(), null, ''), /至少/);
});

test('applies the selected opacity and watermark layout to each page', async () => {
  const original = await PDFDocument.create();
  original.addPage([600, 800]);
  original.addPage([800, 600]);
  const { output } = await protectPdf(await original.save(), png, '', { opacity: 0.65, layout: 'tiled' });
  const document = await PDFDocument.load(output);
  for (const page of document.getPages()) {
    const contents = page.node.Contents();
    const operations = Array.from({ length: contents.size() }, (_, index) =>
      new TextDecoder().decode(decodePDFRawStream(contents.lookup(index)).decode()),
    ).join('\n');
    assert.equal((operations.match(/\/Image-[^\s]+ Do/g) || []).length, 12);
    const positions = [...operations.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) cm/g)]
      .map((match) => `${match[1]},${match[2]}`)
      .filter((position) => position !== '0,0');
    assert.equal(new Set(positions).size, 12);
    assert.match(page.node.Resources().lookup(PDFName.of('ExtGState')).toString(), /\/ca 0\.65/);
  }
});

test('places one centered watermark at the selected opacity', async () => {
  const original = await PDFDocument.create();
  original.addPage([600, 800]).setCropBox(100, 100, 400, 600);
  const { output } = await protectPdf(await original.save(), png, '', { opacity: 0.1, layout: 'center' });
  const page = (await PDFDocument.load(output)).getPages()[0];
  const operations = new TextDecoder().decode(decodePDFRawStream(page.node.Contents().lookup(0)).decode());
  assert.equal((operations.match(/\/Image-[^\s]+ Do/g) || []).length, 1);
  assert.match(page.node.Resources().lookup(PDFName.of('ExtGState')).toString(), /\/ca 0\.1/);
  const position = operations.match(/1 0 0 1 ([\d.]+) ([\d.]+) cm/);
  assert.ok(Math.abs(Number(position[1]) - 300) < 0.01);
});

test('supports the lightest and darkest available settings', async () => {
  const original = await PDFDocument.create();
  original.addPage();
  const input = await original.save();
  for (const opacity of [0.05, 1]) {
    const { output } = await protectPdf(input, png, '', { opacity });
    const page = (await PDFDocument.load(output)).getPages()[0];
    assert.match(page.node.Resources().lookup(PDFName.of('ExtGState')).toString(), new RegExp(`/ca ${opacity}\\b`));
  }
});

test('places three watermarks in a vertical column on rotated and unrotated pages', async () => {
  const original = await PDFDocument.create();
  for (const angle of [0, 90, 180, 270]) {
    const page = original.addPage([600, 800]);
    page.setRotation(degrees(angle));
    page.setCropBox(100, 100, 400, 600);
  }
  const { output } = await protectPdf(await original.save(), png, '', { opacity: 0.65, layout: 'vertical' });
  const document = await PDFDocument.load(output);
  for (const page of document.getPages()) {
    const operations = new TextDecoder().decode(decodePDFRawStream(page.node.Contents().lookup(0)).decode());
    assert.equal((operations.match(/\/Image-[^\s]+ Do/g) || []).length, 3);
    const positions = [...operations.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) cm/g)]
      .map((match) => [Number(match[1]), Number(match[2])])
      .filter(([x, y]) => x !== 0 || y !== 0);
    assert.equal(positions.length, 3);
    const rotated = page.getRotation().angle % 180 !== 0;
    const sameAxis = rotated ? 1 : 0;
    const movingAxis = rotated ? 0 : 1;
    assert.equal(new Set(positions.map((position) => position[sameAxis])).size, 1);
    assert.equal(new Set(positions.map((position) => position[movingAxis])).size, 3);
    assert.match(page.node.Resources().lookup(PDFName.of('ExtGState')).toString(), /\/ca 0\.65/);
  }
});

test('rejects invalid watermark settings', async () => {
  const original = await PDFDocument.create();
  original.addPage();
  const input = await original.save();
  await assert.rejects(protectPdf(input, png, '', { opacity: 1.1 }), /浮水印設定無效/);
  await assert.rejects(protectPdf(input, png, '', { layout: 'unknown' }), /浮水印設定無效/);
});
