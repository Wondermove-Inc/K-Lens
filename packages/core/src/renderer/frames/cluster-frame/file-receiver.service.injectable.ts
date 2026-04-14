/**
 * 🎯 목적: FileReceiverService의 DI 등록 및 MainTabStore 연결
 * 📝 기능:
 *   - FileReceiverService를 singleton으로 등록
 *   - MainTabStore.openFileTab을 핸들러로 등록
 *   - postMessage로 Root Frame에서 파일 열기 요청 수신
 * 🔄 변경이력:
 *   - 2026-01-25: FIX-036 - 초기 구현 (diff 탭 열기 지원)
 * @module cluster-frame/file-receiver-service-injectable
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import mainTabStoreInjectable from "../../components/main-tabs/main-tab-store.injectable";
import { FileReceiverService } from "./file-receiver.service";

const fileReceiverServiceInjectable = getInjectable({
  id: "file-receiver-service",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const mainTabStore = di.inject(mainTabStoreInjectable);

    // FileReceiverService 인스턴스 생성
    const service = new FileReceiverService(logger);

    // MainTabStore.openFileTab을 핸들러로 등록
    service.setFileTabOpenHandler(async (filePath, content, readOnly) => {
      try {
        logger.info(`[FileReceiverServiceInjectable] Opening file tab: ${filePath}`);

        const tab = mainTabStore.openFileTab({
          filePath,
          content,
          readOnly,
        });

        return {
          success: true,
          tabId: tab.id,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[FileReceiverServiceInjectable] Failed to open file tab", error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    });

    logger.info("[FileReceiverServiceInjectable] Service initialized with mainTabStore handler");

    return service;
  },

  causesSideEffects: true,
  lifecycle: lifecycleEnum.singleton,
});

export default fileReceiverServiceInjectable;
