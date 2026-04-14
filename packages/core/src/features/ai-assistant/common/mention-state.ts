/**
 * 🎯 목적: MentionState MobX 상태 관리
 * 01: mentionState 상태 및 액션 추가
 *
 * 📝 주요 기능:
 * - @ 멘션 드롭다운 열기/닫기 상태 관리
 * - 검색 쿼리 및 선택 인덱스 관리
 * - 타입 접두사 파싱 (pod:, deployment: 등)
 * - 키보드 네비게이션 지원
 *
 * @packageDocumentation
 */

import { action, makeAutoObservable } from "mobx";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 드롭다운 위치 정보
 */
export interface MentionPosition {
  /** 상단 위치 (px) */
  top: number;
  /** 좌측 위치 (px) */
  left: number;
}

/**
 * MentionState 인터페이스
 */
export interface IMentionState {
  /** 드롭다운 열림 여부 */
  isOpen: boolean;
  /** 검색 쿼리 */
  query: string;
  /** 드롭다운 위치 */
  position: MentionPosition;
  /** 선택된 항목 인덱스 */
  selectedIndex: number;
  /** @ 트리거 위치 인덱스 */
  triggerIndex: number;
  /** 타입 필터 (computed) */
  filterType: string | null;
  /** 검색 쿼리 - 타입 접두사 제외 (computed) */
  searchQuery: string;
}

// ============================================
// 🎯 상수 정의
// ============================================

/**
 * 타입 접두사 파싱 정규식
 * 📝 pod:nginx, deployment:app 형식 지원
 */
const TYPE_PREFIX_REGEX = /^(\w+):(.*)$/;

// ============================================
// 🎯 MobX 상태 클래스
// ============================================

/**
 * MentionState 클래스
 *
 * 📝 기능:
 * - @ 멘션 자동완성 상태 관리
 * - 드롭다운 열기/닫기
 * - 검색 쿼리 및 선택 관리
 * - 타입 접두사 파싱
 */
export class MentionState implements IMentionState {
  // ============================================
  // 🔹 Observable 상태
  // ============================================

  /** 드롭다운 열림 여부 */
  isOpen = false;

  /** 검색 쿼리 (@ 뒤의 텍스트) */
  query = "";

  /** 드롭다운 위치 */
  position: MentionPosition = { top: 0, left: 0 };

  /** 선택된 항목 인덱스 */
  selectedIndex = 0;

  /** @ 트리거 위치 인덱스 (텍스트 내 @ 위치) */
  triggerIndex = -1;

  // ============================================
  // 🔹 생성자
  // ============================================

  constructor() {
    makeAutoObservable(this, {
      openMention: action,
      closeMention: action,
      updateQuery: action,
      setSelectedIndex: action,
      moveSelection: action,
      reset: action,
      detectMentionTrigger: action,
    });
  }

  // ============================================
  // 🔹 Computed 속성
  // ============================================

  /**
   * 타입 필터 추출
   *
   * @returns 타입 접두사 또는 null
   *
   * 📝 예시:
   * - "pod:nginx" → "pod"
   * - "nginx" → null
   */
  get filterType(): string | null {
    const match = this.query.match(TYPE_PREFIX_REGEX);

    if (match) {
      return match[1].toLowerCase();
    }

    return null;
  }

  /**
   * 검색 쿼리 추출 (타입 접두사 제외)
   *
   * @returns 검색어
   *
   * 📝 예시:
   * - "pod:nginx" → "nginx"
   * - "nginx" → "nginx"
   */
  get searchQuery(): string {
    const match = this.query.match(TYPE_PREFIX_REGEX);

    if (match) {
      return match[2];
    }

    return this.query;
  }

  // ============================================
  // 🔹 Actions
  // ============================================

  /**
   * 멘션 드롭다운 열기
   *
   * @param position - 드롭다운 위치
   * @param triggerIndex - @ 트리거 위치
   *
   * 📝 AC2: position 설정 및 isOpen=true
   */
  openMention(position: MentionPosition, triggerIndex: number): void {
    this.isOpen = true;
    this.position = position;
    this.triggerIndex = triggerIndex;
    this.query = "";
    this.selectedIndex = 0;
  }

  /**
   * 멘션 드롭다운 닫기
   *
   * 📝 AC3: 상태 초기화
   */
  closeMention(): void {
    this.reset();
  }

  /**
   * 검색 쿼리 업데이트
   *
   * @param query - 새 검색 쿼리
   *
   * 📝 AC4: 쿼리 업데이트 및 selectedIndex 리셋
   */
  updateQuery(query: string): void {
    this.query = query;
    this.selectedIndex = 0;
  }

  /**
   * 선택 인덱스 설정
   *
   * @param index - 새 인덱스
   */
  setSelectedIndex(index: number): void {
    this.selectedIndex = index;
  }

  /**
   * 선택 항목 이동 (키보드 네비게이션)
   *
   * @param direction - 이동 방향 ("up" | "down")
   * @param maxIndex - 최대 인덱스 (항목 수)
   *
   * 📝 경계값 처리:
   * - 최소: 0
   * - 최대: maxIndex - 1
   */
  moveSelection(direction: "up" | "down", maxIndex: number): void {
    if (direction === "down") {
      // 최대 인덱스 제한
      if (this.selectedIndex < maxIndex - 1) {
        this.selectedIndex += 1;
      }
    } else {
      // 최소 인덱스 제한
      if (this.selectedIndex > 0) {
        this.selectedIndex -= 1;
      }
    }
  }

  /**
   * 상태 초기화
   *
   * 📝 모든 상태를 초기값으로 복원
   */
  reset(): void {
    this.isOpen = false;
    this.query = "";
    this.position = { top: 0, left: 0 };
    this.selectedIndex = 0;
    this.triggerIndex = -1;
  }

  /**
   * 멘션 트리거 감지
   *
   * @param text - 입력 텍스트
   * @param cursorPosition - 커서 위치
   * @param position - 드롭다운 표시 위치
   * @returns 트리거 감지 여부
   *
   * 📝 동작:
   * - @ 입력 감지 시 드롭다운 열기
   * - @ 뒤에 공백 입력 시 드롭다운 닫기
   * - 쿼리 자동 추출
   */
  detectMentionTrigger(text: string, cursorPosition: number, position: MentionPosition): boolean {
    // 커서 앞의 텍스트 분석
    const textBeforeCursor = text.slice(0, cursorPosition);

    // @ 위치 찾기 (마지막 @)
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    // @ 없음
    if (lastAtIndex === -1) {
      if (this.isOpen) {
        this.closeMention();
      }

      return false;
    }

    // @ 뒤의 텍스트
    const afterAt = textBeforeCursor.slice(lastAtIndex + 1);

    // 공백이 포함되어 있으면 멘션 종료
    if (afterAt.includes(" ")) {
      if (this.isOpen) {
        this.closeMention();
      }

      return false;
    }

    // 멘션 열기 또는 쿼리 업데이트
    if (!this.isOpen) {
      this.openMention(position, lastAtIndex);
    }

    // 쿼리 업데이트 (@ 제외)
    if (afterAt !== this.query) {
      this.query = afterAt;
      this.selectedIndex = 0;
    }

    return true;
  }
}

// ============================================
// 🎯 싱글톤 인스턴스
// ============================================

/**
 * 전역 MentionState 인스턴스
 *
 * 📝 사용법:
 * ```typescript
 * import { mentionState } from "./mention-state";
 *
 * // 멘션 열기
 * mentionState.openMention({ top: 100, left: 50 }, 10);
 *
 * // 쿼리 업데이트
 * mentionState.updateQuery("pod:nginx");
 *
 * // 타입 필터 확인
 * console.log(mentionState.filterType); // "pod"
 * ```
 */
export const mentionState = new MentionState();
