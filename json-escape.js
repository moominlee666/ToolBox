(function (root) {
  function escape(text) {
    return JSON.stringify(text).slice(1, -1);
  }

  function unescape(text) {
    try {
      return JSON.parse('"' + text + '"');
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("輸入不是有效的 JSON 跳脫字串，請檢查反斜線、引號與換行。");
      }
      throw error;
    }
  }

  root.lumatekJsonEscape = { escape, unescape };
})(globalThis);
