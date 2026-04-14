/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 클러스터별 고유 색상 관리 시스템 (하이브리드 전략)
 *
 * 📝 설명:
 * - 7개까지: 디자이너가 선정한 프리미엄 팔레트 사용 (CSS 변수)
 * - 8개 이상: CSS 변수 순환으로 무제한 확장
 * - 캐시 시스템으로 동일 클러스터 = 동일 색상 보장
 *
 * 🎨 사용처:
 * - 사이드바 클러스터 연결 상태 점(●) 색상
 * - 메인 탭 활성 표시 밑줄 색상
 *
 * 🔄 변경이력:
 * - 2025-10-01 - 하이브리드 색상 시스템 구현
 * - 2026-01-31 - THEME-023: CSS 변수로 마이그레이션
 */

/**
 * 🎨 프리미엄 색상 팔레트 (7가지) - CSS 변수 참조
 * 📝 THEME-023: global.css에서 --cluster-palette-* 변수로 정의
 */
const PREMIUM_COLORS = [
  "var(--cluster-palette-1)", // 초록 (주로 production 클러스터)
  "var(--cluster-palette-2)", // 파랑 (development)
  "var(--cluster-palette-3)", // 보라 (staging)
  "var(--cluster-palette-4)", // 주황 (test)
  "var(--cluster-palette-5)", // 핑크
  "var(--cluster-palette-6)", // 청록
  "var(--cluster-palette-7)", // 빨강
];

/**
 * 🎯 목적: 클러스터 ID에 대응하는 고유 색상 반환
 *
 * @param clusterId - 색상을 가져올 클러스터 ID
 * @param allClusterIds - 전체 클러스터 ID 목록
 * @returns CSS 변수 참조 문자열 (7색 순환)
 *
 * 📝 주의사항:
 * - 7색 고정 팔레트 순환 사용 (CSS 변수)
 * - 알파벳 순서로 일관된 색상 할당
 * - 7개 넘으면 다시 1번 색상부터 순환
 *
 * 🔄 변경이력:
 * - 2025-10-26: 노랑 색상 제거 (7색 순환)
 * - 2025-10-01: 8색 순환 방식으로 단순화
 * - 2026-01-31: THEME-023: CSS 변수로 마이그레이션
 */
export function getClusterColor(clusterId: string, allClusterIds: string[]): string {
  // 📊 알파벳 순으로 정렬하여 일관성 보장
  const sortedIds = [...allClusterIds].sort();
  const index = sortedIds.indexOf(clusterId);

  // 🎨 7색 순환 (index % 7) - CSS 변수 참조 반환
  const colorIndex = index % PREMIUM_COLORS.length;

  return PREMIUM_COLORS[colorIndex];
}
