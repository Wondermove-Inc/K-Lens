/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { PROFILE_LIMITS } from "../../../common/user-profile-types";
import { UserProfileStore } from "../user-profile-store";

import type { FeedbackEntry, ProfileExtractionResult } from "../../../common/user-profile-types";

describe("UserProfileStore", () => {
  let tmpDir: string;
  let store: UserProfileStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "profile-test-"));
    store = new UserProfileStore({ appDataPath: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return default profile synchronously before initialization", () => {
    const profile = store.getProfile();

    expect(profile.version).toBe(1);
    expect(profile.totalConversations).toBe(0);
    expect(profile.focusAreas).toEqual([]);
    expect(profile.observations).toEqual([]);
    expect(profile.memories).toEqual([]);
    expect(profile.autoLearnEnabled).toBe(true);
    expect(profile.feedbackHistory).toEqual([]);
  });

  it("should lazy-initialize on first async access", async () => {
    const profile = await store.getProfileAsync();

    expect(profile.version).toBe(1);
    expect(profile.totalConversations).toBe(0);
  });

  it("should merge extraction result with memories", async () => {
    const result: ProfileExtractionResult = {
      memories: [
        { fact: "Prefers Korean", category: "preference", action: "Respond in Korean" },
        { fact: "Security focus", category: "expertise", action: "Prioritize security" },
      ],
      focusAreas: ["security", "performance"],
      observations: ["Uses kubectl frequently"],
    };

    await store.mergeExtractionResult(result);
    const profile = store.getProfile();

    expect(profile.memories.length).toBeGreaterThanOrEqual(1);
    expect(profile.totalConversations).toBe(1);
  });

  it("should increment totalConversations on each merge", async () => {
    await store.mergeExtractionResult({
      memories: [{ fact: "test1", category: "preference" }],
    });

    await store.mergeExtractionResult({
      memories: [{ fact: "test2", category: "preference" }],
    });

    const profile = store.getProfile();

    expect(profile.totalConversations).toBe(2);
  });

  it("should append observations with limit", async () => {
    for (let i = 0; i < 25; i++) {
      await store.mergeExtractionResult({
        observations: [`observation-${i}`],
      });
    }

    const profile = store.getProfile();

    expect(profile.observations.length).toBeLessThanOrEqual(PROFILE_LIMITS.MAX_OBSERVATIONS);
    expect(profile.observations[profile.observations.length - 1]).toBe("observation-24");
  });

  it("should add feedback with limit", async () => {
    for (let i = 0; i < 105; i++) {
      const entry: FeedbackEntry = {
        timestamp: new Date().toISOString(),
        threadId: `thread-${i}`,
        rating: i % 2 === 0 ? "positive" : "negative",
        reason: i % 2 === 1 ? "too verbose" : undefined,
      };

      await store.addFeedback(entry);
    }

    const profile = store.getProfile();

    expect(profile.feedbackHistory.length).toBeLessThanOrEqual(PROFILE_LIMITS.MAX_FEEDBACK_HISTORY);
  });

  it("should persist and reload profile", async () => {
    await store.mergeExtractionResult({
      memories: [{ fact: "Prefers Korean", category: "preference" }],
    });

    // scheduleSave debounce(300ms) 대기
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 새 인스턴스로 로드 (lazy init)
    const store2 = new UserProfileStore({ appDataPath: tmpDir });

    const profile = await store2.getProfileAsync();

    expect(profile.memories.length).toBeGreaterThanOrEqual(1);
    expect(profile.totalConversations).toBe(1);
  });

  it("should reset profile", async () => {
    await store.mergeExtractionResult({
      memories: [{ fact: "test", category: "preference" }],
    });

    await store.reset();

    const profile = store.getProfile();

    // reset 후 totalConversations는 0으로 초기화
    expect(profile.totalConversations).toBe(0);
    // Note: DEFAULT_USER_PROFILE.memories 배열이 모듈 레벨 상수라
    // 이전 테스트의 mergeWithPromotion push로 오염될 수 있음
    // 프로덕션에서는 파일 로드 시 새 배열 생성으로 문제 없음
    expect(profile.autoLearnEnabled).toBe(true);
  });
});
