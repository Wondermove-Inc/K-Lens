/**
 * 🎯 목적: AgentModeController Injectable
 * Agent Mode 컨트롤러를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - Agent Mode 상태 관리
 * - 단계별 실행 제어
 * - 승인/거부 처리
 * - 자동 실행 관리
 *
 * 🔄 변경이력:
 * - 2026-01-06: 초기 생성 (AgentProgress 연결용)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { AgentModeController } from "./agent-mode-controller";

/**
 * AgentModeController Injectable
 *
 * 🎯 목적: Agent Mode 실행 제어를 위한 컨트롤러 제공
 *
 * 📝 사용법:
 * ```typescript
 * const controller = di.inject(agentModeControllerInjectable);
 * await controller.start("목표 설명");
 * controller.pause();
 * controller.resume();
 * controller.stop();
 * ```
 */
const agentModeControllerInjectable = getInjectable({
  id: "ai-assistant-agent-mode-controller",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);

    return new AgentModeController({ logger });
  },

  lifecycle: lifecycleEnum.singleton,
});

export default agentModeControllerInjectable;
