(function (root) {
  function encode(text) {
    if (!root.lumatekAesCrypto) throw new Error("Base64 編碼程式載入失敗，請確認網站檔案完整。");
    const bytes = new TextEncoder().encode(text);
    return root.lumatekAesCrypto.encodeBytes(bytes, "base64");
  }

  function decode(text) {
    if (!root.lumatekAesCrypto) throw new Error("Base64 解碼程式載入失敗，請確認網站檔案完整。");
    const bytes = root.lumatekAesCrypto.decodeBytes(text, "base64", "輸入內容");
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch (error) {
      if (error instanceof TypeError) throw new Error("解碼結果不是有效的 UTF-8 文字。");
      throw error;
    }
  }

  root.lumatekBase64 = { encode, decode };
})(globalThis);
