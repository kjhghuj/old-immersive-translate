"use strict";

function escapeHTML(unsafe) {
  return unsafe
    .replace(/\&/g, "&amp;")
    .replace(/\</g, "&lt;")
    .replace(/\>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/\'/g, "&#39;");
}

function unescapeHTML(unsafe) {
  return unsafe
    .replace(/\&amp;/g, "&")
    .replace(/\&lt;/g, "<")
    .replace(/\&gt;/g, ">")
    .replace(/\&quot;/g, '"')
    .replace(/\&\#39;/g, "'");
}

describe("Utils", () => {
  describe("escapeHTML", () => {
    test("escapes & character", () => {
      expect(escapeHTML("a&b")).toBe("a&amp;b");
    });

    test("escapes < character", () => {
      expect(escapeHTML("a<b")).toBe("a&lt;b");
    });

    test("escapes > character", () => {
      expect(escapeHTML("a>b")).toBe("a&gt;b");
    });

    test("escapes double quote", () => {
      expect(escapeHTML('a"b')).toBe("a&quot;b");
    });

    test("escapes single quote", () => {
      expect(escapeHTML("a'b")).toBe("a&#39;b");
    });

    test("escapes all special characters together", () => {
      expect(escapeHTML("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
    });

    test("leaves normal text unchanged", () => {
      expect(escapeHTML("hello world")).toBe("hello world");
    });

    test("handles empty string", () => {
      expect(escapeHTML("")).toBe("");
    });

    test("escapes HTML tags", () => {
      expect(escapeHTML("<div>content</div>")).toBe(
        "&lt;div&gt;content&lt;/div&gt;"
      );
    });
  });

  describe("unescapeHTML", () => {
    test("unescapes &amp;", () => {
      expect(unescapeHTML("a&amp;b")).toBe("a&b");
    });

    test("unescapes &lt;", () => {
      expect(unescapeHTML("a&lt;b")).toBe("a<b");
    });

    test("unescapes &gt;", () => {
      expect(unescapeHTML("a&gt;b")).toBe("a>b");
    });

    test("unescapes &quot;", () => {
      expect(unescapeHTML("a&quot;b")).toBe('a"b');
    });

    test("unescapes &#39;", () => {
      expect(unescapeHTML("a&#39;b")).toBe("a'b");
    });

    test("roundtrip: escape then unescape", () => {
      const original = "&<>\"'";
      expect(unescapeHTML(escapeHTML(original))).toBe(original);
    });

    test("handles empty string", () => {
      expect(unescapeHTML("")).toBe("");
    });

    test("leaves normal text unchanged", () => {
      expect(unescapeHTML("hello world")).toBe("hello world");
    });
  });

  describe("roundtrip", () => {
    const testCases = [
      "Hello & goodbye",
      "<p>Paragraph</p>",
      "It's a \"test\"",
      "a&b<c>d'e\"f",
      "Hello 世界 & <世界>",
    ];

    testCases.forEach((input) => {
      test(`roundtrip for: ${input.slice(0, 30)}`, () => {
        expect(unescapeHTML(escapeHTML(input))).toBe(input);
      });
    });
  });
});
