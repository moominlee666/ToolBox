const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

require("../vendor/md5-hash.js");

test("computes standard MD5 vectors as lowercase hex", () => {
  assert.equal(globalThis.lumatekMd5(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(globalThis.lumatekMd5("abc"), "900150983cd24fb0d6963f7d28e17f72");
});

test("hashes the exact UTF-8 bytes including whitespace and Unicode", () => {
  const text = 'agent-1{\n  "name": "測試"\n} secret ';
  const expected = createHash("md5").update(text, "utf8").digest("hex");
  assert.equal(globalThis.lumatekMd5(text), expected);
  assert.notEqual(globalThis.lumatekMd5(text), globalThis.lumatekMd5(text.trim()));
});
