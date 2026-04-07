"use strict";

function cbTransformResponse(result, dontSortResults) {
  if (result == null) return [""];
  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) return parsed;
    return [String(result)];
  } catch (e) {
    return [String(result)];
  }
}

describe("cbTransformResponse (AI)", () => {
  test("returns [''] for null input", () => {
    expect(cbTransformResponse(null)).toEqual([""]);
  });

  test("returns [''] for undefined input", () => {
    expect(cbTransformResponse(undefined)).toEqual([""]);
  });

  test("parses JSON array string", () => {
    expect(cbTransformResponse('["hello","world"]')).toEqual(["hello", "world"]);
  });

  test("parses JSON array with single element", () => {
    expect(cbTransformResponse('["hello"]')).toEqual(["hello"]);
  });

  test("returns wrapped string for non-JSON string", () => {
    expect(cbTransformResponse("plain text")).toEqual(["plain text"]);
  });

  test("returns wrapped string for JSON object string", () => {
    expect(cbTransformResponse('{"key":"value"}')).toEqual(['{"key":"value"}']);
  });

  test("handles JSON number", () => {
    expect(cbTransformResponse("42")).toEqual(["42"]);
  });

  test("handles empty string", () => {
    expect(cbTransformResponse("")).toEqual([""]);
  });

  test("handles nested JSON array", () => {
    const input = JSON.stringify([["a", "b"], ["c"]]);
    expect(cbTransformResponse(input)).toEqual([["a", "b"], ["c"]]);
  });

  test("handles JSON array with numbers (converts to items)", () => {
    expect(cbTransformResponse("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("does not throw for any input", () => {
    expect(() => cbTransformResponse(null)).not.toThrow();
    expect(() => cbTransformResponse(undefined)).not.toThrow();
    expect(() => cbTransformResponse("")).not.toThrow();
    expect(() => cbTransformResponse("anything")).not.toThrow();
    expect(() => cbTransformResponse('["a"]')).not.toThrow();
  });
});

function cbTransformResponseYandex(result, dontSortResults) {
  const unescapeHTML = (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  return result
    .split("<wbr>")
    .map((value) => unescapeHTML(value));
}

describe("cbTransformResponse (Yandex)", () => {
  test("splits on <wbr> tag", () => {
    expect(cbTransformResponseYandex("hello<wbr>world")).toEqual(["hello", "world"]);
  });

  test("returns single element for no <wbr>", () => {
    expect(cbTransformResponseYandex("hello")).toEqual(["hello"]);
  });

  test("handles multiple <wbr> tags", () => {
    expect(cbTransformResponseYandex("a<wbr>b<wbr>c")).toEqual(["a", "b", "c"]);
  });

  test("unescapes HTML entities", () => {
    expect(cbTransformResponseYandex("a&amp;b")).toEqual(["a&b"]);
  });
});

function cbTransformResponseBing(result, dontSortResults) {
  const unescapeHTML = (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  return [unescapeHTML(result)];
}

describe("cbTransformResponse (Bing)", () => {
  test("wraps result in array", () => {
    expect(cbTransformResponseBing("hello")).toEqual(["hello"]);
  });

  test("unescapes HTML entities", () => {
    expect(cbTransformResponseBing("a&lt;b&gt;c")).toEqual(["a<b>c"]);
  });
});
