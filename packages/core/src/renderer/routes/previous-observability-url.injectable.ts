/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 화면에서 Explorer로 이동 후 복귀 시 이전 URL 저장
 *
 * 📝 사용 시나리오:
 * 1. 사용자가 Observability webview에서 내부 네비게이션
 * 2. Explorer 클릭하여 클라이언트 화면으로 이동
 * 3. 다시 Observability 클릭
 * 4. 저장된 URL로 webview 복원
 *
 * 📝 주의사항:
 * - MobX observable.box로 상태 관리 (메모리 내 상태)
 * - 앱 재시작 시 자동 초기화 → 기본 URL로 폴백
 * - webview의 did-navigate 이벤트로 URL 자동 추적
 *
 * 🔄 변경이력:
 * - 2026-01-19: 초기 생성 (Observability URL 복원 기능 - Issue #117)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

/**
 * 🎯 목적: 이전 Observability URL을 저장하는 MobX observable box
 *
 * 📝 사용법:
 * - get(): 저장된 URL 조회 (null이면 저장된 값 없음)
 * - set(url): 새 URL 저장
 *
 * 📝 동작:
 * - webview의 did-navigate 이벤트 발생 시 자동으로 URL 저장
 * - Observability 컴포넌트 재마운트 시 저장된 URL 사용
 *
 * @returns MobX IObservableValue<string | null>
 */
const previousObservabilityUrlInjectable = getInjectable({
  id: "previous-observability-url",
  instantiate: () => observable.box<string | null>(null),
});

export default previousObservabilityUrlInjectable;
