/**
 * 🎯 목적: SlashCommand 상태 관리
 * 01: slashCommandState 상태 및 액션 추가
 *
 * 📝 주요 기능:
 * - 팔레트 열기/닫기 상태
 * - 검색어 관리
 * - 선택 인덱스 관리
 * - 슬래시 입력 감지
 * - 명령어 실행
 *
 * @packageDocumentation
 */

import { action, computed, makeObservable, observable } from "mobx";
import {
  getAllSlashCommands,
  getSlashCommandById,
  type SlashCommand,
  type SlashCommandIdType,
  searchSlashCommands,
} from "./slash-commands";

/**
 * SlashCommand 상태 관리 클래스
 *
 * 📝 MobX observable 상태:
 * - isOpen: 팔레트 표시 여부
 * - searchQuery: 검색어
 * - selectedIndex: 현재 선택된 인덱스
 */
class SlashCommandState {
  /** 팔레트 표시 여부 */
  @observable isOpen = false;

  /** 검색어 */
  @observable searchQuery = "";

  /** 현재 선택된 인덱스 */
  @observable selectedIndex = 0;

  constructor() {
    makeObservable(this);
  }

  /**
   * 필터링된 명령어 목록
   */
  @computed
  get filteredCommands(): SlashCommand[] {
    if (!this.searchQuery.trim()) {
      return getAllSlashCommands({ enabledOnly: true });
    }

    return searchSlashCommands(this.searchQuery);
  }

  /**
   * 현재 선택된 명령어
   */
  @computed
  get currentCommand(): SlashCommand | undefined {
    return this.filteredCommands[this.selectedIndex];
  }

  /**
   * 팔레트를 엽니다
   */
  @action
  openPalette(): void {
    this.isOpen = true;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }

  /**
   * 팔레트를 닫습니다
   */
  @action
  closePalette(): void {
    this.isOpen = false;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }

  /**
   * 검색어를 설정합니다
   *
   * @param query - 검색어
   */
  @action
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.selectedIndex = 0; // 검색어 변경 시 인덱스 리셋
  }

  /**
   * 선택 인덱스를 설정합니다
   *
   * @param index - 인덱스
   */
  @action
  setSelectedIndex(index: number): void {
    this.selectedIndex = index;
  }

  /**
   * 선택을 이동합니다
   *
   * @param direction - 이동 방향 ('up' | 'down')
   */
  @action
  moveSelection(direction: "up" | "down"): void {
    const maxIndex = this.filteredCommands.length - 1;

    if (direction === "down") {
      this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
    } else {
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    }
  }

  /**
   * 🎯 목적: 슬래시 입력을 감지합니다
   *
   * 📝 동작:
   * - /로 시작하면 팔레트를 열고 true 반환
   * - / 이후 문자열을 검색어로 설정
   *
   * 📝 2026-01-06 UX 개선 (근본 원인 수정):
   * - 공백이 있으면 팔레트를 열지 않음 (프롬프트 입력 모드)
   * - 공백이 없으면 팔레트 열기 (명령어 검색 모드)
   * - 이로써 "/solve 문제가" 같은 입력 시 Textarea 포커스 유지
   *
   * @param input - 입력 문자열
   * @returns 슬래시 입력 여부
   *
   * 🔄 변경이력: 2026-01-06 - 공백 체크 로직 추가 (프롬프트 입력 불가 버그 수정)
   */
  @action
  detectSlashInput(input: string): boolean {
    // 빈 문자열 체크
    if (!input) {
      return false;
    }

    // 슬래시로 시작하는지 확인
    if (!input.startsWith("/")) {
      return false;
    }

    // / 이후 문자열을 검색어로 설정
    const query = input.slice(1);

    // 🎯 2026-01-06: 공백이 있으면 팔레트를 열지 않음 (프롬프트 입력 모드)
    // "/solve 문제가" 같은 입력은 프롬프트 입력 모드로 간주
    // 이 경우 Textarea에서 타이핑을 계속할 수 있어야 함
    if (query.includes(" ")) {
      // 팔레트가 열려있으면 닫기
      if (this.isOpen) {
        this.isOpen = false;
        this.searchQuery = "";
        this.selectedIndex = 0;
      }
      return true; // 슬래시 입력이지만 팔레트는 열지 않음
    }

    // 공백 없음: 팔레트 열기 (명령어 검색 모드)
    this.isOpen = true;
    this.searchQuery = query;
    this.selectedIndex = 0;

    return true;
  }

  /**
   * 명령어를 실행합니다
   *
   * @param commandId - 명령어 ID
   * @returns 실행된 명령어 또는 undefined
   */
  @action
  executeCommand(commandId: SlashCommandIdType | string): SlashCommand | undefined {
    const command = getSlashCommandById(commandId);

    // 팔레트 닫기
    this.closePalette();

    return command;
  }

  /**
   * 상태를 초기화합니다
   */
  @action
  reset(): void {
    this.isOpen = false;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }
}

/** SlashCommand 상태 인스턴스 */
export const slashCommandState = new SlashCommandState();
