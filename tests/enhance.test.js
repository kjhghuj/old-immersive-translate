"use strict";

function isDuplicatedChild(array, child) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (array[i].contains(child)) {
      return true;
    }
  }
  return false;
}

describe("isDuplicatedChild", () => {
  function createMockNode(tag, children) {
    const node = {
      nodeName: tag.toUpperCase(),
      _children: children || [],
      contains(other) {
        if (this === other) return true;
        for (const c of this._children) {
          if (c.contains(other)) return true;
        }
        return false;
      },
    };
    for (const c of children || []) {
      c._parent = node;
    }
    return node;
  }

  test("returns false for empty array", () => {
    const child = createMockNode("P");
    expect(isDuplicatedChild([], child)).toBe(false);
  });

  test("returns true when array contains parent of child", () => {
    const child = createMockNode("P");
    const parent = createMockNode("DIV", [child]);
    expect(isDuplicatedChild([parent], child)).toBe(true);
  });

  test("returns false when array contains sibling", () => {
    const sibling1 = createMockNode("P");
    const sibling2 = createMockNode("P");
    const parent = createMockNode("DIV", [sibling1, sibling2]);
    expect(isDuplicatedChild([sibling1], sibling2)).toBe(false);
  });

  test("returns false for unrelated nodes", () => {
    const node1 = createMockNode("P");
    const node2 = createMockNode("P");
    expect(isDuplicatedChild([node1], node2)).toBe(false);
  });

  test("handles nested containment", () => {
    const innerP = createMockNode("P");
    const section = createMockNode("SECTION", [innerP]);
    const article = createMockNode("ARTICLE", [section]);
    expect(isDuplicatedChild([article], innerP)).toBe(true);
    expect(isDuplicatedChild([section], innerP)).toBe(true);
  });

  test("does not do reverse containment check", () => {
    const innerP = createMockNode("P");
    const article = createMockNode("ARTICLE", [innerP]);
    expect(isDuplicatedChild([innerP], article)).toBe(false);
  });

  test("checks multiple items in array", () => {
    const child = createMockNode("P");
    const unrelated = createMockNode("DIV");
    const parent = createMockNode("SECTION", [child]);
    expect(isDuplicatedChild([unrelated, parent], child)).toBe(true);
  });

  test("iterates from end to start", () => {
    const child = createMockNode("P");
    const parent1 = createMockNode("DIV", [child]);
    const parent2 = createMockNode("SECTION", [child]);
    expect(isDuplicatedChild([parent1, parent2], child)).toBe(true);
  });
});

describe("structuralElements filter logic", () => {
  const blockElements = [
    "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "OL", "UL", "P", "LI",
    "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "NAV", "ASIDE",
    "BLOCKQUOTE", "FIGURE", "FIGCAPTION", "DETAILS", "SUMMARY", "ADDRESS",
    "DD", "DT", "DL", "FIELDSET"
  ];

  const structuralElements = ["SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "NAV", "ASIDE"];

  test("contentBlockElements excludes structural elements", () => {
    const contentBlockElements = blockElements.filter(
      (tag) => structuralElements.indexOf(tag) === -1
    );
    structuralElements.forEach((se) => {
      expect(contentBlockElements).not.toContain(se);
    });
  });

  test("contentBlockElements includes content elements", () => {
    const contentBlockElements = blockElements.filter(
      (tag) => structuralElements.indexOf(tag) === -1
    );
    expect(contentBlockElements).toContain("P");
    expect(contentBlockElements).toContain("H1");
    expect(contentBlockElements).toContain("H2");
    expect(contentBlockElements).toContain("LI");
    expect(contentBlockElements).toContain("BLOCKQUOTE");
    expect(contentBlockElements).toContain("TABLE");
  });

  test("isSemanticContainer detects ARTICLE", () => {
    const container = { nodeName: "ARTICLE" };
    const isSemantic =
      structuralElements.indexOf(container.nodeName.toUpperCase()) !== -1;
    expect(isSemantic).toBe(true);
  });

  test("isSemanticContainer detects MAIN", () => {
    const container = { nodeName: "MAIN" };
    const isSemantic =
      structuralElements.indexOf(container.nodeName.toUpperCase()) !== -1;
    expect(isSemantic).toBe(true);
  });

  test("isSemanticContainer does not match DIV", () => {
    const container = { nodeName: "DIV" };
    const isSemantic =
      structuralElements.indexOf(container.nodeName.toUpperCase()) !== -1;
    expect(isSemantic).toBe(false);
  });

  test("isSemanticContainer requires exactly 1 container", () => {
    const containers = [{ nodeName: "ARTICLE" }];
    const isSemantic =
      containers.length === 1 &&
      containers[0].nodeName &&
      structuralElements.indexOf(containers[0].nodeName.toUpperCase()) !== -1;
    expect(isSemantic).toBe(true);

    const twoContainers = [{ nodeName: "ARTICLE" }, { nodeName: "MAIN" }];
    const isNotSemantic =
      twoContainers.length === 1 &&
      twoContainers[0].nodeName &&
      structuralElements.indexOf(twoContainers[0].nodeName.toUpperCase()) !== -1;
    expect(isNotSemantic).toBe(false);
  });
});
