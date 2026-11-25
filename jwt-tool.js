(function (root) {
  function codecs() {
    const codec = root.lumatekAesCrypto;
    if (!codec || typeof codec.encodeBytes !== "function" || typeof codec.decodeBytes !== "function") {
      throw new Error("JWT 編碼程式載入失敗或版本不一致，請重新整理頁面並確認網站檔案完整。");
    }
    return codec;
  }

  function parseObject(text, label) {
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(label + " 不是有效的 JSON。");
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(label + " 必須是 JSON 物件。");
    }
    return value;
  }

  function decodePart(part, label) {
    if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error(label + " 不是有效的 Base64URL。");
    const codec = codecs();
    const bytes = codec.decodeBytes(part, "base64url", label);
    if (codec.encodeBytes(bytes, "base64url") !== part) throw new Error(label + " 不是有效的 Base64URL。");
    return bytes;
  }

  function parse(token) {
    const parts = token.trim().split(".");
    if (parts.length !== 3) throw new Error("JWT 必須包含以點分隔的三個部分。");
    const decoded = parts.slice(0, 2).map((part, index) => {
      const label = index === 0 ? "Header" : "Payload";
      const bytes = decodePart(part, label);
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        throw new Error(label + " 不是有效的 UTF-8 文字。");
      }
      parseObject(text, label);
      return text;
    });
    if (parts[2]) decodePart(parts[2], "Signature");
    return { header: decoded[0], payload: decoded[1] };
  }

  async function sign(headerText, payloadText, secret) {
    const header = parseObject(headerText, "Header");
    parseObject(payloadText, "Payload");
    const hashes = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };
    if (typeof header.alg !== "string" || !Object.prototype.hasOwnProperty.call(hashes, header.alg)) {
      throw new Error("Header 的 alg 必須是 HS256、HS384 或 HS512。");
    }
    if ((header.b64 !== undefined && header.b64 !== true) || header.crit !== undefined) {
      throw new Error("不支援 Header 中的 b64 設定或 crit 擴充設定。");
    }
    if (!secret) throw new Error("請輸入 HMAC 共用密鑰。");
    if (!root.crypto || !root.crypto.subtle) throw new Error("簽名需要 Web Crypto，請使用 HTTPS 或 localhost。");
    const codec = codecs();
    const encoder = new TextEncoder();
    const encodedHeader = codec.encodeBytes(encoder.encode(headerText), "base64url");
    const encodedPayload = codec.encodeBytes(encoder.encode(payloadText), "base64url");
    const signingInput = encodedHeader + "." + encodedPayload;
    const key = await root.crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: hashes[header.alg] }, false, ["sign"]);
    const signature = await root.crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
    return signingInput + "." + codec.encodeBytes(new Uint8Array(signature), "base64url");
  }

  root.lumatekJwt = { parse, sign };
})(globalThis);
