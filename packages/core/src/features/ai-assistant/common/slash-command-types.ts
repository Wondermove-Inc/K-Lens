/**
 * 🎯 목적: SlashCommand 타입 및 상수 정의
 * 01: SlashCommand 타입 및 기본 명령어 정의
 *
 * 📝 이 파일은 타입과 상수만 정의합니다.
 * 유틸리티 함수는 slash-commands.ts에서 제공합니다.
 *
 * @packageDocumentation
 */

/**
 * 슬래시 명령어 카테고리 상수
 */
export const SlashCommandCategory = {
  GENERAL: "general",
  KUBERNETES: "kubernetes",
  DIAGNOSTICS: "diagnostics",
  NAVIGATION: "navigation",
  PROBLEM_SOLVING: "problem-solving",
  INFRASTRUCTURE: "infrastructure",
  RESEARCH: "research",
} as const;

export type SlashCommandCategoryType = (typeof SlashCommandCategory)[keyof typeof SlashCommandCategory];

/**
 * 슬래시 명령어 ID 상수
 */
export const SlashCommandId = {
  // General 명령어
  CLEAR: "clear",
  NEW: "new",

  // Kubernetes 명령어
  PODS: "pods",
  DEPLOYMENTS: "deployments",
  SERVICES: "services",
  LOGS: "logs",

  // Diagnostics 명령어
  DIAGNOSE: "diagnose",
  METRICS: "metrics",
  EVENTS: "events",

  // Problem Solving 명령어
  SOLVE: "solve",

  // Infrastructure 명령어
  DEVOPS: "devops",
  FINOPS: "finops",
  ASSESSMENT: "assessment",

  // Research 명령어
  RESEARCH: "research",

  // Security Fix 명령어
  FIX_SECURITY: "fix-security",
} as const;

export type SlashCommandIdType = (typeof SlashCommandId)[keyof typeof SlashCommandId];

/**
 * 슬래시 명령어 인자 타입
 */
export interface SlashCommandArg {
  /** 인자 이름 */
  name: string;
  /** 필수 여부 */
  required: boolean;
  /** 설명 */
  description: string;
}

/**
 * 슬래시 명령어 옵션 타입
 * 예: --5whys, --rca, --quick, --deep
 */
export interface SlashCommandOption {
  /** 옵션 이름 (예: "5whys", "rca") */
  name: string;
  /** 옵션 설명 */
  description: string;
  /** 기본값 */
  defaultValue?: string | boolean;
}

/**
 * 워크플로우 단계 정의
 */
export interface WorkflowStep {
  /** 단계 번호 */
  step: number;
  /** 단계 이름 */
  name: string;
  /** 단계 설명 */
  description: string;
  /** 자동 실행 여부 */
  isAutomatic?: boolean;
}

/**
 * 슬래시 명령어 행동 정의
 * .claude/commands/*.md 파일의 구조를 반영
 */
export interface SlashCommandBehavior {
  /** 명령어 목적 설명 */
  purpose: string;
  /** 워크플로우 단계 */
  workflow?: WorkflowStep[];
  /** 사용 가능한 옵션 */
  options?: SlashCommandOption[];
  /** 사용 예시 */
  examples?: string[];
  /** 실행 시 수행할 작업 목록 */
  actions?: string[];
  /** 출력 형식 설명 */
  outputFormat?: string;
  /** 관련 명령어 */
  relatedCommands?: string[];
  /** 허용된 도구 목록 (예: Read, Write, Grep 등) */
  allowedTools?: string[];
  /** Expert Panel 사용 여부 (다관점 분석 활성화) */
  expertPanel?: boolean;
  /** Expert Panel 데이터 수집 시 실행할 쿼리 목록 (명령어별 맞춤) */
  dataQueries?: string[];
}

/**
 * 슬래시 명령어 인터페이스
 */
export interface SlashCommand {
  /** 고유 ID */
  id: SlashCommandIdType | string;
  /** 명령어 이름 (슬래시 포함) */
  name: string;
  /** 명령어 설명 */
  description: string;
  /** 카테고리 */
  category: SlashCommandCategoryType;
  /** 아이콘 */
  icon?: string;
  /** 검색 키워드 */
  keywords?: string[];
  /** 명령어 인자 */
  args?: SlashCommandArg[];
  /** 활성화 여부 */
  enabled?: boolean;
  /** 한글 라벨 */
  label?: string;
  /** 명령어 행동 정의 - 상세한 실행 방법과 워크플로우 */
  behavior?: SlashCommandBehavior;
}

/**
 * 슬래시 명령어 파싱 결과
 */
export interface ParsedSlashCommand {
  /** 명령어 (슬래시 제외) */
  command: string;
  /** 인자 배열 */
  args: string[];
  /** 원본 입력 */
  raw: string;
}

/**
 * 모든 슬래시 명령어 조회 옵션
 */
export interface GetAllSlashCommandsOptions {
  /** 활성화된 명령어만 반환 */
  enabledOnly?: boolean;
}
