const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

require("../aes-crypto.js");
require("../jwt-tool.js");
const { parse, sign, verify, formatPayload } = globalThis.lumatekJwt;

test("signs each supported algorithm with UTF-8 secret and preserves original JSON text", async () => {
  const payload = '{ "uid": 1630804982091234567, "name": "中文😀" }';
  const secret = "密鑰+ key";
  for (const [alg, digest] of [["HS256", "sha256"], ["HS384", "sha384"], ["HS512", "sha512"]]) {
    const header = `{"typ":"JWT","alg":"${alg}"}`;
    const token = await sign(header, payload, secret);
    const input = Buffer.from(header).toString("base64url") + "." + Buffer.from(payload).toString("base64url");
    assert.equal(token, input + "." + createHmac(digest, secret).update(input).digest("base64url"));
    assert.deepEqual(parse(token), { header, payload });
  }
});

test("parses unsigned tokens without claiming signature verification", () => {
  const token = Buffer.from('{"alg":"none"}').toString("base64url") + "." + Buffer.from('{"sub":"user"}').toString("base64url") + ".";
  assert.deepEqual(parse(token), { header: '{"alg":"none"}', payload: '{"sub":"user"}' });
});

test("rejects malformed tokens, invalid UTF-8, and non-object claims", () => {
  const good = Buffer.from("{}").toString("base64url");
  for (const token of ["a.b", `${good}.${good}.a`, `${good}.${good}.AB`, `${good}=.${good}.`, `_w.${good}.`, `${good}.${Buffer.from("[]").toString("base64url")}.`]) {
    assert.throws(() => parse(token));
  }
});

test("rejects invalid signing inputs rather than producing a misleading token", async () => {
  await assert.rejects(sign('{"alg":"none"}', "{}", "key"), /alg/);
  await assert.rejects(sign('{"alg":["HS256"]}', "{}", "key"), /alg/);
  await assert.rejects(sign('{"alg":"HS256","b64":false}', "{}", "key"), /不支援/);
  await assert.rejects(sign('{"alg":"HS256","b64":"true"}', "{}", "key"), /不支援/);
  await assert.rejects(sign('{"alg":"HS256","crit":["ext"]}', "{}", "key"), /不支援/);
  await assert.rejects(sign('{"alg":"HS256"}', "[]", "key"), /JSON 物件/);
  await assert.rejects(sign('{"alg":"HS256"}', "{", "key"), /有效的 JSON/);
  await assert.rejects(sign('{"alg":"HS256"}', "{}", ""), /密鑰/);
});

test("verifies signatures with the original token and detects wrong keys or modified payloads", async () => {
  for (const alg of ["HS256", "HS384", "HS512"]) {
    const token = await sign(`{"alg":"${alg}"}`, '{"sub":"中文"}', "密鑰");
    assert.equal(await verify(token, "密鑰"), true);
    assert.equal(await verify(token, "wrong"), false);
    const parts = token.split(".");
    parts[1] = Buffer.from('{"sub":"modified"}').toString("base64url");
    assert.equal(await verify(parts.join("."), "密鑰"), false);
  }
});

test("reports invalid or unverifiable tokens instead of treating them as valid signatures", async () => {
  const header = Buffer.from('{"alg":"HS256"}').toString("base64url");
  const payload = Buffer.from("{}").toString("base64url");
  await assert.rejects(verify(`${header}.${payload}.`, "key"), /沒有簽章/);
  await assert.rejects(verify("invalid", "key"), /三個部分/);
  await assert.rejects(verify(`${Buffer.from('{"alg":"none"}').toString("base64url")}.${payload}.`, "key"), /alg/);
  const token = await sign('{"alg":"HS256"}', "{}", "key");
  await assert.rejects(verify(token, ""), /密鑰/);
});

test("formats payload without changing large numbers, escaped strings, or duplicate keys", async () => {
  const payload = String.raw`{"id":1234567890123456789012345,"text":" quote: \"{  [ ] }\", slash: \\ ","items":[1e+20,{},[],true,null],"id":-0}`;
  const expected = String.raw`{
  "id": 1234567890123456789012345,
  "text": " quote: \"{  [ ] }\", slash: \\ ",
  "items": [
    1e+20,
    {},
    [],
    true,
    null
  ],
  "id": -0
}`;
  assert.equal(formatPayload(payload), expected);
  assert.equal(formatPayload(expected), expected);
  const token = await sign('{"alg":"HS256"}', expected, "key");
  assert.equal(parse(token).payload, expected);
  assert.equal(await verify(token, "key"), true);
});

test("reports invalid payloads rather than formatting them", () => {
  assert.throws(() => formatPayload('{"broken":}'), /有效的 JSON/);
  assert.throws(() => formatPayload("[]"), /JSON 物件/);
});
