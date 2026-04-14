/**
 * 🎯 목적: SessionManager Injectable
 * AI Assistant 세션 관리자를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - 싱글톤으로 전체 앱에서 하나의 인스턴스만 사용
 * - Main/Renderer 모두에서 사용 가능
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (통합 작업)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { SessionManager } from "./session-manager";

/**
 * SessionManager Injectable
 *
 * 🎯 목적: 세션 CRUD 및 메시지/체크포인트 관리
 */
const sessionManagerInjectable = getInjectable({
  id: "ai-assistant-session-manager",

  instantiate: () => {
    // 싱글톤 인스턴스 생성
    return SessionManager.getInstance({
      maxSessions: 100,
      sessionExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7일
      autoCheckpoint: true,
      autoCheckpointInterval: 5,
    });
  },

  lifecycle: lifecycleEnum.singleton,
});

export default sessionManagerInjectable;
