/**
 * 🎯 목적: SlashCommandState Injectable
 * 슬래시 명령어 상태 관리를 DI 컨테이너에 등록
 *
 * 📝 주의사항:
 * - 슬래시 명령어 팝업 상태 관리
 * - 명령어 필터링 및 선택
 * - 기존 싱글톤 인스턴스 재사용
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (통합 작업)
 *
 * @packageDocumentation
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { slashCommandState } from "./slash-command-state";

/**
 * SlashCommandState Injectable
 *
 * 🎯 목적: 슬래시 명령어 기능 상태 관리
 */
const slashCommandStateInjectable = getInjectable({
  id: "ai-assistant-slash-command-state",

  instantiate: () => {
    // 기존 싱글톤 인스턴스 반환
    return slashCommandState;
  },

  lifecycle: lifecycleEnum.singleton,
});

export default slashCommandStateInjectable;
