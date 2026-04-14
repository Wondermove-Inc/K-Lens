/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ProfileExtractor } from "../profile-extractor";

import type { ThreadMessage } from "../../../common/agent-ipc-channels";

// Mock LLM model
function createMockModel(response: string) {
  return {
    invoke: jest.fn().mockResolvedValue({ content: response }),
  } as any;
}

function createMessages(count: number, roles: Array<"user" | "assistant"> = ["user", "assistant"]): ThreadMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    threadId: "test-thread",
    role: roles[i % roles.length],
    content: `Test message ${i}`,
    timestamp: new Date().toISOString(),
  }));
}

describe("ProfileExtractor", () => {
  let extractor: ProfileExtractor;

  beforeEach(() => {
    extractor = new ProfileExtractor({ maxMessages: 30 });
  });

  it("should return null for fewer than 1 user message", async () => {
    const messages: ThreadMessage[] = [];
    const model = createMockModel("{}");

    const result = await extractor.extract(messages, model);

    expect(result).toBeNull();
  });

  it("should extract valid memories-based JSON response", async () => {
    const messages = createMessages(6);
    const model = createMockModel(
      JSON.stringify({
        memories: [
          { fact: "Prefers Korean", category: "preference", action: "Respond in Korean" },
          { fact: "Security focused", category: "behavior", action: "Prioritize security" },
        ],
      }),
    );

    const result = await extractor.extract(messages, model);

    expect(result).not.toBeNull();
    expect(result!.memories).toBeDefined();
    expect(result!.memories!.length).toBe(2);
    expect(result!.memories![0].fact).toBe("Prefers Korean");
  });

  it("should handle markdown-wrapped JSON response", async () => {
    const messages = createMessages(6);
    const model = createMockModel(
      "```json\n" +
        JSON.stringify({
          memories: [{ fact: "Uses kubectl", category: "behavior", action: "Assume kubectl familiarity" }],
        }) +
        "\n```",
    );

    const result = await extractor.extract(messages, model);

    expect(result).not.toBeNull();
    expect(result!.memories!.length).toBe(1);
  });

  it("should handle response with extra text around JSON", async () => {
    const messages = createMessages(6);
    const jsonStr = JSON.stringify({
      memories: [{ fact: "Advanced user", category: "preference", action: "Use technical terms" }],
    });
    const model = createMockModel("Here is the analysis:\n" + jsonStr + "\nDone.");

    const result = await extractor.extract(messages, model);

    expect(result).not.toBeNull();
    expect(result!.memories!.length).toBe(1);
  });

  it("should handle focusAreas migration compat", async () => {
    const messages = createMessages(6);
    const model = createMockModel(
      JSON.stringify({
        focusAreas: ["security", "performance"],
      }),
    );

    const result = await extractor.extract(messages, model);

    expect(result).not.toBeNull();
    // focusAreas는 memories로 변환됨
    expect(result!.memories).toBeDefined();
    expect(result!.memories!.length).toBe(2);
  });

  it("should limit memories to 10 items", async () => {
    const messages = createMessages(6);
    const memories = Array.from({ length: 15 }, (_, i) => ({
      fact: `Fact ${i}`,
      category: "behavior",
      action: `Action ${i}`,
    }));
    const model = createMockModel(JSON.stringify({ memories }));

    const result = await extractor.extract(messages, model);

    expect(result).not.toBeNull();
    expect(result!.memories!.length).toBeLessThanOrEqual(10);
  });

  it("should return null on invalid JSON", async () => {
    const messages = createMessages(6);
    const model = createMockModel("This is not JSON at all");

    const result = await extractor.extract(messages, model);

    expect(result).toBeNull();
  });
});
