/**
 * 🎯 목적: ThinkingState Injectable
 * AI 사고 과정 표시 상태 관리를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - 사고 과정 블록 관리
 * - 접기/펼치기 상태 관리
 * - 기존 싱글톤 인스턴스 재사용
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (통합 작업)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { thinkingState } from "./thinking-state";

/**
 * ThinkingState Injectable
 *
 * 🎯 목적: AI 사고 과정 블록 상태 관리
 */
const thinkingStateInjectable = getInjectable({
  id: "ai-assistant-thinking-state",

  instantiate: () => {
    // 기존 싱글톤 인스턴스 반환
    return thinkingState;
  },

  lifecycle: lifecycleEnum.singleton,
});

export default thinkingStateInjectable;
