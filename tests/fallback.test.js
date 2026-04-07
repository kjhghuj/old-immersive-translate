"use strict";

function resolveEffectiveService(serviceName, config) {
  const aiServices = ["ai", "deepseek", "zhipu"];
  let effectiveService = serviceName;

  if (aiServices.includes(serviceName)) {
    try {
      if (serviceName === "deepseek") {
        if (!String(config.deepseekApiKey || "").trim()) throw new Error("no key");
      } else if (serviceName === "zhipu") {
        if (!String(config.zhipuApiKey || "").trim()) throw new Error("no key");
      } else {
        const endpoint = String(config.aiModelEndpoint || "").trim();
        const apiKey = String(config.aiModelApiKey || "").trim();
        const model = String(config.aiModelName || "").trim();
        if (!endpoint) throw new Error("no endpoint");
        if (!apiKey) throw new Error("no key");
        if (!model) throw new Error("no model");
      }
    } catch (e) {
      effectiveService = "google";
    }
  }

  return effectiveService;
}

describe("Translation fallback logic", () => {
  describe("resolveEffectiveService", () => {
    test("returns google for non-AI services", () => {
      expect(resolveEffectiveService("google", {})).toBe("google");
      expect(resolveEffectiveService("yandex", {})).toBe("yandex");
      expect(resolveEffectiveService("bing", {})).toBe("bing");
    });

    test("returns deepseek when API key is configured", () => {
      const config = { deepseekApiKey: "sk-test-key" };
      expect(resolveEffectiveService("deepseek", config)).toBe("deepseek");
    });

    test("falls back to google when deepseek API key is empty", () => {
      const config = { deepseekApiKey: "" };
      expect(resolveEffectiveService("deepseek", config)).toBe("google");
    });

    test("falls back to google when deepseek API key is whitespace", () => {
      const config = { deepseekApiKey: "   " };
      expect(resolveEffectiveService("deepseek", config)).toBe("google");
    });

    test("falls back to google when deepseek API key is undefined", () => {
      expect(resolveEffectiveService("deepseek", {})).toBe("google");
    });

    test("returns zhipu when API key is configured", () => {
      const config = { zhipuApiKey: "zhipu-key" };
      expect(resolveEffectiveService("zhipu", config)).toBe("zhipu");
    });

    test("falls back to google when zhipu API key is empty", () => {
      const config = { zhipuApiKey: "" };
      expect(resolveEffectiveService("zhipu", config)).toBe("google");
    });

    test("returns ai when all AI config is set", () => {
      const config = {
        aiModelEndpoint: "https://api.example.com",
        aiModelApiKey: "key",
        aiModelName: "gpt-4",
      };
      expect(resolveEffectiveService("ai", config)).toBe("ai");
    });

    test("falls back to google when AI endpoint is missing", () => {
      const config = {
        aiModelApiKey: "key",
        aiModelName: "gpt-4",
      };
      expect(resolveEffectiveService("ai", config)).toBe("google");
    });

    test("falls back to google when AI apiKey is missing", () => {
      const config = {
        aiModelEndpoint: "https://api.example.com",
        aiModelName: "gpt-4",
      };
      expect(resolveEffectiveService("ai", config)).toBe("google");
    });

    test("falls back to google when AI model is missing", () => {
      const config = {
        aiModelEndpoint: "https://api.example.com",
        aiModelApiKey: "key",
      };
      expect(resolveEffectiveService("ai", config)).toBe("google");
    });

    test("falls back to google when all AI config is empty strings", () => {
      const config = {
        aiModelEndpoint: "",
        aiModelApiKey: "",
        aiModelName: "",
      };
      expect(resolveEffectiveService("ai", config)).toBe("google");
    });

    test("falls back to google when AI config is whitespace", () => {
      const config = {
        aiModelEndpoint: "  ",
        aiModelApiKey: "  ",
        aiModelName: "  ",
      };
      expect(resolveEffectiveService("ai", config)).toBe("google");
    });
  });
});
