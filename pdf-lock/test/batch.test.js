import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib';
import { createQpdf } from '@mssio/qpdf-wasm';
import { processFiles } from '../src/batch.js';

test('packs successful PDFs with unique names and reports failed files', async () => {
  const document = await PDFDocument.create();
  document.addPage();
  const bytes = await document.save();
  const files = [
    new File([bytes], '文件.pdf'),
    new File([bytes], '文件.pdf'),
    new File(['invalid'], 'bad.pdf'),
  ];
  const progress = [];
  const result = await processFiles(files, null, 'password', (current, total) => progress.push([current, total]));
  assert.equal(result.successCount, 2);
  assert.equal(result.output.type, 'application/zip');
  assert.deepEqual(result.failures.map((failure) => failure.name), ['bad.pdf']);
  assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);

  const entries = unzipSync(result.output.bytes);
  assert.deepEqual(Object.keys(entries), ['文件_protected.pdf', '文件_protected (2).pdf']);
  const qpdf = await createQpdf();
  try {
    for (const pdf of Object.values(entries)) {
      await assert.rejects(qpdf.decrypt(pdf.slice(), { password: 'wrong' }), { code: 'INVALID_PASSWORD' });
      const { output } = await qpdf.decrypt(pdf.slice(), { password: 'password' });
      assert.equal((await PDFDocument.load(output)).getPageCount(), 1);
    }
  } finally {
    qpdf.terminate();
  }
});

test('does not create a download when all files fail', async () => {
  const files = [new File(['bad'], 'invalid.pdf'), new File(['bad'], 'other.txt')];
  const result = await processFiles(files, null, 'password', () => {});
  assert.equal(result.output, null);
  assert.equal(result.successCount, 0);
  assert.deepEqual(result.failures.map((failure) => failure.name), ['invalid.pdf', 'other.txt']);
});

test('continues downloading a single file as a PDF', async () => {
  const document = await PDFDocument.create();
  document.addPage();
  const result = await processFiles([new File([await document.save()], 'one.pdf')], null, 'password', () => {});
  assert.equal(result.output.name, 'one_protected.pdf');
  assert.equal(result.output.type, 'application/pdf');
  assert.equal(result.successCount, 1);
});

test('applies watermark settings to all PDFs in a batch', async () => {
  const document = await PDFDocument.create();
  document.addPage();
  const bytes = await document.save();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=', 'base64');
  const result = await processFiles(
    [new File([bytes], 'one.pdf'), new File([bytes], 'two.pdf')],
    png, '', () => {}, { layout: 'tiled', opacity: 0.8 },
  );
  for (const bytes of Object.values(unzipSync(result.output.bytes))) {
    const page = (await PDFDocument.load(bytes)).getPages()[0];
    const operations = new TextDecoder().decode(decodePDFRawStream(page.node.Contents().lookup(0)).decode());
    assert.equal((operations.match(/\/Image-[^\s]+ Do/g) || []).length, 12);
    assert.match(page.node.Resources().lookup(PDFName.of('ExtGState')).toString(), /\/ca 0\.8/);
  }
});
