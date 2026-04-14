/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { parseNaturalLanguageRule } from "../natural-language-rule-parser";

/**
 * 목적: 자연어 룰 파서 테스트
 */
describe("natural-language-rule-parser", () => {
  it("parses threshold and resource from Korean sentence", () => {
    const rule = parseNaturalLanguageRule("GPU 노드 메모리 90% 넘으면 알려줘");

    expect(rule.condition.resource).toBe("node");
    expect(rule.condition.field).toBe("memory_percent");
    expect(rule.condition.operator).toBe("gt");
    expect(rule.condition.value).toBe("90");
  });
});
