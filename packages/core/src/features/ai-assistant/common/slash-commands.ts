/**
 * 🎯 목적: SlashCommand 유틸리티 함수
 * 01: SlashCommand 타입 및 기본 명령어 정의
 *
 * 📝 주요 기능:
 * - 명령어 조회 (ID, 카테고리, 전체)
 * - 명령어 검색, 파싱, 포맷팅
 *
 * @packageDocumentation
 */

// 타입 및 상수 re-export
export {
  type GetAllSlashCommandsOptions,
  type ParsedSlashCommand,
  type SlashCommand,
  type SlashCommandArg,
  SlashCommandCategory,
  type SlashCommandCategoryType,
  SlashCommandId,
  type SlashCommandIdType,
} from "./slash-command-types";

import { SLASH_COMMANDS } from "./slash-command-data";

import type {
  GetAllSlashCommandsOptions,
  ParsedSlashCommand,
  SlashCommand,
  SlashCommandCategoryType,
  SlashCommandIdType,
} from "./slash-command-types";

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * ID로 슬래시 명령어를 조회합니다
 *
 * @param id - 명령어 ID
 * @returns 명령어 객체 또는 undefined
 */
export function getSlashCommandById(id: SlashCommandIdType | string): SlashCommand | undefined {
  return SLASH_COMMANDS.find((cmd) => cmd.id === id);
}

/**
 * 카테고리별 슬래시 명령어를 조회합니다
 *
 * @param category - 카테고리
 * @returns 해당 카테고리의 명령어 배열
 */
export function getSlashCommandsByCategory(category: SlashCommandCategoryType): SlashCommand[] {
  return SLASH_COMMANDS.filter((cmd) => cmd.category === category);
}

/**
 * 🎯 목적: 명령어 이름으로 슬래시 명령어를 조회합니다
 *
 * 📝 주의사항:
 * - 명령어 이름은 /를 제외한 부분 (예: "solve", "help")
 * - 대소문자 구분 없이 검색
 *
 * @param name - 명령어 이름 (슬래시 제외)
 * @returns 명령어 객체 또는 undefined
 *
 * 🔄 변경이력: 2026-01-06 - 초기 생성 (슬래시 명령어 파싱 버그 수정)
 */
export function getSlashCommandByName(name: string): SlashCommand | undefined {
  if (!name) {
    return undefined;
  }
  const lowerName = name.toLowerCase();

  // /로 시작하면 제거
  const cleanName = lowerName.startsWith("/") ? lowerName.slice(1) : lowerName;

  return SLASH_COMMANDS.find((cmd) => {
    // cmd.name은 "/solve" 형태이므로 / 제거 후 비교
    const cmdNameWithoutSlash = cmd.name.startsWith("/") ? cmd.name.slice(1).toLowerCase() : cmd.name.toLowerCase();

    return cmdNameWithoutSlash === cleanName;
  });
}

/**
 * 모든 슬래시 명령어를 조회합니다
 *
 * @param options - 조회 옵션
 * @returns 명령어 배열
 */
export function getAllSlashCommands(options?: GetAllSlashCommandsOptions): SlashCommand[] {
  if (options?.enabledOnly) {
    return SLASH_COMMANDS.filter((cmd) => cmd.enabled !== false);
  }

  return [...SLASH_COMMANDS];
}

/**
 * 명령어의 한글 라벨을 반환합니다
 *
 * @param id - 명령어 ID
 * @returns 한글 라벨 또는 빈 문자열
 */
export function getSlashCommandLabel(id: SlashCommandIdType | string): string {
  const cmd = getSlashCommandById(id);

  return cmd?.label ?? "";
}

/**
 * Skill Registry의 enabled 상태를 슬래시 명령어 팔레트에 동기화합니다.
 * Settings에서 스킬을 disable하면 "/" 팔레트에서도 숨깁니다.
 *
 * @param disabledIds - 비활성화된 스킬 ID 목록
 */
export function syncSlashCommandEnabled(disabledIds: Set<string>): void {
  for (const cmd of SLASH_COMMANDS) {
    // cmd.id는 SlashCommandId enum 값 (e.g., "PODS"), name은 "/pods"
    const skillId = cmd.name.startsWith("/") ? cmd.name.slice(1) : cmd.name;

    if (disabledIds.has(skillId)) {
      cmd.enabled = false;
    } else if (cmd.enabled === false) {
      // 이전에 disabled됐지만 다시 enabled된 경우 복원
      cmd.enabled = true;
    }
  }
}

/**
 * 검색어로 슬래시 명령어를 검색합니다
 *
 * 📝 검색 대상:
 * - 명령어 이름
 * - 설명
 * - 키워드
 * - 한글 라벨
 *
 * @param query - 검색어 (대소문자 구분 없음)
 * @returns 검색 결과 명령어 배열
 */
export function searchSlashCommands(query: string): SlashCommand[] {
  // 빈 검색어는 모든 명령어 반환
  if (!query.trim()) {
    return getAllSlashCommands();
  }

  const lowerQuery = query.toLowerCase();

  return SLASH_COMMANDS.filter((cmd) => {
    // Skip disabled commands
    if (cmd.enabled === false) return false;
    // 이름 검색
    if (cmd.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // ID 검색
    if (cmd.id.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 설명 검색
    if (cmd.description.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 라벨 검색
    if (cmd.label?.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 키워드 검색
    if (cmd.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))) {
      return true;
    }

    return false;
  });
}

/**
 * 명령어 활성화 여부를 확인합니다
 *
 * @param id - 명령어 ID
 * @returns 활성화 여부 (명령어가 없으면 false)
 */
export function isSlashCommandEnabled(id: SlashCommandIdType | string): boolean {
  const cmd = getSlashCommandById(id);

  return cmd?.enabled !== false;
}

/**
 * 슬래시 명령어 입력을 파싱합니다
 *
 * 📝 파싱 규칙:
 * - 슬래시(/)로 시작해야 함
 * - 공백으로 명령어와 인자 구분
 * - 슬래시만 있으면 빈 command 반환
 *
 * @param input - 입력 문자열
 * @returns 파싱된 명령어 또는 null
 */
export function parseSlashCommandInput(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();

  // 빈 문자열이거나 공백만 있으면 null
  if (!trimmed) {
    return null;
  }

  // 슬래시로 시작하지 않으면 null
  if (!trimmed.startsWith("/")) {
    return null;
  }

  // 슬래시 이후 부분 파싱
  const withoutSlash = trimmed.slice(1);
  const parts = withoutSlash.split(/\s+/).filter((p) => p.length > 0);

  return {
    command: parts[0] ?? "",
    args: parts.slice(1),
    raw: input,
  };
}

/**
 * 명령어 사용법을 포맷합니다
 *
 * @param id - 명령어 ID
 * @returns 포맷된 사용법 문자열
 */
export function formatSlashCommandUsage(id: SlashCommandIdType | string): string {
  const cmd = getSlashCommandById(id);

  if (!cmd) {
    return "";
  }

  // 기본 명령어 이름
  let usage = cmd.name;

  // 인자가 있으면 추가
  if (cmd.args && cmd.args.length > 0) {
    const argsStr = cmd.args.map((arg) => arg.name).join(" ");

    usage += ` ${argsStr}`;
  }

  return usage;
}
