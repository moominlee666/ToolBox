const { test } = require("node:test");
const assert = require("node:assert/strict");

require("../json-escape.js");
const { escape, unescape } = globalThis.lumatekJsonEscape;

test("escapes JSON and restores special characters without outer quotes", () => {
  const text = '{"message":"中文 😀","path":"C:\\tmp"}\n下一行\t';
  const escaped = '{\\"message\\":\\"中文 😀\\",\\"path\\":\\"C:\\\\tmp\\"}\\n下一行\\t';
  assert.equal(escape(text), escaped);
  assert.equal(unescape(escaped), text);
  assert.equal(escape(""), "");
  assert.equal(unescape(""), "");
});

test("restores JSON unicode and slash escapes", () => {
  assert.equal(unescape("\\u4e2d\\u6587\\/\\\\"), "中文/\\");
});

test("rejects malformed or incomplete JSON string escapes", () => {
  for (const input of ["\\x41", "\\u123", "trailing\\", '"quoted"', "line\nbreak"]) {
    assert.throws(() => unescape(input), /不是有效的 JSON 跳脫字串/);
  }
});
