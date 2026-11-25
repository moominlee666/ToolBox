const { test } = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

require("../password-generator.js");
const { generate } = globalThis.lumatekPasswordGenerator;

test("generates passwords with the requested length, count, and character classes", () => {
  const categories = ["uppercase", "lowercase", "digits", "symbols"];
  for (const length of [4, 16, 64]) {
    const results = generate({ mode: "password", length, count: 200, categories }, webcrypto);
    assert.equal(results.length, 200);
    for (const password of results) {
      assert.equal(password.length, length);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /[0-9]/);
      assert.match(password, /[!@#$%^&*()\-_=+[\]{};:,.?/]/);
    }
  }
  const digits = generate({ mode: "password", length: 10, count: 5, categories: ["digits"] }, webcrypto);
  assert.ok(digits.every((password) => /^[0-9]{10}$/.test(password)));
});

test("produces UUID v4 values while ignoring password-only settings", () => {
  const uuids = generate({ mode: "uuid", count: 200, length: 0, categories: [] }, webcrypto);
  assert.equal(uuids.length, 200);
  assert.ok(uuids.every((uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)));
});

test("rejects invalid requests and does not fall back to insecure randomness", () => {
  const base = { mode: "password", length: 8, count: 1, categories: ["uppercase", "digits"] };
  for (const count of [0, 201, 1.5, NaN]) {
    assert.throws(() => generate({ ...base, count }, webcrypto), /數量/);
  }
  for (const length of [0, 65, 1.5, NaN]) {
    assert.throws(() => generate({ ...base, length }, webcrypto), /長度/);
  }
  assert.throws(() => generate({ ...base, length: 1 }, webcrypto), /類別數量/);
  assert.throws(() => generate({ ...base, categories: [] }, webcrypto), /至少選擇/);
  assert.throws(() => generate({ ...base, categories: ["unknown"] }, webcrypto), /有效/);
  assert.throws(() => generate({ ...base, categories: ["digits", "digits"] }, webcrypto), /有效/);
  assert.throws(() => generate(base, {}), /安全隨機數/);
});

test("discards random bytes that would bias character selection", () => {
  const crypto = {
    getRandomValues(bytes) {
      bytes.fill(7);
      bytes[0] = 255;
      return bytes;
    }
  };
  assert.deepEqual(generate({ mode: "password", length: 1, count: 1, categories: ["digits"] }, crypto), ["7"]);
});
