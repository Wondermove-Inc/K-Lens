/**
 * 🎯 THEME-040: Unified Semantic Status Utility
 * 📝 Pod/Workload 상태를 시맨틱 색상으로 매핑하는 유틸리티
 *
 * 목적:
 * - 중복된 상태 매핑 로직 통합 (pods-status-column, status-cell 등)
 * - CSS 변수 기반 시맨틱 색상 시스템 활용
 * - 텍스트 색상 자동 결정 (배경 밝기 기준)
 *
 * 사용법:
 * ```typescript
 * import { getSemanticStatus, getStatusClasses } from './semantic-status';
 *
 * const status = getSemanticStatus('Running'); // 'running'
 * const classes = getStatusClasses('Failed'); // 'bg-semantic-failed text-semantic-failed-text'
 * ```
 *
 * @packageDocumentation
 */

/**
 * 시맨틱 상태 타입
 * - running: 활성 상태 (Running, ContainerCreating 등)
 * - success: 성공 상태 (Succeeded, Completed 등)
 * - warning: 대기/경고 상태 (Pending, Waiting 등)
 * - error: 실패 상태 (Failed, Error, CrashLoopBackOff 등)
 * - neutral: 비활성/알 수 없음 상태 (Unknown, Terminated 등)
 */
export type SemanticStatus = "running" | "success" | "warning" | "error" | "neutral";

/**
 * Pod 상태 → 시맨틱 상태 매핑 테이블
 * 📝 모든 상태는 소문자로 정규화하여 매핑
 */
const POD_STATUS_MAP: Record<string, SemanticStatus> = {
  // Running/Active 상태
  running: "running",
  "container-creating": "running",
  "pod-initializing": "running",
  "containers-ready": "running",
  // Success 상태
  succeeded: "success",
  completed: "success",
  complete: "success",
  ready: "success",
  scheduled: "success",
  initialized: "success",
  // Warning/Pending 상태
  pending: "warning",
  waiting: "warning",
  "init:waiting": "warning",
  // Error 상태
  failed: "error",
  error: "error",
  "crash-loop-back-off": "error",
  crashloopbackoff: "error",
  evicted: "error",
  "image-pull-back-off": "error",
  imagepullbackoff: "error",
  "err-image-pull": "error",
  "oom-killed": "error",
  oomkilled: "error", // OOMKilled (연속 대문자 처리)
  // Neutral 상태
  terminated: "neutral",
  terminating: "neutral",
  finalizing: "neutral",
  unknown: "neutral",
  restarted: "neutral",
};

/**
 * 🎯 문자열 상태를 시맨틱 상태로 변환
 *
 * @param status - 원본 상태 문자열 (대소문자 무관)
 * @returns SemanticStatus 값 (기본: 'neutral')
 *
 * @example
 * ```typescript
 * getSemanticStatus('Running') // 'running'
 * getSemanticStatus('CrashLoopBackOff') // 'error'
 * getSemanticStatus('Unknown') // 'neutral'
 * ```
 */
export function getSemanticStatus(status: string): SemanticStatus {
  // 상태 문자열 정규화: CamelCase → kebab-case 변환 후 소문자
  // 🔧 순서 중요: CamelCase 변환 먼저 → 그 후 소문자 변환
  const normalized = status.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

  // 정확한 매핑 먼저 확인
  if (POD_STATUS_MAP[normalized]) {
    return POD_STATUS_MAP[normalized];
  }

  // 부분 문자열 매칭 (includes 기반)
  if (normalized.includes("running")) return "running";
  if (normalized.includes("creating")) return "running";
  if (normalized.includes("succeeded") || normalized.includes("completed") || normalized.includes("complete"))
    return "success";
  if (normalized.includes("pending") || normalized.includes("waiting")) return "warning";
  if (
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("crash") ||
    normalized.includes("evicted")
  )
    return "error";

  return "neutral";
}

/**
 * 🎯 상태에 해당하는 CSS 변수 기반 클래스 문자열 반환
 *
 * @param status - 원본 상태 문자열 또는 SemanticStatus
 * @returns Tailwind 유틸리티 클래스 문자열
 *
 * @example
 * ```typescript
 * getStatusClasses('Running')
 * // 'bg-semantic-running text-semantic-running-text'
 *
 * getStatusClasses('Pending')
 * // 'bg-semantic-warning text-semantic-warning-text'
 * ```
 */
export function getStatusClasses(status: string): string {
  const semantic = getSemanticStatus(status);

  // 시맨틱 상태 → CSS 변수 클래스 매핑
  const classMap: Record<SemanticStatus, string> = {
    running: "bg-semantic-running text-semantic-running-text",
    success: "bg-semantic-success text-semantic-success-text",
    warning: "bg-semantic-warning text-semantic-warning-text",
    error: "bg-semantic-error text-semantic-error-text",
    neutral: "bg-semantic-neutral text-semantic-neutral-text",
  };

  return classMap[semantic];
}

/**
 * 🎯 상태에 해당하는 CSS 변수명 반환 (직접 스타일링용)
 *
 * @param status - 원본 상태 문자열
 * @returns CSS 변수 객체 { bg: string, text: string }
 *
 * @example
 * ```typescript
 * const vars = getStatusCSSVars('Running');
 * // { bg: 'var(--semantic-running)', text: 'var(--semantic-running-text)' }
 *
 * <div style={{ backgroundColor: vars.bg, color: vars.text }}>
 *   {status}
 * </div>
 * ```
 */
export function getStatusCSSVars(status: string): { bg: string; text: string } {
  const semantic = getSemanticStatus(status);

  return {
    bg: `var(--semantic-${semantic})`,
    text: `var(--semantic-${semantic}-text)`,
  };
}

/**
 * 🎯 Badge 컴포넌트용 상태 클래스 반환 (기존 호환성)
 *
 * @param status - 원본 상태 문자열
 * @returns Badge에 적용할 className
 *
 * @example
 * ```tsx
 * <Badge className={getBadgeStatusClasses(statusMessage)}>
 *   {statusMessage}
 * </Badge>
 * ```
 */
export function getBadgeStatusClasses(status: string): string {
  const semantic = getSemanticStatus(status);

  // Badge 전용 토큰 사용 (hover 포함)
  const classMap: Record<SemanticStatus, string> = {
    running: "bg-badge-running-bg text-badge-running-fg hover:opacity-90",
    success: "bg-badge-succeeded-bg text-badge-succeeded-fg hover:opacity-90",
    warning: "bg-badge-pending-bg text-badge-pending-fg hover:opacity-90",
    error: "bg-badge-failed-bg text-badge-failed-fg hover:opacity-90",
    neutral: "bg-badge-unknown-bg text-badge-unknown-fg hover:opacity-90",
  };

  return classMap[semantic];
}
