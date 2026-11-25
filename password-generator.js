(function (root) {
  const characterSets = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    digits: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.?/"
  };

  function generate({ mode, length, count, categories }, crypto = root.crypto) {
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      throw new Error("數量必須是 1 到 200 的整數。");
    }
    if (mode !== "password" && mode !== "uuid") throw new Error("不支援的產生方式。");
    if (!crypto || typeof crypto.getRandomValues !== "function") {
      throw new Error("瀏覽器不支援安全隨機數，無法產生密碼或 UUID。");
    }

    if (mode === "uuid") {
      return Array.from({ length: count }, () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      });
    }

    if (!Number.isInteger(length) || length < 1 || length > 64) {
      throw new Error("密碼長度必須是 1 到 64 的整數。");
    }
    if (!Array.isArray(categories) || categories.some((key) => !Object.hasOwn(characterSets, key)) ||
        new Set(categories).size !== categories.length || categories.length === 0) {
      throw new Error("請至少選擇一種有效的字元類別。");
    }
    if (length < categories.length) {
      throw new Error("密碼長度不能小於勾選的字元類別數量。");
    }

    const sets = categories.map((key) => characterSets[key]);
    const alphabet = sets.join("");
    const limit = 256 - 256 % alphabet.length;
    const randomBytes = new Uint8Array(256);
    let position = randomBytes.length;
    function randomCharacter() {
      for (let attempt = 0; attempt < 4096; attempt++) {
        if (position === randomBytes.length) {
          crypto.getRandomValues(randomBytes);
          position = 0;
        }
        const value = randomBytes[position++];
        if (value < limit) return alphabet[value % alphabet.length];
      }
      throw new Error("無法取得有效的隨機資料，請重試。");
    }

    return Array.from({ length: count }, () => {
      for (let attempt = 0; attempt < 10000; attempt++) {
        const password = Array.from({ length }, randomCharacter).join("");
        if (sets.every((set) => Array.from(password).some((char) => set.includes(char)))) return password;
      }
      throw new Error("無法產生符合條件的密碼，請重試。");
    });
  }

  root.lumatekPasswordGenerator = { generate };
})(globalThis);
