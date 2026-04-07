"use strict";

function normalizeEndpoint(raw) {
  let url = String(raw || "").trim();
  if (!url) return url;
  url = url.replace(/\/+$/, "");
  if (/\/chat\/completions\/?$/i.test(url)) return url;
  if (/\/v\d+\/?$/.test(url)) return url + "/chat/completions";
  if (!/\/v\d+/.test(url)) return url + "/v1/chat/completions";
  return url + "/chat/completions";
}

function getSettings(overrides = {}) {
  const config = overrides._config || {};
  const endpoint = normalizeEndpoint(
    overrides.endpoint ?? config.aiModelEndpoint ?? ""
  );
  const apiKey = String(
    overrides.apiKey ?? config.aiModelApiKey ?? ""
  ).trim();
  const model = String(
    overrides.model ?? config.aiModelName ?? ""
  ).trim();
  let temperature = Number(
    overrides.temperature ?? config.aiModelTemperature
  );
  if (Number.isNaN(temperature)) temperature = 0.3;
  temperature = Math.max(0, Math.min(2, temperature));
  const systemPrompt =
    String(config.aiSystemPrompt || "").trim() ||
    "You are a translation engine. Translate every string to {targetLanguage}. Preserve meaning, placeholders, whitespace, punctuation, and special markers exactly. Return valid JSON only.";

  if (!endpoint) throw new Error("AI endpoint is not configured");
  if (!apiKey) throw new Error("AI API key is not configured");
  if (!model) throw new Error("AI model is not configured");

  return { endpoint, apiKey, model, temperature, systemPrompt };
}

function parseRequestText(originalText) {
  try {
    const value = JSON.parse(originalText);
    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === "string" ? item : String(item ?? "")
      );
    }
  } catch (e) {}
  return [String(originalText ?? "")];
}

function normalizeResultArray(value) {
  if (!Array.isArray(value)) {
    throw new Error("AI response item must be an array");
  }
  return value.map((item) =>
    typeof item === "string" ? item : String(item ?? "")
  );
}

function extractMessageContent(data) {
  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item.text === "string") return item.text;
        return "";
      })
      .join("");
  }
  return "";
}

function extractJSONArray(text) {
  const trimmed = String(text || "").trim();
  const candidates = [trimmed];

  if (trimmed.startsWith("```")) {
    candidates.push(
      trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
    );
  }

  const firstBrace = trimmed.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = trimmed.lastIndexOf("}");
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.results)) return parsed.results;
      if (parsed && parsed.data && Array.isArray(parsed.data)) return parsed.data;
    } catch (e) {}
  }

  throw new Error("AI response is not valid JSON");
}

describe("AIHelper", () => {
  describe("normalizeEndpoint", () => {
    test("returns empty string for empty input", () => {
      expect(normalizeEndpoint("")).toBe("");
      expect(normalizeEndpoint(null)).toBe("");
      expect(normalizeEndpoint(undefined)).toBe("");
    });

    test("removes trailing slashes", () => {
      expect(normalizeEndpoint("https://api.example.com/")).toBe(
        "https://api.example.com/v1/chat/completions"
      );
      expect(normalizeEndpoint("https://api.example.com///")).toBe(
        "https://api.example.com/v1/chat/completions"
      );
    });

    test("appends /v1/chat/completions for bare domain", () => {
      expect(normalizeEndpoint("https://api.example.com")).toBe(
        "https://api.example.com/v1/chat/completions"
      );
    });

    test("keeps URL unchanged if already ends with /chat/completions", () => {
      expect(normalizeEndpoint("https://api.example.com/v1/chat/completions")).toBe(
        "https://api.example.com/v1/chat/completions"
      );
    });

    test("appends /chat/completions if URL ends with /v1", () => {
      expect(normalizeEndpoint("https://api.example.com/v1")).toBe(
        "https://api.example.com/v1/chat/completions"
      );
    });

    test("appends /chat/completions if URL ends with /v2", () => {
      expect(normalizeEndpoint("https://api.example.com/v2")).toBe(
        "https://api.example.com/v2/chat/completions"
      );
    });

    test("handles deepseek endpoint", () => {
      expect(normalizeEndpoint("https://api.deepseek.com/v1/chat/completions")).toBe(
        "https://api.deepseek.com/v1/chat/completions"
      );
    });

    test("handles zhipu endpoint", () => {
      expect(
        normalizeEndpoint("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions")
      ).toBe("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions");
    });

    test("adds /v1/chat/completions for path without version", () => {
      expect(normalizeEndpoint("https://api.example.com/api")).toBe(
        "https://api.example.com/api/v1/chat/completions"
      );
    });
  });

  describe("getSettings", () => {
    test("throws when endpoint is missing", () => {
      expect(() => getSettings({ apiKey: "key", model: "gpt-4" })).toThrow(
        "AI endpoint is not configured"
      );
    });

    test("throws when apiKey is missing", () => {
      expect(() =>
        getSettings({ endpoint: "https://api.example.com", model: "gpt-4" })
      ).toThrow("AI API key is not configured");
    });

    test("throws when model is missing", () => {
      expect(() =>
        getSettings({ endpoint: "https://api.example.com", apiKey: "key" })
      ).toThrow("AI model is not configured");
    });

    test("returns valid settings with all fields", () => {
      const settings = getSettings({
        endpoint: "https://api.example.com/v1",
        apiKey: "test-key",
        model: "gpt-4",
        temperature: 0.5,
      });
      expect(settings.endpoint).toBe("https://api.example.com/v1/chat/completions");
      expect(settings.apiKey).toBe("test-key");
      expect(settings.model).toBe("gpt-4");
      expect(settings.temperature).toBe(0.5);
    });

    test("clamps temperature to [0, 2]", () => {
      const s1 = getSettings({
        endpoint: "https://api.example.com",
        apiKey: "key",
        model: "m",
        temperature: 5,
      });
      expect(s1.temperature).toBe(2);

      const s2 = getSettings({
        endpoint: "https://api.example.com",
        apiKey: "key",
        model: "m",
        temperature: -1,
      });
      expect(s2.temperature).toBe(0);
    });

    test("defaults temperature to 0.3 when NaN", () => {
      const s = getSettings({
        endpoint: "https://api.example.com",
        apiKey: "key",
        model: "m",
        temperature: NaN,
      });
      expect(s.temperature).toBe(0.3);
    });

    test("reads from _config fallback", () => {
      const s = getSettings({
        _config: {
          aiModelEndpoint: "https://api.example.com",
          aiModelApiKey: "cfg-key",
          aiModelName: "cfg-model",
          aiModelTemperature: 0.7,
        },
      });
      expect(s.apiKey).toBe("cfg-key");
      expect(s.model).toBe("cfg-model");
      expect(s.temperature).toBe(0.7);
    });
  });

  describe("parseRequestText", () => {
    test("parses JSON array", () => {
      expect(parseRequestText('["hello","world"]')).toEqual(["hello", "world"]);
    });

    test("converts non-string items in array", () => {
      expect(parseRequestText('[1, true, null]')).toEqual(["1", "true", ""]);
    });

    test("returns wrapped string for non-JSON", () => {
      expect(parseRequestText("plain text")).toEqual(["plain text"]);
    });

    test("returns wrapped string for JSON object", () => {
      expect(parseRequestText('{"key":"val"}')).toEqual(['{"key":"val"}']);
    });

    test("handles null input", () => {
      expect(parseRequestText(null)).toEqual([""]);
    });

    test("handles undefined input", () => {
      expect(parseRequestText(undefined)).toEqual([""]);
    });

    test("handles empty string", () => {
      expect(parseRequestText("")).toEqual([""]);
    });
  });

  describe("normalizeResultArray", () => {
    test("returns string array for valid array input", () => {
      expect(normalizeResultArray(["hello", "world"])).toEqual(["hello", "world"]);
    });

    test("converts non-string items", () => {
      expect(normalizeResultArray([1, true, null])).toEqual(["1", "true", ""]);
    });

    test("throws for non-array input", () => {
      expect(() => normalizeResultArray("string")).toThrow(
        "AI response item must be an array"
      );
      expect(() => normalizeResultArray(null)).toThrow(
        "AI response item must be an array"
      );
      expect(() => normalizeResultArray(42)).toThrow(
        "AI response item must be an array"
      );
      expect(() => normalizeResultArray({})).toThrow(
        "AI response item must be an array"
      );
    });

    test("handles empty array", () => {
      expect(normalizeResultArray([])).toEqual([]);
    });
  });

  describe("extractMessageContent", () => {
    test("extracts string content", () => {
      const data = {
        choices: [{ message: { content: "Hello world" } }],
      };
      expect(extractMessageContent(data)).toBe("Hello world");
    });

    test("joins array content parts", () => {
      const data = {
        choices: [
          { message: { content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] } },
        ],
      };
      expect(extractMessageContent(data)).toBe("Hello world");
    });

    test("handles mixed array content with string items", () => {
      const data = {
        choices: [{ message: { content: ["Hello", " world"] } }],
      };
      expect(extractMessageContent(data)).toBe("Hello world");
    });

    test("returns empty string for null data", () => {
      expect(extractMessageContent(null)).toBe("");
    });

    test("returns empty string for missing choices", () => {
      expect(extractMessageContent({})).toBe("");
      expect(extractMessageContent({ choices: [] })).toBe("");
    });

    test("returns empty string for null content", () => {
      const data = {
        choices: [{ message: { content: null } }],
      };
      expect(extractMessageContent(data)).toBe("");
    });
  });

  describe("extractJSONArray", () => {
    test("parses plain JSON array", () => {
      expect(extractJSONArray('["a","b"]')).toEqual(["a", "b"]);
    });

    test("parses object with results key", () => {
      const input = JSON.stringify({ results: [["a"], ["b"]] });
      expect(extractJSONArray(input)).toEqual([["a"], ["b"]]);
    });

    test("parses object with data key", () => {
      const input = JSON.stringify({ data: ["x", "y"] });
      expect(extractJSONArray(input)).toEqual(["x", "y"]);
    });

    test("strips markdown code fences", () => {
      const input = '```json\n["hello"]\n```';
      expect(extractJSONArray(input)).toEqual(["hello"]);
    });

    test("extracts JSON from surrounding text", () => {
      const input = 'Here is the result: ["translated text"] and some more';
      expect(extractJSONArray(input)).toEqual(["translated text"]);
    });

    test("extracts JSON object from surrounding text", () => {
      const input = 'Result: {"results":[["a"]]} done';
      expect(extractJSONArray(input)).toEqual([["a"]]);
    });

    test("throws for invalid JSON", () => {
      expect(() => extractJSONArray("not json at all")).toThrow(
        "AI response is not valid JSON"
      );
    });

    test("handles empty string", () => {
      expect(() => extractJSONArray("")).toThrow("AI response is not valid JSON");
    });

    test("handles nested objects with results", () => {
      const input = JSON.stringify({
        results: [["Hello"], ["World"]],
        metadata: { count: 2 },
      });
      expect(extractJSONArray(input)).toEqual([["Hello"], ["World"]]);
    });
  });
});
