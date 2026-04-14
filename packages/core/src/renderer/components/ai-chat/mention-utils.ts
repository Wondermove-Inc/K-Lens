/**
 * 🎯 목적: Mention 유틸리티 함수
 * 01: @ 입력 감지 로직 구현
 *
 * 📝 주요 기능:
 * - @ 입력 감지 및 트리거 위치 계산
 * - 멘션 쿼리 추출 (타입 지정 지원)
 * - 캐럿(커서) 좌표 계산
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 멘션 트리거 감지 결과
 */
export interface MentionTriggerResult {
  /** @ 문자의 인덱스 위치 */
  triggerIndex: number;
  /** @ 뒤의 쿼리 문자열 */
  query: string;
}

/**
 * 멘션 타입 파싱 결과
 */
export interface MentionTypeResult {
  /** 멘션 타입 (pod, deployment, namespace 등) */
  type: string | null;
  /** 타입 뒤의 쿼리 문자열 */
  query: string;
}

/**
 * 캐럿 좌표
 */
export interface CaretCoordinates {
  /** 상단 위치 (px) */
  top: number;
  /** 좌측 위치 (px) */
  left: number;
}

// ============================================
// 🎯 상수 정의
// ============================================

/**
 * 멘션 쿼리 추출 정규식
 * 📝 @ 문자 뒤의 모든 문자열 추출
 */
const QUERY_PATTERN = /^@(.*)$/;

/**
 * 멘션 타입 파싱 정규식
 * 📝 @type:query 형식 지원
 */
const TYPE_PATTERN = /^@(\w+):(.*)$/;

/**
 * 지원되는 멘션 타입 목록
 */
const SUPPORTED_TYPES = [
  "pod",
  "deployment",
  "service",
  "namespace",
  "node",
  "configmap",
  "secret",
  "ingress",
  "job",
  "cronjob",
  "statefulset",
  "daemonset",
  "replicaset",
  "pvc",
];

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * @ 입력을 감지하고 트리거 정보를 반환합니다
 *
 * 📝 동작:
 * - 커서 위치 기준으로 가장 가까운 @를 찾음
 * - @ 뒤에 공백이 있으면 트리거 종료
 * - 여러 @가 있으면 커서에 가장 가까운 것 사용
 *
 * @param text - 입력 텍스트
 * @param cursorPosition - 현재 커서 위치
 * @returns 트리거 결과 또는 null
 */
export function detectMentionTrigger(text: string, cursorPosition: number): MentionTriggerResult | null {
  // 커서 위치까지의 텍스트만 분석
  const textUpToCursor = text.slice(0, cursorPosition);

  // @ 문자의 모든 위치 찾기 (뒤에서부터)
  let lastAtIndex = -1;

  for (let i = textUpToCursor.length - 1; i >= 0; i--) {
    if (textUpToCursor[i] === "@") {
      lastAtIndex = i;
      break;
    }
  }

  // @가 없으면 null
  if (lastAtIndex === -1) {
    return null;
  }

  // @ 이후 커서까지의 텍스트 추출
  const textAfterAt = textUpToCursor.slice(lastAtIndex + 1);

  // 공백이 있으면 트리거 종료 (멘션 완료됨)
  if (textAfterAt.includes(" ")) {
    return null;
  }

  return {
    triggerIndex: lastAtIndex,
    query: textAfterAt,
  };
}

/**
 * 멘션 문자열에서 쿼리를 추출합니다
 *
 * 📝 동작:
 * - @pod:nginx → "nginx" (타입이 있는 경우)
 * - @nginx → "nginx" (타입이 없는 경우)
 *
 * @param mention - @ 포함 멘션 문자열
 * @returns 추출된 쿼리
 */
export function extractMentionQuery(mention: string): string {
  // 타입이 있는 경우 (@type:query)
  const typeMatch = mention.match(TYPE_PATTERN);

  if (typeMatch) {
    return typeMatch[2];
  }

  // 타입이 없는 경우 (@query)
  const queryMatch = mention.match(QUERY_PATTERN);

  if (queryMatch) {
    return queryMatch[1];
  }

  return "";
}

/**
 * 멘션 문자열에서 타입과 쿼리를 분리합니다
 *
 * 📝 동작:
 * - @pod:nginx → { type: "pod", query: "nginx" }
 * - @nginx → { type: null, query: "nginx" }
 * - @pod: → { type: "pod", query: "" }
 *
 * @param mention - @ 포함 멘션 문자열
 * @returns 타입과 쿼리 분리 결과
 */
export function parseMentionType(mention: string): MentionTypeResult {
  // 타입이 있는 경우 (@type:query)
  const typeMatch = mention.match(TYPE_PATTERN);

  if (typeMatch) {
    return {
      type: typeMatch[1].toLowerCase(),
      query: typeMatch[2],
    };
  }

  // 타입이 없는 경우 (@query)
  const queryMatch = mention.match(QUERY_PATTERN);

  if (queryMatch) {
    return {
      type: null,
      query: queryMatch[1],
    };
  }

  return {
    type: null,
    query: "",
  };
}

/**
 * Textarea에서 특정 위치의 캐럿 좌표를 계산합니다
 *
 * 📝 동작:
 * - 미러 div를 생성하여 텍스트 렌더링
 * - 커서 위치에 span을 삽입하여 좌표 계산
 * - 스크롤 오프셋 고려
 *
 * @param textarea - textarea 요소
 * @param position - 캐럿 위치
 * @returns 좌표 객체
 */
export function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number): CaretCoordinates {
  // 기본 좌표 (계산 실패 시)
  const defaultCoords: CaretCoordinates = { top: 0, left: 0 };

  if (!textarea) {
    return defaultCoords;
  }

  // 미러 div 생성
  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(textarea);

  // 스타일 복사 (텍스트 렌더링에 필요한 속성들)
  const stylesToCopy = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "line-height",
    "text-transform",
    "word-spacing",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "box-sizing",
    "width",
    "white-space",
    "word-wrap",
    "overflow-wrap",
  ];

  mirror.style.cssText = stylesToCopy.map((prop) => `${prop}: ${computed.getPropertyValue(prop)}`).join("; ");

  // 미러 위치 설정 (화면 밖)
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflow = "hidden";

  // 텍스트 삽입 (커서 위치에 마커 span)
  const textBeforeCursor = textarea.value.substring(0, position);
  const markerSpan = document.createElement("span");

  markerSpan.textContent = "\u200B"; // Zero-width space

  mirror.textContent = textBeforeCursor;
  mirror.appendChild(markerSpan);

  document.body.appendChild(mirror);

  // 좌표 계산
  const textareaRect = textarea.getBoundingClientRect();
  const markerRect = markerSpan.getBoundingClientRect();

  const coords: CaretCoordinates = {
    top: markerRect.top - textareaRect.top + textarea.scrollTop,
    left: markerRect.left - textareaRect.left + textarea.scrollLeft,
  };

  // 미러 제거
  document.body.removeChild(mirror);

  return coords;
}

/**
 * 멘션 타입이 지원되는지 확인합니다
 *
 * @param type - 멘션 타입
 * @returns 지원 여부
 */
export function isSupportedMentionType(type: string): boolean {
  return SUPPORTED_TYPES.includes(type.toLowerCase());
}

/**
 * 멘션 문자열을 완성합니다
 *
 * 📝 동작:
 * - 기존 텍스트에서 @ 부분을 선택된 멘션으로 교체
 *
 * @param text - 원본 텍스트
 * @param triggerIndex - @ 시작 인덱스
 * @param cursorPosition - 현재 커서 위치
 * @param replacement - 교체할 멘션 문자열
 * @returns 새 텍스트와 새 커서 위치
 */
export function completeMention(
  text: string,
  triggerIndex: number,
  cursorPosition: number,
  replacement: string,
): { newText: string; newCursorPosition: number } {
  const before = text.slice(0, triggerIndex);
  const after = text.slice(cursorPosition);

  // 멘션 뒤에 공백 추가
  const mentionWithSpace = replacement + " ";

  return {
    newText: before + mentionWithSpace + after,
    newCursorPosition: before.length + mentionWithSpace.length,
  };
}
