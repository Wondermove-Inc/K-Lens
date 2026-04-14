/**
 * common/prompts/index.ts 테스트
 *
 * 검증 항목:
 * 1. PromptBuilder export
 * 2. partials re-export (STANDARD_RULES 등)
 */

import { PromptBuilder } from "../index";
import * as partials from "../partials";

describe("common/prompts/index", () => {
  describe("Exports", () => {
    it("should export PromptBuilder", () => {
      expect(PromptBuilder).toBeDefined();
      expect(typeof PromptBuilder).toBe("function");
    });

    it("should re-export partials", () => {
      expect(partials.STANDARD_RULES).toBeDefined();
      expect(partials.LANGUAGE_INSTRUCTION).toBeDefined();
      expect(partials.EMOJI_PROHIBITION).toBeDefined();
      expect(partials.OUTPUT_FORMAT_RULES).toBeDefined();
    });
  });

  describe("Usage Pattern", () => {
    it("should support PromptBuilder fluent interface", () => {
      const builder = new PromptBuilder();
      const prompt = builder.withStandardRules().withRole("TestAgent@DAIVE").withTask("Test task").build();

      expect(prompt).toContain("TestAgent@DAIVE");
      expect(prompt).toContain("Test task");
    });
  });
});
