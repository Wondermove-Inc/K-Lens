/**
 * 🎯 목적: SessionState Injectable
 * AI Assistant 세션 상태 관리를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - SessionManager에 의존
 * - MobX observable 상태 관리
 * - Renderer Process에서 사용
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (통합 작업)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import sessionManagerInjectable from "./session-manager.injectable";
import { SessionState } from "./session-state";

/**
 * SessionState Injectable
 *
 * 🎯 목적: 세션 목록/현재 세션/로딩 상태 등 UI 상태 관리
 */
const sessionStateInjectable = getInjectable({
  id: "ai-assistant-session-state",

  instantiate: (di) => {
    const sessionManager = di.inject(sessionManagerInjectable);
    return new SessionState(sessionManager);
  },

  lifecycle: lifecycleEnum.singleton,
});

export default sessionStateInjectable;
