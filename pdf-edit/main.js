import { localEngine } from '@embedpdf/engine';
import { characterAt, prepareFont, replaceLine, selectionAt } from './core.js';

const engine = localEngine({ defaultFallbackFonts: false });
const fileInput = document.getElementById('edit-file');
const fileName = document.getElementById('edit-file-name');
const message = document.getElementById('edit-message');
const image = document.getElementById('edit-preview');
const highlight = document.getElementById('edit-highlight');
const previous = document.getElementById('edit-previous');
const next = document.getElementById('edit-next');
const pageNumber = document.getElementById('edit-page-number');
const original = document.getElementById('edit-original');
const replacement = document.getElementById('edit-replacement');
const fontChoice = document.getElementById('edit-font');
const fontSize = document.getElementById('edit-font-size');
const apply = document.getElementById('edit-apply');
const download = document.getElementById('edit-download');

let doc = null;
let bytes = null;
let pages = [];
let index = 0;
let layout = null;
let rendered = null;
let revokeImage = null;
let selection = null;
let name = '';
let changed = false;
let unsaved = false;
let busy = false;
const fonts = {
  noto: { file: 'NotoSansTC.ttf', key: 'lumatek-noto-tc' },
  publicRegular: { file: 'PublicSans-Regular.ttf', key: 'lumatek-public-regular', weight: 400 },
  publicMedium: { file: 'PublicSans-Medium.ttf', key: 'lumatek-public-medium', weight: 500 },
  publicSemiBold: { file: 'PublicSans-SemiBold.ttf', key: 'lumatek-public-semibold', weight: 600 },
  publicBold: { file: 'PublicSans-Bold.ttf', key: 'lumatek-public-bold', weight: 700 },
};
const fontPromises = new Map();

function showError(prefix, error) {
  console.error(prefix, error);
  message.textContent = `${prefix}：${error instanceof Error ? error.message : String(error)}`;
}

function setBusy(value) {
  busy = value;
  fileInput.disabled = value;
  previous.disabled = value || !doc || index === 0;
  next.disabled = value || !doc || index >= pages.length - 1;
  replacement.disabled = value || !selection;
  fontChoice.disabled = value || !selection;
  fontSize.disabled = value || !selection;
  apply.disabled = value || !selection;
  download.disabled = value || !changed;
}

function clearSelection() {
  selection = null;
  original.textContent = '點選預覽中的文字區段';
  replacement.value = '';
  highlight.hidden = true;
}

async function showPage() {
  const page = doc.page(pages[index].ref);
  const [nextLayout, nextImage] = await Promise.all([
    page.text.layout(),
    page.render.image({ viewport: { kind: 'width', width: 1200 }, rotation: pages[index].rotation }),
  ]);
  const { url, revoke } = await nextImage.objectUrl();
  if (revokeImage) revokeImage();
  revokeImage = revoke;
  image.src = url;
  image.hidden = false;
  rendered = nextImage;
  layout = nextLayout;
  pageNumber.textContent = `第 ${index + 1} / ${pages.length} 頁`;
  clearSelection();
}

async function changePage(delta) {
  if (busy || !doc) return;
  setBusy(true);
  const oldIndex = index;
  try {
    index += delta;
    await showPage();
    message.textContent = layout.charCount ? '點選預覽中的文字區段。' : '此頁沒有可選取的文字。';
  } catch (error) {
    index = oldIndex;
    showError('無法顯示頁面', error);
  } finally {
    setBusy(false);
  }
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (unsaved && !window.confirm('目前有尚未下載的修改。選擇新檔案會放棄這些修改，確定繼續？')) {
    fileInput.value = '';
    return;
  }
  setBusy(true);
  let opened = null;
  try {
    message.textContent = '正在載入 PDF…';
    const newBytes = new Uint8Array(await file.arrayBuffer());
    opened = await engine.open({ kind: 'bytes', bytes: newBytes.slice() });
    const result = await opened.pages.list();
    if (!result.pages.length) throw new Error('PDF 沒有頁面。');
    const firstPage = opened.page(result.pages[0].ref);
    const [newLayout, newImage] = await Promise.all([
      firstPage.text.layout(),
      firstPage.render.image({ viewport: { kind: 'width', width: 1200 }, rotation: result.pages[0].rotation }),
    ]);
    const { url, revoke } = await newImage.objectUrl();
    if (doc) await doc.close();
    if (revokeImage) revokeImage();
    doc = opened;
    opened = null;
    bytes = newBytes;
    pages = result.pages;
    index = 0;
    layout = newLayout;
    rendered = newImage;
    revokeImage = revoke;
    name = file.name;
    changed = false;
    unsaved = false;
    fileName.textContent = name;
    fileInput.value = '';
    image.src = url;
    image.hidden = false;
    pageNumber.textContent = `第 1 / ${pages.length} 頁`;
    clearSelection();
    message.textContent = layout.charCount ? '點選預覽中的文字區段。' : '此頁沒有可選取的文字；不支援掃描圖片。';
  } catch (error) {
    if (opened) await opened.close();
    fileInput.value = '';
    showError('無法開啟 PDF', error);
  } finally {
    setBusy(false);
  }
});

image.addEventListener('click', async (event) => {
  if (busy || !layout || !rendered) return;
  const rect = image.getBoundingClientRect();
  const point = rendered.transform.pixelsToPage({
    x: (event.clientX - rect.left) * rendered.width / rect.width,
    y: (event.clientY - rect.top) * rendered.height / rect.height,
  });
  const character = characterAt(layout, point);
  const range = character === null ? null : selectionAt(layout, character);
  if (!range) {
    message.textContent = '此處沒有可選取的文字。';
    return;
  }
  setBusy(true);
  try {
    const text = await doc.page(pages[index].ref).text.slice(range);
    const segments = layout.segments(range);
    if (!text || segments.length !== 1) throw new Error('此段文字目前不支援編輯。');
    selection = { ...range, text };
    original.textContent = text;
    replacement.value = text;
    const run = layout.runs.find((item) => range.start >= item.start && range.start < item.start + item.glyphs.length);
    fontSize.value = Math.max(4, Math.min(96, Math.round(run?.fontSize || 12)));
    const box = rendered.transform.pageToPixels(segments[0].rect);
    highlight.style.left = `${box.x / rendered.width * 100}%`;
    highlight.style.top = `${box.y / rendered.height * 100}%`;
    highlight.style.width = `${box.width / rendered.width * 100}%`;
    highlight.style.height = `${box.height / rendered.height * 100}%`;
    highlight.hidden = false;
    message.textContent = '已選取文字區段；請輸入新文字並確認修改。';
  } catch (error) {
    clearSelection();
    showError('無法選取文字', error);
  } finally {
    setBusy(false);
  }
});

async function loadFont(choice) {
  const spec = fonts[choice];
  if (!spec) throw new Error('找不到所選字型。');
  if (!fontPromises.has(choice)) {
    fontPromises.set(choice, (async () => {
      const response = await fetch(new URL(`pdf-edit/${spec.file}`, document.baseURI));
      if (!response.ok) throw new Error(`無法載入所選字型（HTTP ${response.status}）。`);
      return prepareFont(engine, new Uint8Array(await response.arrayBuffer()), spec.key, spec.weight);
    })());
  }
  try {
    return await fontPromises.get(choice);
  } catch (error) {
    fontPromises.delete(choice);
    throw error;
  }
}

apply.addEventListener('click', async () => {
  if (busy || !selection) return;
  if (!window.confirm('將移除所選區段的原文字。與文字重疊的圖片、線條、註解或欄位也可能被移除；新文字可能影響附近排版。確定要修改？')) return;
  setBusy(true);
  let opened = null;
  try {
    message.textContent = '正在修改 PDF…';
    const font = await loadFont(fontChoice.value);
    const output = await replaceLine(engine, bytes, index, selection, replacement.value, Number(fontSize.value), font);
    opened = await engine.open({ kind: 'bytes', bytes: output.slice() });
    const newPages = (await opened.pages.list()).pages;
    await doc.close();
    doc = opened;
    opened = null;
    bytes = output;
    pages = newPages;
    changed = true;
    unsaved = true;
    await showPage();
    message.textContent = '修改完成；請檢查預覽，並下載新的 PDF。';
  } catch (error) {
    if (opened) await opened.close();
    showError('無法修改文字', error);
  } finally {
    setBusy(false);
  }
});

previous.addEventListener('click', () => changePage(-1));
next.addEventListener('click', () => changePage(1));
download.addEventListener('click', () => {
  if (!bytes || !changed) return;
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/\.pdf$/i, '')}_edited.pdf`;
  link.click();
  unsaved = false;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
});

window.addEventListener('beforeunload', (event) => {
  if (unsaved) {
    event.preventDefault();
    event.returnValue = '';
  }
});

setBusy(false);
