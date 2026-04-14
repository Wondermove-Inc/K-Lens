/**
 * 🎯 목적: Tool Approval Diff 타입 정의
 * 02: Tool 승인 UI에 Diff 통합
 *
 * 📝 주요 타입:
 * - ToolApprovalType: Tool 승인 유형
 * - ToolApprovalWithDiff: Diff 정보를 포함한 승인 요청
 * - ToolApprovalRequest: 승인 요청 전체 정보
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 Tool 승인 유형 열거형
// ============================================

/**
 * Tool 승인 유형
 *
 * 📝 Tool 특성에 따른 분류:
 * - FILE_EDIT: 파일 내용 수정 (Diff 표시 가능)
 * - FILE_CREATE: 새 파일 생성
 * - FILE_WRITE: AI 파일 쓰기 (생성/덮어쓰기/추가)
 * - FILE_DELETE: 파일 삭제
 * - COMMAND: 명령어 실행 (Bash)
 * - KUBECTL: Kubernetes 명령어
 * - GENERIC: 기타 도구
 */
export enum ToolApprovalType {
  /** 파일 수정 (Edit) */
  FILE_EDIT = "file_edit",
  /** 파일 생성 (Write) */
  FILE_CREATE = "file_create",
  /** AI 파일 쓰기 (AI File System - create/overwrite/append) */
  FILE_WRITE = "file_write",
  /** 파일 삭제 */
  FILE_DELETE = "file_delete",
  /** 명령어 실행 (Bash) */
  COMMAND = "command",
  /** Kubernetes 명령어 */
  KUBECTL = "kubectl",
  /** 기타 도구 */
  GENERIC = "generic",
}

// ============================================
// 🎯 File Approval Metadata 인터페이스
// ============================================

/**
 * 🎯 파일 승인 메타데이터
 *
 * save_to_cluster Tool 등에서 HITL 승인 시 표시할 추가 정보
 *
 * 📝 PHASE 4 - UX Flow Improvement
 * - 사용자에게 파일 저장 컨텍스트 정보 제공
 * - Pre-notification 메시지 생성에 활용
 *
 * @example
 * ```ts
 * const metadata: FileApprovalMetadata = {
 *   clusterName: "production",
 *   folderType: "reports",
 *   filename: "health-report.md",
 *   filesize: 1024,
 *   preview: "# Health Report\n...",
 *   allowPathEdit: true,
 * };
 * ```
 */
export interface FileApprovalMetadata {
  /** 클러스터 이름 */
  clusterName?: string;

  /** 폴더 유형 (reports, plans, manifests, configs, misc) */
  folderType?: string;

  /** 파일명 (타임스탬프 포함) */
  filename?: string;

  /** 파일 크기 (bytes) */
  filesize?: number;

  /** 내용 미리보기 (처음 200자) */
  preview?: string;

  /**
   * 경로 편집 허용 여부
   *
   * true일 경우 승인 다이얼로그에서 저장 경로 수정 가능
   */
  allowPathEdit?: boolean;

  /**
   * 문서 유형 (SmartDefaultsEngine 추론 결과)
   *
   * report, manifest, plan, config, misc
   */
  documentType?: string;

  /**
   * 문서 유형 추론 신뢰도 (0-1)
   */
  confidence?: number;
}

// ============================================
// 🎯 Tool 승인 인터페이스
// ============================================

/**
 * Diff 정보를 포함한 Tool 승인 정보
 *
 * 📝 파일 수정 Tool일 경우:
 * - filePath, diff, oldContent, newContent 포함
 *
 * 📝 kubectl Tool일 경우:
 * - stdin, command 포함
 *
 * 📝 save_to_cluster Tool일 경우:
 * - metadata 필드에 클러스터, 폴더, 파일 정보 포함
 */
export interface ToolApprovalWithDiff {
  /** 고유 ID */
  id: string;

  /** Tool 이름 (Edit, Write, Bash, kubectl 등) */
  toolName: string;

  /** Tool 유형 */
  toolType: ToolApprovalType;

  /** 설명 */
  description: string;

  /** 승인 필요 여부 */
  requiresApproval: boolean;

  /** 생성 시간 */
  createdAt: number;

  // === Diff 관련 (파일 수정 Tool) ===

  /** 대상 파일 경로 */
  filePath?: string;

  /** Unified Diff 문자열 */
  diff?: string;

  /** 수정 전 내용 */
  oldContent?: string;

  /** 수정 후 내용 */
  newContent?: string;

  // === YAML/stdin 관련 (kubectl Tool) ===

  /** stdin으로 전달할 YAML 내용 */
  stdin?: string;

  /** 명령어 */
  command?: string;

  /** 🆕 리소스 이름 (kubectl Tool에서 사용) */
  resourceName?: string;

  // === 기타 ===

  /** Tool 입력 원본 */
  toolInput?: Record<string, unknown>;

  /** 승인 상태 */
  status?: "pending" | "approved" | "rejected";

  /** 승인/거부 시간 */
  resolvedAt?: number;

  // === 파일 메타데이터 (save_to_cluster) ===

  /**
   * 🆕 파일 승인 메타데이터
   *
   * save_to_cluster Tool에서 HITL 승인 시 추가 컨텍스트 제공
   *
   * @see FileApprovalMetadata
   */
  metadata?: FileApprovalMetadata;
}

// ============================================
// 🎯 Tool 승인 요청 인터페이스
// ============================================

/**
 * Tool 승인 요청 (UI 표시용)
 *
 * 📝 ToolApprovalPrompt 컴포넌트에 전달되는 데이터
 */
export interface ToolApprovalRequest {
  /** 질문 (사용자에게 표시) */
  question: string;

  /** 옵션 목록 (Yes, No 등) */
  options: string[];

  /** 승인 정보 */
  approval: ToolApprovalWithDiff;

  /** 액션 요약 (선택) */
  actionSummary?: string;
}

// ============================================
// 🎯 팩토리 함수 입력 인터페이스
// ============================================

/**
 * createToolApprovalRequest 입력
 */
export interface CreateToolApprovalRequestInput {
  /** Tool 이름 */
  toolName: string;

  /** 설명 */
  description: string;

  /** Tool 입력 */
  toolInput: Record<string, unknown>;

  /** 질문 (선택, 기본값: "이 작업을 승인하시겠습니까?") */
  question?: string;

  /** 옵션 (선택, 기본값: ["Yes", "No"]) */
  options?: string[];

  /** 승인 필요 여부 (선택, 기본값: true) */
  requiresApproval?: boolean;
}

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 파일 수정 Tool인지 확인
 *
 * @param toolName - Tool 이름
 * @returns 파일 수정 Tool 여부
 *
 * @example
 * ```ts
 * isFileModificationTool("Edit"); // true
 * isFileModificationTool("Bash"); // false
 * ```
 */
export function isFileModificationTool(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name === "edit" || name === "write";
}

/**
 * Tool 이름에서 Tool 유형 결정
 *
 * @param toolName - Tool 이름
 * @param toolInput - Tool 입력
 * @returns Tool 유형
 */
export function getToolApprovalType(toolName: string, toolInput: Record<string, unknown>): ToolApprovalType {
  const name = toolName.toLowerCase();

  // 파일 수정 Tool
  if (name === "edit") {
    return ToolApprovalType.FILE_EDIT;
  }

  // 파일 생성 Tool
  if (name === "write") {
    // old_string이 없으면 새 파일 생성
    if (!toolInput.old_string && !toolInput.oldString) {
      return ToolApprovalType.FILE_CREATE;
    }
    return ToolApprovalType.FILE_EDIT;
  }

  // kubectl Tool
  if (name === "kubectl") {
    return ToolApprovalType.KUBECTL;
  }

  // Bash Tool
  if (name === "bash") {
    return ToolApprovalType.COMMAND;
  }

  // 기타
  return ToolApprovalType.GENERIC;
}

/**
 * Tool 입력에서 Diff 정보 추출
 *
 * @param toolName - Tool 이름
 * @param toolInput - Tool 입력
 * @returns Diff 정보 또는 null
 *
 * @example
 * ```ts
 * extractDiffFromToolInput("Edit", {
 *   file_path: "/src/index.ts",
 *   old_string: "const x = 1;",
 *   new_string: "const x = 2;",
 * });
 * // { oldContent: "const x = 1;", newContent: "const x = 2;" }
 * ```
 */
export function extractDiffFromToolInput(
  toolName: string,
  toolInput: Record<string, unknown>,
): { oldContent: string; newContent: string } | null {
  // 파일 수정 Tool만 처리
  if (!isFileModificationTool(toolName)) {
    return null;
  }

  // old_string / new_string 추출
  const oldContent = (toolInput.old_string ?? toolInput.oldString) as string | undefined;
  const newContent = (toolInput.new_string ?? toolInput.newString) as string | undefined;

  // 둘 다 있어야 Diff 생성 가능
  if (!oldContent || !newContent) {
    return null;
  }

  return { oldContent, newContent };
}

/**
 * Tool 입력에서 파일 경로 추출
 *
 * @param toolInput - Tool 입력
 * @returns 파일 경로 또는 null
 */
export function extractFilePathFromToolInput(toolInput: Record<string, unknown>): string | null {
  // file_path 또는 filePath
  const filePath = (toolInput.file_path ?? toolInput.filePath) as string | undefined;

  return filePath ?? null;
}

/**
 * 고유 ID 생성
 *
 * @returns 고유 ID
 */
function generateApprovalId(): string {
  return `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Unified Diff 생성
 *
 * @param filePath - 파일 경로
 * @param oldContent - 수정 전 내용
 * @param newContent - 수정 후 내용
 * @returns Unified Diff 문자열
 */
export function generateUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const lines: string[] = [];

  // 파일 헤더
  lines.push(`--- a${filePath}`);
  lines.push(`+++ b${filePath}`);

  // Hunk 헤더 (간단화: 전체 파일을 하나의 Hunk로)
  lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);

  // 삭제된 라인
  for (const line of oldLines) {
    lines.push(`-${line}`);
  }

  // 추가된 라인
  for (const line of newLines) {
    lines.push(`+${line}`);
  }

  return lines.join("\n");
}

// ============================================
// 🎯 팩토리 함수
// ============================================

/**
 * Tool 승인 요청 생성
 *
 * 📝 Tool 유형에 따라 적절한 정보를 추출하여 요청 생성
 *
 * @param input - 생성 입력
 * @returns Tool 승인 요청
 *
 * @example
 * ```ts
 * const request = createToolApprovalRequest({
 *   toolName: "Edit",
 *   description: "파일 수정",
 *   toolInput: {
 *     file_path: "/src/index.ts",
 *     old_string: "const x = 1;",
 *     new_string: "const x = 2;",
 *   },
 * });
 * ```
 */
export function createToolApprovalRequest(input: CreateToolApprovalRequestInput): ToolApprovalRequest {
  const {
    toolName,
    description,
    toolInput,
    question = "이 작업을 승인하시겠습니까?",
    options = ["Yes", "No"],
    requiresApproval = true,
  } = input;

  // Tool 유형 결정
  const toolType = getToolApprovalType(toolName, toolInput);

  // 파일 경로 추출
  const filePath = extractFilePathFromToolInput(toolInput);

  // Diff 정보 추출
  const diffInfo = extractDiffFromToolInput(toolName, toolInput);

  // Unified Diff 생성
  let diff: string | undefined;
  if (diffInfo && filePath) {
    diff = generateUnifiedDiff(filePath, diffInfo.oldContent, diffInfo.newContent);
  }

  // 승인 정보 생성
  const approval: ToolApprovalWithDiff = {
    id: generateApprovalId(),
    toolName,
    toolType,
    description,
    requiresApproval,
    createdAt: Date.now(),
    filePath: filePath ?? undefined,
    diff,
    oldContent: diffInfo?.oldContent,
    newContent: diffInfo?.newContent,
    toolInput,
    status: "pending",
  };

  // kubectl의 경우 stdin/command 추가
  if (toolType === ToolApprovalType.KUBECTL) {
    approval.stdin = toolInput.stdin as string | undefined;
    approval.command = toolInput.command as string | undefined;
  }

  // Bash의 경우 command 추가
  if (toolType === ToolApprovalType.COMMAND) {
    approval.command = toolInput.command as string | undefined;
  }

  return {
    question,
    options,
    approval,
    actionSummary: filePath ? `${filePath} 수정` : undefined,
  };
}
