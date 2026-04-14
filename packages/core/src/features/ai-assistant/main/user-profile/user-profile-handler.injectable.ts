/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 유저 프로필 IPC 핸들러 등록
 *
 * Renderer의 프로필 조회/피드백/리셋 요청을 Main Process에서 처리합니다.
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import {
  type UserProfileRequest,
  type UserProfileResponse,
  userProfileChannel,
} from "../../common/user-profile-channels";
import userProfileStoreInjectable from "./user-profile-store.injectable";

export const userProfileHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-user-profile-handler",
  channel: userProfileChannel,
  getHandler: (di) => {
    const userProfileStore = di.inject(userProfileStoreInjectable);

    return async (request: UserProfileRequest): Promise<UserProfileResponse> => {
      switch (request.type) {
        case "get-profile": {
          const profile = await userProfileStore.getProfileAsync();

          return { type: "profile", profile: { ...profile } };
        }

        case "get-profile-md": {
          const mdContent = await userProfileStore.getProfileMd();

          return { type: "profile-md", content: mdContent };
        }

        case "update-profile-md": {
          try {
            await userProfileStore.updateProfileMd(request.content);

            return { type: "profile-md-updated", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] MD 업데이트 실패:", error);

            return { type: "profile-md-updated", success: false };
          }
        }

        case "add-feedback": {
          try {
            await userProfileStore.addFeedback(request.feedback);

            return { type: "feedback-added", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] 피드백 추가 실패:", error);

            return { type: "feedback-added", success: false };
          }
        }

        case "reset-profile": {
          try {
            await userProfileStore.reset();

            return { type: "profile-reset", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] 리셋 실패:", error);

            return { type: "profile-reset", success: false };
          }
        }

        case "set-auto-learn": {
          try {
            await userProfileStore.setAutoLearnEnabled(request.enabled);

            return { type: "setting-updated", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] 자동 학습 설정 실패:", error);

            return { type: "setting-updated", success: false };
          }
        }

        case "set-language": {
          try {
            await userProfileStore.setLanguageOverride(request.language);

            return { type: "setting-updated", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] 언어 설정 실패:", error);

            return { type: "setting-updated", success: false };
          }
        }

        case "set-workspace-learning": {
          try {
            await userProfileStore.setWorkspaceLearningEnabled(request.enabled);

            return { type: "setting-updated", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] Workspace 학습 설정 실패:", error);

            return { type: "setting-updated", success: false };
          }
        }

        case "set-auto-approval-rules": {
          try {
            await userProfileStore.setAutoApprovalRules(request.rules);

            return { type: "setting-updated", success: true };
          } catch (error) {
            console.error("[UserProfileHandler] Auto-approval 규칙 설정 실패:", error);

            return { type: "setting-updated", success: false };
          }
        }

        default:
          return { type: "profile", profile: (await userProfileStore.getProfileAsync()) as any };
      }
    };
  },
});

export default userProfileHandlerInjectable;
