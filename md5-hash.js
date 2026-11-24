import { md5 } from "@noble/hashes/legacy.js";

globalThis.lumatekMd5 = (text) =>
  Array.from(md5(new TextEncoder().encode(text)), (byte) => byte.toString(16).padStart(2, "0")).join("");
