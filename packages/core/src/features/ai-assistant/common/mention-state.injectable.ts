/**
 * 🎯 목적: MentionState Injectable
 * @멘션 상태 관리를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - 멘션 팝업 상태 관리
 * - 선택된 리소스 관리
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (통합 작업)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { MentionState } from "./mention-state";

/**
 * MentionState Injectable
 *
 * 🎯 목적: @멘션 기능 상태 관리
 */
const mentionStateInjectable = getInjectable({
  id: "ai-assistant-mention-state",

  instantiate: () => {
    return new MentionState();
  },

  lifecycle: lifecycleEnum.singleton,
});

export default mentionStateInjectable;
