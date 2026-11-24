import { PDFDocument, degrees } from 'pdf-lib';
import { createQpdf } from '@mssio/qpdf-wasm';

export async function protectPdf(input, watermarkImage, password, watermarkOptions = {}) {
  if (!watermarkImage && !password) {
    throw new Error('請至少輸入浮水印文字或開啟密碼。');
  }

  const document = await PDFDocument.load(input);
  let output = input;

  if (watermarkImage) {
    const { opacity = 0.28, layout = 'center' } = watermarkOptions;
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1 || !['center', 'tiled', 'vertical'].includes(layout)) {
      throw new Error('浮水印設定無效。');
    }
    const image = await document.embedPng(watermarkImage);
    const radians = Math.PI / 4;

    for (const page of document.getPages()) {
      const { x, y, width, height } = page.getCropBox();
      let columns = 1;
      let rows = 1;
      if (layout === 'tiled') {
        columns = width > height ? 4 : 3;
        rows = width > height ? 3 : 4;
      } else if (layout === 'vertical') {
        if (Math.abs(page.getRotation().angle % 180) === 90) {
          columns = 3;
        } else {
          rows = 3;
        }
      }
      const cellWidth = width / columns;
      const cellHeight = height / rows;
      const imageRatio = image.height / image.width;
      const maxRotatedSize = Math.min(cellWidth, cellHeight) * 0.9;
      const imageWidth = Math.min(
        Math.min(cellWidth, cellHeight) * 0.75,
        maxRotatedSize / ((1 + imageRatio) * Math.cos(radians)),
      );
      const imageHeight = imageWidth * imageRatio;

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const centerX = x + (column + 0.5) * cellWidth;
          const centerY = y + (row + 0.5) * cellHeight;
          page.drawImage(image, {
            x: centerX - imageWidth * Math.cos(radians) / 2 + imageHeight * Math.sin(radians) / 2,
            y: centerY - imageWidth * Math.sin(radians) / 2 - imageHeight * Math.cos(radians) / 2,
            width: imageWidth,
            height: imageHeight,
            rotate: degrees(45),
            opacity,
          });
        }
      }
    }

    output = await document.save();
  }

  if (!password) return { output, warnings: [] };

  const qpdf = await createQpdf();
  try {
    return await qpdf.encrypt(output, {
      userPassword: password,
      ownerPassword: password,
      bits: 256,
    });
  } finally {
    qpdf.terminate();
  }
}
