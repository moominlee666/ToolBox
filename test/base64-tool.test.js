const { test } = require("node:test");
const assert = require("node:assert/strict");

require("../aes-crypto.js");
require("../base64-tool.js");
const { encode, decode } = globalThis.lumatekBase64;

test("encodes and decodes UTF-8 text without losing whitespace or a leading BOM", () => {
  const text = "\ufeff中文 Hello 😀\n  ";
  const encoded = "77u/5Lit5paHIEhlbGxvIPCfmIAKICA=";
  assert.equal(encode(text), encoded);
  assert.equal(decode(encoded), text);
  assert.equal(encode(""), "");
  assert.equal(decode(""), "");
});

test("accepts whitespace, unpadded Base64, and Base64URL", () => {
  assert.equal(decode(" 5Lit\n5paH "), "中文");
  assert.equal(decode("8J-YgA"), "😀");
});

test("rejects malformed Base64 and decoded bytes that are not UTF-8", () => {
  for (const input of ["a", "Zg=", "Z===", "!!!!"]) {
    assert.throws(() => decode(input), /不是有效的 Base64/);
  }
  assert.throws(() => decode("/w=="), /不是有效的 UTF-8/);
});

test("handles input larger than a single byte conversion chunk", () => {
  const text = "中文😀".repeat(10000);
  assert.equal(decode(encode(text)), text);
});

test("reports a missing or outdated AES dependency clearly", () => {
  const original = globalThis.lumatekAesCrypto;
  try {
    for (const dependency of [undefined, { transformAes() {} }]) {
      globalThis.lumatekAesCrypto = dependency;
      assert.throws(() => encode("test"), /版本不一致/);
      assert.throws(() => decode("dGVzdA=="), /版本不一致/);
    }
  } finally {
    globalThis.lumatekAesCrypto = original;
  }
});
