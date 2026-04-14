/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI 파일 시스템 IPC 채널 정의
 *
 * AI Assistant가 파일(보고서, YAML, JSON)을 생성/읽기/수정할 수 있는
 * 파일 시스템 통합 기능을 위한 IPC 채널과 타입을 정의합니다.
 *
 * 📝 Extension Host 패턴:
 * - Renderer는 "요청/표시"만 담당
 * - Main은 "파일 I/O 실행 + Safe Zone 검증"
 * - HITL 승인은 기존 interrupt 패턴 활용
 *
 * 📋 Phase 구분:
 * - Phase 1: 기본 파일 I/O (read, write, list, ensure-dir, exists, diff)
 * - Phase 2: 삭제 및 탐색기 연동 (delete, open-explorer)
 * - Phase 3: 검색 (search)
 *
 * 🔄 변경이력:
 * - 2026-01-29: 초기 생성 (AI File System Integration)
 */

import { getInjectionToken } from "@ogre-tools/injectable";
import { getRequestChannel } from "@skuberplus/messaging";

// ============================================
// 🎯 Common Types
// ============================================

/**
 * 🎯 파일 접근 범위 (File Access Scope)
 *
 * AI가 파일 작업을 수행할 때 필요한 기본 경로 및 클러스터 정보
 *
 * @property basePath - Safe Zone 기본 경로 (없으면 homedir 사용)
 * @property clusterId - 현재 클러스터 ID
 * @property clusterName - 클러스터 이름 (폴더 생성 시 사용)
 */
export interface AIFileScope {
  basePath?: string;
  clusterId?: string;
  clusterName?: string;
}

/**
 * 🎯 파일 경로 정보 (File Path)
 *
 * 경로 해석 규칙:
 * 1. absolutePath가 있으면 → 직접 사용 (Safe Zone 검증 필수)
 * 2. relativePath가 있으면 → Safe Zone 기본 경로에서 해석
 * 3. 둘 다 있으면 → 유효성 검사 오류
 *
 * @property scope - 파일 접근 범위
 * @property relativePath - Safe Zone 기준 상대 경로 (예: "daive-documents/cluster/reports/file.md")
 * @property absolutePath - 절대 경로 (쓰기 시 Safe Zone 내부여야 함)
 */
export interface AIFilePath {
  scope: AIFileScope;
  /** Safe Zone 기준 상대 경로 (예: "daive-documents/cluster/reports/file.md") */
  relativePath?: string;
  /** 절대 경로 (쓰기 시 Safe Zone 내부여야 함) */
  absolutePath?: string;
}

/**
 * 🎯 파일 작업 에러 코드
 *
 * 모든 파일 작업에서 발생할 수 있는 에러 유형
 */
export type AIFileErrorCode =
  | "NOT_ALLOWED_PATH" // Safe Zone 외부
  | "PATH_TRAVERSAL" // 경로 탈출 시도 (../, symlink 등)
  | "FILE_TOO_LARGE" // 크기 제한 초과 (기본 50MB)
  | "FILE_NOT_FOUND" // 파일 없음
  | "PERMISSION_DENIED" // 권한 거부 (OS 레벨)
  | "APPROVAL_DENIED" // HITL 승인 거절
  | "INVALID_FILE_TYPE" // 지원하지 않는 확장자
  | "IO_ERROR"; // 기타 I/O 오류

/**
 * 🎯 허용 확장자 목록
 *
 * AI가 자유롭게 읽기/쓰기할 수 있는 파일 확장자
 * 이 외의 확장자는 HITL 승인 필요
 */
export const AI_ALLOWED_EXTENSIONS = [".md", ".markdown", ".yaml", ".yml", ".json", ".txt"] as const;

// ============================================
// 🎯 Read Channel (Phase 1)
// ============================================

/**
 * 🎯 파일 읽기 요청
 *
 * @property path - 읽을 파일 경로
 * @property maxBytes - 최대 읽기 바이트 (기본 50MB)
 * @property encoding - 인코딩 방식 (기본 utf8)
 */
export interface AIFileReadRequest {
  path: AIFilePath;
  maxBytes?: number;
  encoding?: "utf8" | "base64";
}

/**
 * 🎯 파일 읽기 응답
 *
 * @property success - 성공 여부
 * @property content - 파일 내용
 * @property size - 파일 크기 (바이트)
 * @property mimeType - MIME 타입
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileReadResponse {
  success: boolean;
  content?: string;
  size?: number;
  mimeType?: string;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Write Channel (Phase 1)
// ============================================

/**
 * 🎯 파일 쓰기 모드
 *
 * - create: 새 파일 생성 (기존 파일 있으면 오류)
 * - overwrite: 덮어쓰기 (기존 파일 있으면 교체)
 * - append: 기존 파일에 추가
 */
export type AIFileWriteMode = "create" | "overwrite" | "append";

/**
 * 🎯 파일 쓰기 요청
 *
 * @property path - 저장할 파일 경로
 * @property content - 저장할 내용
 * @property mode - 쓰기 모드 (create/overwrite/append)
 * @property requireHitl - HITL 승인 필요 여부 (기본 true)
 * @property diffBase - 비교 기준 내용 (수정 시 diff 표시용)
 */
export interface AIFileWriteRequest {
  path: AIFilePath;
  content: string;
  mode: AIFileWriteMode;
  requireHitl?: boolean;
  diffBase?: string;
}

/**
 * 🎯 파일 쓰기 응답
 *
 * @property success - 성공 여부
 * @property writtenPath - 실제 저장된 절대 경로
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileWriteResponse {
  success: boolean;
  writtenPath?: string;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Ensure Directory Channel (Phase 1)
// ============================================

/**
 * 🎯 디렉토리 타입
 *
 * 클러스터별 표준 폴더 구조
 */
export type AIFileDirType = "reports" | "plans" | "manifests" | "configs" | "misc" | "custom";

/**
 * 🎯 디렉토리 생성 요청
 *
 * @property scope - 파일 접근 범위 (클러스터 정보 포함)
 * @property dirType - 생성할 디렉토리 타입
 * @property customName - custom 타입일 때 폴더 이름
 */
export interface AIFileEnsureDirRequest {
  scope: AIFileScope;
  dirType: AIFileDirType;
  customName?: string;
}

/**
 * 🎯 디렉토리 생성 응답
 *
 * @property success - 성공 여부
 * @property createdPath - 생성된 디렉토리 절대 경로
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileEnsureDirResponse {
  success: boolean;
  createdPath?: string;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 List Directory Channel (Phase 1)
// ============================================

/**
 * 🎯 디렉토리 목록 요청
 *
 * @property path - 조회할 디렉토리 경로
 * @property recursive - 하위 디렉토리 포함 여부
 * @property pattern - glob 패턴 필터 (예: "*.md")
 */
export interface AIFileListRequest {
  path: AIFilePath;
  recursive?: boolean;
  pattern?: string;
}

/**
 * 🎯 디렉토리 엔트리 정보
 *
 * @property name - 파일/폴더 이름
 * @property path - 절대 경로
 * @property isDirectory - 디렉토리 여부
 * @property size - 파일 크기 (바이트)
 * @property modifiedAt - 수정 시간 (Unix timestamp)
 */
export interface AIFileListEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
}

/**
 * 🎯 디렉토리 목록 응답
 *
 * @property success - 성공 여부
 * @property entries - 디렉토리 엔트리 목록
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileListResponse {
  success: boolean;
  entries?: AIFileListEntry[];
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Diff Calculation Channel (Phase 1)
// ============================================

/**
 * 🎯 Diff 계산 요청
 *
 * 파일 쓰기 전 변경사항 미리보기용
 *
 * @property path - 비교할 기존 파일 경로
 * @property newContent - 새로 저장할 내용
 */
export interface AIFileDiffRequest {
  path: AIFilePath;
  newContent: string;
}

/**
 * 🎯 Diff 계산 응답
 *
 * @property success - 성공 여부
 * @property diff - Unified Diff 형식 문자열
 * @property oldContent - 기존 파일 내용 (없으면 빈 문자열)
 * @property exists - 기존 파일 존재 여부
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileDiffResponse {
  success: boolean;
  diff?: string;
  oldContent?: string;
  exists: boolean;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Exists Channel (Phase 1)
// ============================================

/**
 * 🎯 파일 존재 확인 요청
 *
 * @property path - 확인할 파일 경로
 */
export interface AIFileExistsRequest {
  path: AIFilePath;
}

/**
 * 🎯 파일 존재 확인 응답
 *
 * @property success - 요청 성공 여부
 * @property exists - 파일 존재 여부
 * @property isDirectory - 디렉토리 여부
 * @property size - 파일 크기 (바이트)
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileExistsResponse {
  success: boolean;
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Delete Channel (Phase 2)
// ============================================

/**
 * 🎯 파일/폴더 삭제 요청
 *
 * @property path - 삭제할 파일/폴더 경로
 * @property recursive - 폴더 및 하위 내용 모두 삭제
 * @property skipHitl - HITL 승인 건너뛰기 (비권장)
 */
export interface AIFileDeleteRequest {
  path: AIFilePath;
  recursive?: boolean;
  skipHitl?: boolean;
}

/**
 * 🎯 파일/폴더 삭제 응답
 *
 * @property success - 성공 여부
 * @property deletedPath - 삭제된 파일/폴더 절대 경로
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileDeleteResponse {
  success: boolean;
  deletedPath?: string;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Open Explorer Channel (Phase 2)
// ============================================

/**
 * 🎯 OS 탐색기 열기 요청
 *
 * @property path - 열 파일/폴더 경로
 * @property selectFile - 파일 선택 모드 (폴더만 열기 vs 파일 선택)
 */
export interface AIFileOpenExplorerRequest {
  path: AIFilePath;
  selectFile?: boolean;
}

/**
 * 🎯 OS 탐색기 열기 응답
 *
 * @property success - 성공 여부
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileOpenExplorerResponse {
  success: boolean;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 Search Channel (Phase 3)
// ============================================

/**
 * 🎯 파일 검색 요청
 *
 * @property basePath - 검색 시작 경로
 * @property query - 검색어 (glob 패턴 지원)
 * @property searchContent - 파일 내용 검색 여부 (느림)
 * @property extensions - 확장자 필터 (예: [".md", ".yaml"])
 * @property maxResults - 최대 결과 수
 */
export interface AIFileSearchRequest {
  basePath: AIFilePath;
  query: string;
  searchContent?: boolean;
  extensions?: string[];
  maxResults?: number;
}

/**
 * 🎯 파일 검색 결과 항목
 *
 * @property path - 파일 절대 경로
 * @property name - 파일 이름
 * @property lineNumber - 매칭된 라인 번호 (내용 검색 시)
 * @property matchContext - 매칭된 라인 내용
 */
export interface AIFileSearchResult {
  path: string;
  name: string;
  lineNumber?: number;
  matchContext?: string;
}

/**
 * 🎯 파일 검색 응답
 *
 * @property success - 성공 여부
 * @property results - 검색 결과 목록
 * @property totalCount - 전체 결과 수 (maxResults로 잘린 경우)
 * @property error - 에러 코드 (실패 시)
 * @property errorMessage - 에러 메시지 (실패 시)
 */
export interface AIFileSearchResponse {
  success: boolean;
  results?: AIFileSearchResult[];
  totalCount?: number;
  error?: AIFileErrorCode;
  errorMessage?: string;
}

// ============================================
// 🎯 IPC 채널 정의
// ============================================

/**
 * 🎯 파일 읽기 채널 (Phase 1)
 *
 * Safe Zone 내부: 허용 확장자 직접 읽기, 기타 확장자 HITL 필요
 * Safe Zone 외부: HITL 필요 (허용 확장자), 차단 (기타 확장자)
 */
export const aiFileReadChannel = getRequestChannel<AIFileReadRequest, AIFileReadResponse>("ai-assistant:file-read");

/**
 * 🎯 파일 쓰기 채널 (Phase 1)
 *
 * Safe Zone 내부: HITL 승인 후 쓰기
 * Safe Zone 외부: 항상 차단
 */
export const aiFileWriteChannel = getRequestChannel<AIFileWriteRequest, AIFileWriteResponse>("ai-assistant:file-write");

/**
 * 🎯 디렉토리 생성 채널 (Phase 1)
 *
 * 클러스터별 표준 폴더 구조 생성
 * Safe Zone 내부만 허용
 */
export const aiFileEnsureDirChannel = getRequestChannel<AIFileEnsureDirRequest, AIFileEnsureDirResponse>(
  "ai-assistant:file-ensure-dir",
);

/**
 * 🎯 디렉토리 목록 채널 (Phase 1)
 *
 * Safe Zone 내부 디렉토리 목록 조회
 */
export const aiFileListChannel = getRequestChannel<AIFileListRequest, AIFileListResponse>("ai-assistant:file-list");

/**
 * 🎯 파일 존재 확인 채널 (Phase 1)
 *
 * 파일/폴더 존재 여부 및 메타데이터 확인
 */
export const aiFileExistsChannel = getRequestChannel<AIFileExistsRequest, AIFileExistsResponse>(
  "ai-assistant:file-exists",
);

/**
 * 🎯 Diff 계산 채널 (Phase 1)
 *
 * 파일 쓰기 전 변경사항 미리보기
 */
export const aiFileDiffChannel = getRequestChannel<AIFileDiffRequest, AIFileDiffResponse>("ai-assistant:file-diff");

/**
 * 🎯 파일/폴더 삭제 채널 (Phase 2)
 *
 * Safe Zone 내부만 허용, HITL 승인 필수
 */
export const aiFileDeleteChannel = getRequestChannel<AIFileDeleteRequest, AIFileDeleteResponse>(
  "ai-assistant:file-delete",
);

/**
 * 🎯 OS 탐색기 열기 채널 (Phase 2)
 *
 * Windows/Mac/Linux 탐색기에서 파일/폴더 열기
 */
export const aiFileOpenExplorerChannel = getRequestChannel<AIFileOpenExplorerRequest, AIFileOpenExplorerResponse>(
  "ai-assistant:file-open-explorer",
);

/**
 * 🎯 파일 검색 채널 (Phase 3)
 *
 * 파일명/내용 검색
 */
export const aiFileSearchChannel = getRequestChannel<AIFileSearchRequest, AIFileSearchResponse>(
  "ai-assistant:file-search",
);

// ============================================
// 🎯 DI 토큰 정의
// ============================================

/**
 * 🎯 파일 읽기 함수 타입
 */
export type AIFileReadFn = (request: AIFileReadRequest) => Promise<AIFileReadResponse>;

/**
 * 🎯 파일 쓰기 함수 타입
 */
export type AIFileWriteFn = (request: AIFileWriteRequest) => Promise<AIFileWriteResponse>;

/**
 * 🎯 디렉토리 생성 함수 타입
 */
export type AIFileEnsureDirFn = (request: AIFileEnsureDirRequest) => Promise<AIFileEnsureDirResponse>;

/**
 * 🎯 디렉토리 목록 함수 타입
 */
export type AIFileListFn = (request: AIFileListRequest) => Promise<AIFileListResponse>;

/**
 * 🎯 파일 존재 확인 함수 타입
 */
export type AIFileExistsFn = (request: AIFileExistsRequest) => Promise<AIFileExistsResponse>;

/**
 * 🎯 Diff 계산 함수 타입
 */
export type AIFileDiffFn = (request: AIFileDiffRequest) => Promise<AIFileDiffResponse>;

/**
 * 🎯 파일 삭제 함수 타입
 */
export type AIFileDeleteFn = (request: AIFileDeleteRequest) => Promise<AIFileDeleteResponse>;

/**
 * 🎯 탐색기 열기 함수 타입
 */
export type AIFileOpenExplorerFn = (request: AIFileOpenExplorerRequest) => Promise<AIFileOpenExplorerResponse>;

/**
 * 🎯 파일 검색 함수 타입
 */
export type AIFileSearchFn = (request: AIFileSearchRequest) => Promise<AIFileSearchResponse>;

/**
 * 🎯 파일 읽기 DI 토큰
 */
export const aiFileReadInjectionToken = getInjectionToken<AIFileReadFn>({
  id: "ai-assistant-file-read",
});

/**
 * 🎯 파일 쓰기 DI 토큰
 */
export const aiFileWriteInjectionToken = getInjectionToken<AIFileWriteFn>({
  id: "ai-assistant-file-write",
});

/**
 * 🎯 디렉토리 생성 DI 토큰
 */
export const aiFileEnsureDirInjectionToken = getInjectionToken<AIFileEnsureDirFn>({
  id: "ai-assistant-file-ensure-dir",
});

/**
 * 🎯 디렉토리 목록 DI 토큰
 */
export const aiFileListInjectionToken = getInjectionToken<AIFileListFn>({
  id: "ai-assistant-file-list",
});

/**
 * 🎯 파일 존재 확인 DI 토큰
 */
export const aiFileExistsInjectionToken = getInjectionToken<AIFileExistsFn>({
  id: "ai-assistant-file-exists",
});

/**
 * 🎯 Diff 계산 DI 토큰
 */
export const aiFileDiffInjectionToken = getInjectionToken<AIFileDiffFn>({
  id: "ai-assistant-file-diff",
});

/**
 * 🎯 파일 삭제 DI 토큰
 */
export const aiFileDeleteInjectionToken = getInjectionToken<AIFileDeleteFn>({
  id: "ai-assistant-file-delete",
});

/**
 * 🎯 탐색기 열기 DI 토큰
 */
export const aiFileOpenExplorerInjectionToken = getInjectionToken<AIFileOpenExplorerFn>({
  id: "ai-assistant-file-open-explorer",
});

/**
 * 🎯 파일 검색 DI 토큰
 */
export const aiFileSearchInjectionToken = getInjectionToken<AIFileSearchFn>({
  id: "ai-assistant-file-search",
});

// ============================================
// 🎯 File Change Notification (Phase 3)
// ============================================

/**
 * 🎯 AI 파일 변경 알림 타입
 *
 * @property action - 변경 유형 (write, delete)
 * @property path - 변경된 파일 경로
 * @property isDirectory - 디렉토리 여부
 */
export interface AIFileChangeNotification {
  action: "write" | "delete" | "create_dir";
  path: string;
  isDirectory?: boolean;
}

/**
 * 🎯 AI 파일 변경 알림 채널
 *
 * Main Process → Renderer로 파일 변경 이벤트 전송
 * File Explorer가 이 이벤트를 구독하여 자동 갱신
 */
export const AI_FILE_CHANGE_CHANNEL = "ai-assistant:file-change";
