import { diffChars } from "diff";

globalThis.lumatekCompareStrings = (source, comparison) => {
  const left = source[Symbol.iterator]();
  const right = comparison[Symbol.iterator]();
  let line = 1;
  let column = 1;
  while (true) {
    const a = left.next();
    const b = right.next();
    if (a.done !== b.done || a.value !== b.value) {
      return {
        line,
        column,
        sourceChar: a.done ? null : a.value,
        comparisonChar: b.done ? null : b.value,
        changes: diffChars(source, comparison, { timeout: 150, maxEditLength: 2048 })
      };
    }
    if (a.done) return null;
    if (a.value === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
};
