/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ConversationLogger DI 등록
 *
 * Main Process에서 ConversationLogger를 DI 컨테이너에 등록합니다.
 * 대화 히스토리를 JSONL 파일로 영구 저장합니다.
 *
 * 📝 의존성:
 * - directoryForUserData: 앱 데이터 디렉토리 경로
 *
 * 🔄 변경이력:
 * - 2025-12-29: 초기 생성 (파일 기반 저장으로 전환)
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { ConversationLogger } from "./conversation-logger";

/**
 * 🎯 ConversationLogger Injectable
 *
 * 앱 시작 시 singleton으로 생성되며, 대화 히스토리를 파일로 저장합니다.
 */
const conversationLoggerInjectable = getInjectable({
  id: "ai-assistant-conversation-logger",
  instantiate: async (di) => {
    const userDataPath = di.inject(directoryForUserDataInjectable);

    const logger = new ConversationLogger({
      appDataPath: userDataPath,
    });

    await logger.initialize();

    return logger;
  },
  lifecycle: lifecycleEnum.singleton,
});

export default conversationLoggerInjectable;
