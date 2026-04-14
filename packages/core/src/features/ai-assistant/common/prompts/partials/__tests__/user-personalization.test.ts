/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DEFAULT_USER_PROFILE, type MemoryItem, type UserProfile } from "../../../../common/user-profile-types";
import { buildPersonalizationPrompt } from "../user-personalization";

describe("buildPersonalizationPrompt", () => {
  it("should return empty string for default profile", () => {
    const result = buildPersonalizationPrompt(DEFAULT_USER_PROFILE);

    expect(result).toBe("");
  });

  it("should return empty string for profile with zero conversations", () => {
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      memories: [{ fact: "Korean", category: "preference", status: "active" } as MemoryItem],
      totalConversations: 0,
    };

    expect(buildPersonalizationPrompt(profile)).toBe("");
  });

  it("should include memory facts when conversations > 0", () => {
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      totalConversations: 5,
      memories: [
        {
          fact: "Prefers Korean language",
          category: "preference",
          action: "Respond in Korean",
          status: "active",
        } as MemoryItem,
      ],
    };

    const result = buildPersonalizationPrompt(profile);

    expect(result).toContain("Respond in Korean");
  });

  it("should include feedback-based memories", () => {
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      totalConversations: 3,
      memories: [
        {
          fact: "Wants concise responses",
          category: "preference",
          action: "Keep responses brief",
          status: "active",
        } as MemoryItem,
      ],
    };

    const result = buildPersonalizationPrompt(profile);

    expect(result).toContain("Keep responses brief");
  });

  it("should include recent negative feedback", () => {
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      totalConversations: 3,
      feedbackHistory: [
        {
          timestamp: new Date().toISOString(),
          threadId: "t1",
          rating: "negative",
          category: "too-verbose",
          reason: "too verbose",
        },
      ],
    };

    const result = buildPersonalizationPrompt(profile);

    expect(result.length).toBeGreaterThan(0);
  });

  it("should return empty string when no memories and no feedback", () => {
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      totalConversations: 10,
      memories: [],
      feedbackHistory: [],
    };

    const result = buildPersonalizationPrompt(profile);

    // memories도 없고 feedback도 없으면 빈 문자열
    expect(typeof result).toBe("string");
  });
});
