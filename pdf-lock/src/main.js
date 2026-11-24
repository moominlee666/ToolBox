import { processFiles } from './batch.js';

const form = document.querySelector('#protect-form');
const fileInput = document.querySelector('#pdf-file');
const uploadZone = document.querySelector('#upload-zone');
const fileName = document.querySelector('#file-name');
const watermarkInput = document.querySelector('#watermark');
const watermarkOptions = document.querySelector('#watermark-options');
const watermarkOpacity = document.querySelector('#watermark-opacity');
const opacityValue = document.querySelector('#opacity-value');
const passwordInput = document.querySelector('#password');
const togglePassword = document.querySelector('#toggle-password');
const submitButton = document.querySelector('#submit-button');
const message = document.querySelector('#message');
const unsupportedFileUrl = location.protocol === 'file:';

if (unsupportedFileUrl) {
  submitButton.disabled = true;
  message.textContent = 'PDF 保護請透過 HTTPS 或 localhost 開啟，無法直接從檔案使用。';
}

watermarkOpacity.addEventListener('input', () => {
  opacityValue.value = `${watermarkOpacity.value}%`;
});

function showFile() {
  const files = Array.from(fileInput.files);
  fileName.textContent = files.length > 1
    ? `已選擇 ${files.length} 個檔案：${files.map((file) => file.name).join('、')}`
    : files[0]?.name || '點擊選擇或拖曳多個 PDF 至此';
  uploadZone.classList.toggle('has-file', Boolean(fileInput.files.length));
  if (!unsupportedFileUrl) message.textContent = '';
}

fileInput.addEventListener('change', showFile);
for (const eventName of ['dragenter', 'dragover']) {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!fileInput.disabled) uploadZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove('dragging');
  });
}
uploadZone.addEventListener('drop', (event) => {
  const files = event.dataTransfer.files;
  if (fileInput.disabled || !files.length) return;
  fileInput.files = files;
  showFile();
});

togglePassword.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePassword.textContent = show ? '隱藏' : '顯示';
  togglePassword.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
  togglePassword.setAttribute('aria-pressed', String(show));
});

async function createWatermark(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('無法產生浮水印，請嘗試其他瀏覽器。');

  context.font = 'bold 80px sans-serif';
  const width = Math.ceil(context.measureText(text).width) + 32;
  canvas.width = width;
  canvas.height = 120;
  context.font = 'bold 80px sans-serif';
  context.fillStyle = '#303d38';
  context.textBaseline = 'middle';
  context.fillText(text, 16, canvas.height / 2);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('無法產生浮水印，請嘗試其他瀏覽器。');
  return new Uint8Array(await blob.arrayBuffer());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const files = Array.from(fileInput.files);
  const text = watermarkInput.value.trim();
  const password = passwordInput.value;
  const options = {
    layout: form.querySelector('input[name="watermark-layout"]:checked').value,
    opacity: Number(watermarkOpacity.value) / 100,
  };
  if (!files.length) {
    message.textContent = '請選擇 PDF 檔案。';
    return;
  }
  if (!text && !password) {
    message.textContent = '請至少輸入浮水印文字或開啟密碼。';
    return;
  }
  if (new TextEncoder().encode(password).length > 127) {
    message.textContent = '密碼的 UTF-8 編碼長度不可超過 127 位元組。';
    return;
  }

  submitButton.disabled = true;
  fileInput.disabled = true;
  watermarkInput.disabled = true;
  watermarkOptions.disabled = true;
  passwordInput.disabled = true;
  togglePassword.disabled = true;
  form.setAttribute('aria-busy', 'true');
  submitButton.firstElementChild.textContent = '處理中，請稍候…';
  message.textContent = '';
  try {
    const image = text ? await createWatermark(text) : null;
    const { output, warnings, failures, successCount } = await processFiles(files, image, password, (current, total) => {
      submitButton.firstElementChild.textContent = `處理中（${current}/${total}）…`;
    }, options);
    if (output) {
      const url = URL.createObjectURL(new Blob([output.bytes], { type: output.type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = output.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    const details = [
      output ? `已開始下載 ${successCount} 個處理完成的檔案。` : '所有檔案皆處理失敗，未下載任何檔案。',
      ...failures.map(({ name, reason }) => `${name} 處理失敗：${reason}`),
      ...warnings.map((warning) => `警告：${warning}`),
    ];
    message.textContent = details.join('\n');
  } catch (error) {
    console.error('PDF 處理失敗：', error);
    message.textContent = `處理失敗：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    submitButton.disabled = false;
    fileInput.disabled = false;
    watermarkInput.disabled = false;
    watermarkOptions.disabled = false;
    passwordInput.disabled = false;
    togglePassword.disabled = false;
    form.removeAttribute('aria-busy');
    submitButton.firstElementChild.textContent = '處理並下載 PDF';
  }
});
