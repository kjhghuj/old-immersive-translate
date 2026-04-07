"use strict";

function shiftLeftOrRightThenSumOrXor(num, optString) {
  for (let i = 0; i < optString.length - 2; i += 3) {
    let acc = optString.charAt(i + 2);
    if ("a" <= acc) {
      acc = acc.charCodeAt(0) - 87;
    } else {
      acc = Number(acc);
    }
    if (optString.charAt(i + 1) == "+") {
      acc = num >>> acc;
    } else {
      acc = num << acc;
    }
    if (optString.charAt(i) == "+") {
      num += acc & 4294967295;
    } else {
      num ^= acc;
    }
  }
  return num;
}

function transformQuery(query) {
  const bytesArray = [];
  let idx = 0;
  for (let i = 0; i < query.length; i++) {
    let charCode = query.charCodeAt(i);
    if (128 > charCode) {
      bytesArray[idx++] = charCode;
    } else {
      if (2048 > charCode) {
        bytesArray[idx++] = (charCode >> 6) | 192;
      } else {
        if (
          55296 == (charCode & 64512) &&
          i + 1 < query.length &&
          56320 == (query.charCodeAt(i + 1) & 64512)
        ) {
          charCode =
            65536 +
            ((charCode & 1023) << 10) +
            (query.charCodeAt(++i) & 1023);
          bytesArray[idx++] = (charCode >> 18) | 240;
          bytesArray[idx++] = ((charCode >> 12) & 63) | 128;
        } else {
          bytesArray[idx++] = (charCode >> 12) | 224;
        }
        bytesArray[idx++] = ((charCode >> 6) & 63) | 128;
      }
      bytesArray[idx++] = (charCode & 63) | 128;
    }
  }
  return bytesArray;
}

function calcHash(query) {
  const windowTkk = "448487.932609646";
  const tkkSplited = windowTkk.split(".");
  const tkkIndex = Number(tkkSplited[0]) || 0;
  const tkkKey = Number(tkkSplited[1]) || 0;

  const bytesArray = transformQuery(query);

  let encondingRound = tkkIndex;
  for (const item of bytesArray) {
    encondingRound += item;
    encondingRound = shiftLeftOrRightThenSumOrXor(encondingRound, "+-a^+6");
  }
  encondingRound = shiftLeftOrRightThenSumOrXor(encondingRound, "+-3^+b+-f");

  encondingRound ^= tkkKey;
  if (encondingRound <= 0) {
    encondingRound = (encondingRound & 2147483647) + 2147483648;
  }

  const normalizedResult = encondingRound % 1000000;
  return normalizedResult.toString() + "." + (normalizedResult ^ tkkIndex);
}

describe("GoogleHelper", () => {
  describe("calcHash", () => {
    test("returns a string with dot separator", () => {
      const hash = calcHash("hello");
      expect(typeof hash).toBe("string");
      expect(hash).toContain(".");
    });

    test("hash format is number.number", () => {
      const hash = calcHash("test");
      const parts = hash.split(".");
      expect(parts.length).toBe(2);
      expect(Number.isInteger(Number(parts[0]))).toBe(true);
      expect(Number.isInteger(Number(parts[1]))).toBe(true);
    });

    test("produces consistent hash for same input", () => {
      const hash1 = calcHash("hello world");
      const hash2 = calcHash("hello world");
      expect(hash1).toBe(hash2);
    });

    test("produces different hashes for different inputs", () => {
      const hash1 = calcHash("hello");
      const hash2 = calcHash("world");
      expect(hash1).not.toBe(hash2);
    });

    test("handles empty string", () => {
      const hash = calcHash("");
      expect(typeof hash).toBe("string");
      expect(hash).toContain(".");
    });

    test("handles Chinese characters", () => {
      const hash = calcHash("你好世界");
      expect(typeof hash).toBe("string");
      expect(hash).toContain(".");
    });

    test("handles special characters", () => {
      const hash = calcHash("<pre>&amp;\"'");
      expect(typeof hash).toBe("string");
      expect(hash).toContain(".");
    });

    test("handles long strings", () => {
      const hash = calcHash("a".repeat(1000));
      expect(typeof hash).toBe("string");
      expect(hash).toContain(".");
    });
  });

  describe("transformQuery", () => {
    test("ASCII characters produce single byte", () => {
      const result = transformQuery("a");
      expect(result).toEqual([97]);
    });

    test("Latin extended characters produce two bytes", () => {
      const result = transformQuery("é");
      expect(result.length).toBe(2);
    });

    test("CJK characters produce three bytes", () => {
      const result = transformQuery("你");
      expect(result.length).toBe(3);
    });

    test("empty string produces empty array", () => {
      expect(transformQuery("")).toEqual([]);
    });
  });
});
