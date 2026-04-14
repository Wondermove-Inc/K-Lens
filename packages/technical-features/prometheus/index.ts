/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Prometheus 패키지 Public API
 *
 * 📝 주의사항:
 * - getUnifiedQuery: 통합 PromQL 쿼리 생성 함수 (모든 Prometheus 환경 호환)
 * - prometheusFeature: DI 기능 등록용 피쳐
 * - Provider 관련 export는 하위 호환을 위해 유지
 *
 * 🔄 변경이력: 2026-01-09 - getUnifiedQuery export 추가
 */

export { prometheusFeature } from "./src/feature";
export * from "./src/provider";
export { getUnifiedQuery } from "./src/unified-query";

export type { QueryCategory, QueryOptions } from "./src/unified-query";
