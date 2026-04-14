/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ProfileExtractor DI 등록
 *
 * Main Process에서 ProfileExtractor를 DI 컨테이너에 등록합니다.
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { PROFILE_LIMITS } from "../../common/user-profile-types";
import { ProfileExtractor } from "./profile-extractor";

const profileExtractorInjectable = getInjectable({
  id: "ai-assistant-profile-extractor",
  instantiate: () => {
    return new ProfileExtractor({
      maxMessages: PROFILE_LIMITS.MAX_CONVERSATIONS_FOR_EXTRACTION,
    });
  },
  lifecycle: lifecycleEnum.singleton,
});

export default profileExtractorInjectable;
