const { test } = require("node:test");
const assert = require("node:assert/strict");

require("../vendor/md5-diff.js");
const { lumatekCompareStrings } = globalThis;

test("reports the first difference and identifies all changed characters", () => {
  const source = "a🧪b\ncd x";
  const comparison = "a🧪b\ncd\ty";
  const diff = lumatekCompareStrings(source, comparison);
  assert.deepEqual(
    { line: diff.line, column: diff.column, sourceChar: diff.sourceChar, comparisonChar: diff.comparisonChar },
    { line: 2, column: 3, sourceChar: " ", comparisonChar: "\t" }
  );
  assert.equal(diff.changes.filter((change) => !change.added).map((change) => change.value).join(""), source);
  assert.equal(diff.changes.filter((change) => !change.removed).map((change) => change.value).join(""), comparison);
  assert.ok(diff.changes.some((change) => change.removed));
  assert.ok(diff.changes.some((change) => change.added));
});

test("handles multiple insertions, an ending difference and equal strings", () => {
  const diff = lumatekCompareStrings("abcdef", "abXYcdZef");
  assert.deepEqual(diff.changes.filter((change) => change.added).map((change) => change.value), ["XY", "Z"]);
  assert.equal(lumatekCompareStrings("abc", "ab").comparisonChar, null);
  assert.equal(lumatekCompareStrings("ab", "abc").sourceChar, null);
  assert.equal(lumatekCompareStrings("一樣", "一樣"), null);
});

test("still reports the first difference when a full diff is too complex", () => {
  const diff = lumatekCompareStrings("x".repeat(2100), "y".repeat(2100));
  assert.equal(diff.column, 1);
  assert.equal(diff.sourceChar, "x");
  assert.equal(diff.comparisonChar, "y");
  assert.equal(diff.changes, undefined);
});
