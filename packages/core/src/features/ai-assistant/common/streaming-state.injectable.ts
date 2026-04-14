/**
 * 🎯 목적: StreamingState Injectable
 * LLM 스트리밍 상태 관리를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - 독립적인 상태 관리 클래스
 * - 스트리밍 응답, 토큰 누적, 취소 처리
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (통합 작업)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { StreamingState } from "./streaming-state";

/**
 * StreamingState Injectable
 *
 * 🎯 목적: LLM 스트리밍 응답 상태 관리
 */
const streamingStateInjectable = getInjectable({
  id: "ai-assistant-streaming-state",

  instantiate: () => {
    return new StreamingState();
  },

  lifecycle: lifecycleEnum.singleton,
});

export default streamingStateInjectable;
