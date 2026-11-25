(function (root) {
  function decodeBytes(value, format, label) {
    if (format === "utf8") return new TextEncoder().encode(value);
    const compact = value.replace(/\s/g, "");
    if (format === "hex") {
      if (compact.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(compact)) {
        throw new Error(label + " 不是有效的 Hex。");
      }
      const bytes = new Uint8Array(compact.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
    if (format === "base64" || format === "base64url") {
      const standard = compact.replace(/-/g, "+").replace(/_/g, "/");
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?|)$/.test(standard)) {
        throw new Error(label + " 不是有效的 Base64 或 Base64URL。");
      }
      const binary = atob(standard);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }
    throw new Error("不支援的編碼格式。");
  }

  function encodeBytes(bytes, format) {
    if (format === "hex") {
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    if (format === "base64" || format === "base64url") {
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const encoded = btoa(binary);
      return format === "base64url" ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : encoded;
    }
    throw new Error("不支援的密文編碼格式。");
  }

  async function transformAes({ operation, input, key, keyFormat, iv, ivFormat, cipherFormat, padding = "pkcs7" }) {
    if (padding !== "pkcs7" && padding !== "none" && padding !== "dotnet") {
      throw new Error("不支援的 padding 方式。");
    }
    if (padding === "dotnet") padding = operation === "encrypt" ? "pkcs7" : "none";
    const keyBytes = decodeBytes(key, keyFormat, "KEY");
    const ivBytes = decodeBytes(iv, ivFormat, "IV");
    if (![16, 24, 32].includes(keyBytes.length)) {
      throw new Error("KEY 編碼後的長度必須是 16、24 或 32 bytes。");
    }
    if (ivBytes.length !== 16) {
      throw new Error("IV 編碼後的長度必須是 16 bytes。");
    }
    const data = operation === "encrypt"
      ? new TextEncoder().encode(input)
      : decodeBytes(input, cipherFormat, "密文");
    if (operation === "decrypt" && (data.length % 16 !== 0 || (padding === "pkcs7" && data.length === 0))) {
      throw new Error(padding === "none"
        ? "密文長度必須是 16 bytes 的倍數。"
        : "密文長度必須是 16 bytes 的非零倍數。");
    }
    if (operation === "encrypt" && padding === "none" && data.length % 16 !== 0) {
      throw new Error("不使用 padding 時，明文 UTF-8 編碼後的長度必須是 16 bytes 的倍數。");
    }
    let result;
    if (keyBytes.length === 24 || padding === "none") {
      if (typeof root.lumatekAesCbc !== "function") {
        throw new Error("AES 相容套件載入失敗，請確認網站檔案完整。");
      }
      try {
        result = root.lumatekAesCbc(keyBytes, ivBytes, { disablePadding: padding === "none" })[operation](data);
      } catch (error) {
        if (error instanceof Error && error.message === "aes: bad decrypt") {
          throw new Error("加解密失敗，請檢查 KEY、IV、密文及 PKCS#7 padding。");
        }
        throw error;
      }
    } else {
      const cryptoKey = await root.crypto.subtle.importKey("raw", keyBytes, "AES-CBC", false, [operation]);
      result = await root.crypto.subtle[operation]({ name: "AES-CBC", iv: ivBytes }, cryptoKey, data);
    }
    if (operation === "encrypt") return encodeBytes(new Uint8Array(result), cipherFormat);
    try {
      return new TextDecoder("utf-8", { fatal: padding !== "none", ignoreBOM: padding === "none" }).decode(result);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      throw new Error("解密結果不是有效的 UTF-8 文字，請檢查 KEY、IV 和密文。");
    }
  }

  root.lumatekAesCrypto = { transformAes, decodeBytes, encodeBytes };
})(globalThis);
