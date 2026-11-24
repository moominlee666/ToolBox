const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCipheriv } = require("node:crypto");

require("../vendor/aes-cbc.js");
require("../aes-crypto.js");

const { transformAes } = globalThis.lumatekAesCrypto;
const iv = "000102030405060708090a0b0c0d0e0f";
const vectors = [
  [16, "82bb1ead0711669761edf7c6a5c8e830032bdf59f83b1492922d658add3333b5"],
  [24, "d951acd9d4b565542694802d8f05bbecf7c357b6b20fedfc25c6598acafde3c0"],
  [32, "d8556ce9f7abbcc000a379c9d12bad43affbdec36bf059e2148cc99ff5729835"]
];

test("AES-CBC encrypts and decrypts 128, 192, and 256-bit known vectors", async () => {
  for (const [size, expected] of vectors) {
    const key = Buffer.from(Array.from({ length: size }, (_, i) => i)).toString("hex");
    const options = { key, keyFormat: "hex", iv, ivFormat: "hex", cipherFormat: "hex" };
    assert.equal(await transformAes({ ...options, operation: "encrypt", input: "hello AES CBC 測試" }), expected);
    assert.equal(await transformAes({ ...options, operation: "decrypt", input: expected }), "hello AES CBC 測試");
  }
});

test("supports UTF-8 and Base64 inputs, including empty plaintext", async () => {
  const options = {
    key: "MTIzNDU2Nzg5MDEyMzQ1Ng==", keyFormat: "base64",
    iv: "YWJjZGVmZ2hpamtsbW5vcA==", ivFormat: "base64", cipherFormat: "base64"
  };
  assert.equal(await transformAes({ ...options, operation: "encrypt", input: "你好 AES" }), "gTo1saSrlTQnPIkpah3ByA==");
  assert.equal(await transformAes({ ...options, operation: "decrypt", input: "gTo1saSrlTQnPIkpah3ByA" }), "你好 AES");
  assert.equal(await transformAes({ ...options, operation: "encrypt", input: "" }), "IhtXErS0+ZoF1hhWZSll8A==");
  assert.equal(await transformAes({ ...options, operation: "decrypt", input: "IhtXErS0+ZoF1hhWZSll8A==" }), "");
});

test("supports Base64URL ciphertext, with and without padding", async () => {
  const options = { key: "1234567890123456", keyFormat: "utf8", iv: "abcdefghijklmnop", ivFormat: "utf8" };
  const urlCiphertext = "Bn-ZsJgO9YXvV5HZZ_pJRg";
  assert.equal(await transformAes({ ...options, operation: "encrypt", input: "sample-2", cipherFormat: "base64url" }), urlCiphertext);
  for (const cipherFormat of ["base64", "base64url"]) {
    for (const input of [urlCiphertext, urlCiphertext + "==", "Bn+ZsJgO9YXvV5HZZ/pJRg=="]) {
      assert.equal(await transformAes({ ...options, operation: "decrypt", input, cipherFormat }), "sample-2");
    }
  }
});

test("supports .NET AES-CBC with PaddingMode.None", async () => {
  const options = {
    key: "1234567890123456", keyFormat: "utf8", iv: "abcdefghijklmnop",
    ivFormat: "utf8", cipherFormat: "base64url", padding: "none"
  };
  const input = "1234567890ABCDEF";
  const ciphertext = "qwkEJmfRFUyut297hDpKiQ";
  assert.equal(await transformAes({ ...options, operation: "encrypt", input }), ciphertext);
  assert.equal(await transformAes({ ...options, operation: "decrypt", input: ciphertext }), input);
  assert.equal(await transformAes({ ...options, operation: "encrypt", input: "" }), "");
  assert.equal(await transformAes({ ...options, operation: "decrypt", input: "" }), "");
  await assert.rejects(transformAes({ ...options, operation: "encrypt", input: "你好" }), /16 bytes 的倍數/);
  for (const [size, expected] of [[16, "gULCbiw0QVTasvqOZC6Btw"], [24, "tdBEyPJwhXPKrpD5bI0nVQ"], [32, "3MecE6_XlXVTsIINjHmlfw"]]) {
    const key = Buffer.from(Array.from({ length: size }, (_, i) => i)).toString("hex");
    const vector = { ...options, key, keyFormat: "hex", iv, ivFormat: "hex" };
    assert.equal(await transformAes({ ...vector, operation: "encrypt", input }), expected);
    assert.equal(await transformAes({ ...vector, operation: "decrypt", input: expected }), input);
  }

  const raw = Buffer.from([0xef, 0xbb, 0xbf, 0xff, ...Array(12).fill(0)]);
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(options.key), Buffer.from(options.iv));
  cipher.setAutoPadding(false);
  const encoded = Buffer.concat([cipher.update(raw), cipher.final()]).toString("base64url");
  assert.equal(await transformAes({ ...options, operation: "decrypt", input: encoded }), "\ufeff\ufffd" + "\0".repeat(12));
});

test("matches .NET default encryption and PaddingMode.None decryption", async () => {
  const options = {
    key: "1234567890123456", keyFormat: "utf8", iv: "abcdefghijklmnop",
    ivFormat: "utf8", cipherFormat: "base64url", padding: "dotnet"
  };
  const ciphertext = "4L8yqSyTfS7jDyPhOjHsOA";
  assert.equal(await transformAes({ ...options, operation: "encrypt", input: "Hello .NET" }), ciphertext);
  assert.equal(await transformAes({ ...options, operation: "decrypt", input: ciphertext }), "Hello .NET" + "\x06".repeat(6));
});

test("rejects malformed encodings, wrong lengths, padding and non-UTF-8 plaintext", async () => {
  const options = { key: "1234567890123456", keyFormat: "utf8", iv: "abcdefghijklmnop", ivFormat: "utf8", cipherFormat: "base64" };
  await assert.rejects(transformAes({ ...options, operation: "encrypt", input: "", key: "short" }), /KEY.*16、24 或 32/);
  await assert.rejects(transformAes({ ...options, operation: "encrypt", input: "", iv: "short" }), /IV.*16/);
  await assert.rejects(transformAes({ ...options, operation: "encrypt", input: "", key: "abc", keyFormat: "hex" }), /有效的 Hex/);
  await assert.rejects(transformAes({ ...options, operation: "decrypt", input: "not base64!" }), /有效的 Base64/);
  await assert.rejects(transformAes({ ...options, operation: "decrypt", input: "YQ==" }), /16 bytes 的非零倍數/);
  await assert.rejects(transformAes({ ...options, operation: "decrypt", input: "+V2rEwIHSdxHuCCmyVjOGA==" }), /UTF-8/);

  const key192 = Buffer.alloc(24);
  const ivBytes = Buffer.alloc(16);
  const cipher = createCipheriv("aes-192-cbc", key192, ivBytes);
  cipher.setAutoPadding(false);
  const invalidPadding = Buffer.concat([cipher.update(Buffer.alloc(16)), cipher.final()]).toString("hex");
  await assert.rejects(transformAes({
    operation: "decrypt", input: invalidPadding, key: key192.toString("hex"), keyFormat: "hex",
    iv: ivBytes.toString("hex"), ivFormat: "hex", cipherFormat: "hex"
  }), /padding/);
});
