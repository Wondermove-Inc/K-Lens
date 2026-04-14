/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI 파일 시스템 IPC Handler (Main Process)
 *
 * AI Assistant의 파일 작업 요청을 Main Process에서 처리합니다.
 *
 * 📋 핸들러 목록:
 * - handleRead: 파일 읽기
 * - handleWrite: 파일 쓰기/수정
 * - handleEnsureDir: 클러스터 폴더 생성
 * - handleList: 디렉토리 목록 조회
 * - handleExists: 파일 존재 확인
 * - handleDiff: 쓰기 전 diff 계산
 *
 * 📋 보안 정책:
 * - Safe Zone 외부 쓰기: 항상 차단
 * - Safe Zone 외부 읽기: HITL 승인 필요
 * - 기타 확장자: HITL 승인 필요
 *
 * 🔄 변경이력:
 * - 2026-01-29: 초기 생성 (AI File System Integration)
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
// @ts-expect-error - diff 패키지에 타입 정의 없음
import { createTwoFilesPatch } from "diff";
import { BrowserWindow, shell } from "electron";
import * as fs from "fs/promises";
import { minimatch } from "minimatch";
import * as os from "os";
import * as path from "path";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import {
  AI_FILE_CHANGE_CHANNEL,
  type AIFileChangeNotification,
  type AIFileDeleteRequest,
  type AIFileDeleteResponse,
  type AIFileDiffRequest,
  type AIFileDiffResponse,
  type AIFileEnsureDirRequest,
  type AIFileEnsureDirResponse,
  type AIFileErrorCode,
  type AIFileExistsRequest,
  type AIFileExistsResponse,
  type AIFileListEntry,
  type AIFileListRequest,
  type AIFileListResponse,
  type AIFileOpenExplorerRequest,
  type AIFileOpenExplorerResponse,
  type AIFilePath,
  type AIFileReadRequest,
  type AIFileReadResponse,
  type AIFileSearchRequest,
  type AIFileSearchResponse,
  type AIFileSearchResult,
  type AIFileWriteRequest,
  type AIFileWriteResponse,
  aiFileDeleteChannel,
  aiFileDiffChannel,
  aiFileEnsureDirChannel,
  aiFileExistsChannel,
  aiFileListChannel,
  aiFileOpenExplorerChannel,
  aiFileReadChannel,
  aiFileSearchChannel,
  aiFileWriteChannel,
} from "../common/ai-file-channels";
import {
  checkFileOperationPolicy,
  DAIVE_DOCUMENTS_ROOT,
  detectPathTraversal,
  getExtension,
  getMimeType,
  sanitizeClusterName,
  validatePath,
} from "./ai-file-utils";

import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";

// ============================================
// 🎯 Helper Functions
// ============================================

/**
 * 🎯 Safe Zone 경로 가져오기
 *
 * 우선순위:
 * 1. scope.basePath (명시적 전달 - 가장 높은 우선순위)
 * 2. userPreferences.fileExplorerDefaultPath (설정)
 * 3. OS 홈 디렉토리 (기본값)
 *
 * 📝 2026-01-29 FIX: Main Process에서 userPreferencesState가
 * 제대로 로드되지 않는 문제 대응 - scope.basePath 우선 사용
 *
 * @param userPreferencesState - User preferences state (MobX observable)
 * @param scopeBasePath - scope에서 전달된 basePath (optional)
 * @returns Safe Zone 루트 경로 (절대)
 */
function getSafeZonePath(userPreferencesState: UserPreferencesState, scopeBasePath?: string): string {
  // 1. scope.basePath가 있으면 우선 사용 (Renderer에서 직접 전달)
  if (scopeBasePath) {
    return scopeBasePath;
  }

  // 2. userPreferences 설정 사용
  const prefsPath = userPreferencesState.fileExplorerDefaultPath;
  if (prefsPath) {
    return prefsPath;
  }

  // 3. 기본값: OS 홈 디렉토리
  return os.homedir();
}

/**
 * 🎯 AIFilePath를 절대 경로로 변환
 *
 * @param filePath - AI 파일 경로 정보
 * @param safeZonePath - Safe Zone 루트 경로
 * @returns 절대 경로
 * @throws 둘 다 없거나 둘 다 있으면 에러
 */
function resolvePath(filePath: AIFilePath, safeZonePath: string): string {
  const { relativePath, absolutePath } = filePath;

  // 둘 다 있으면 에러
  if (relativePath && absolutePath) {
    throw new Error("Cannot specify both relativePath and absolutePath");
  }

  // 둘 다 없으면 에러
  if (!relativePath && !absolutePath) {
    throw new Error("Either relativePath or absolutePath must be specified");
  }

  // 절대 경로가 있으면 그대로 반환
  if (absolutePath) {
    return path.resolve(absolutePath);
  }

  // 상대 경로는 Safe Zone 기준으로 해석
  return path.resolve(safeZonePath, relativePath!);
}

/**
 * 🎯 에러 응답 생성 헬퍼
 */
function createErrorResponse<T extends { success: boolean; error?: AIFileErrorCode; errorMessage?: string }>(
  error: AIFileErrorCode,
  message: string,
): T {
  return {
    success: false,
    error,
    errorMessage: message,
  } as T;
}

/**
 * 🎯 파일 변경 알림 전송 (Phase 3 - File Explorer 연동)
 *
 * 모든 BrowserWindow에 파일 변경 이벤트를 전송하여
 * File Explorer가 자동 갱신할 수 있도록 합니다.
 *
 * @param notification - 파일 변경 알림 정보
 */
function sendFileChangeNotification(notification: AIFileChangeNotification): void {
  try {
    const windows = BrowserWindow.getAllWindows();

    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(AI_FILE_CHANGE_CHANNEL, notification);

        // Cluster Frame (iframe) 에도 전달하여 File Explorer 자동 갱신
        try {
          for (const frame of win.webContents.mainFrame.frames) {
            try {
              frame.send(AI_FILE_CHANGE_CHANNEL, notification);
            } catch {
              // Frame이 파괴되었거나 접근 불가능한 경우 무시
            }
          }
        } catch {
          // window shutdown 중 mainFrame 접근 에러 무시
        }
      }
    }
  } catch (error) {
    console.error("[AIFileHandler] Failed to send file change notification:", error);
  }
}

// ============================================
// 🎯 Read Handler
// ============================================

/**
 * 🎯 파일 읽기 IPC Handler
 *
 * Safe Zone 내부: 허용 확장자 직접 읽기, 기타 확장자 HITL 필요
 * Safe Zone 외부: 허용 확장자 HITL 필요, 기타 확장자 차단
 */
const aiFileReadHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-read-handler",
  channel: aiFileReadChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileReadRequest): Promise<AIFileReadResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return createErrorResponse("PATH_TRAVERSAL", "Path traversal detected");
        }

        // 4. 경로 검증 (symlink 해결 포함)
        const validation = await validatePath(resolvedPath, safeZonePath);

        // 5. 파일 존재 확인
        try {
          await fs.access(resolvedPath);
        } catch {
          return createErrorResponse("FILE_NOT_FOUND", `File not found: ${resolvedPath}`);
        }

        // 6. 정책 확인
        const extension = getExtension(resolvedPath);
        const policy = checkFileOperationPolicy("read", validation.isInsideSafeZone, extension);

        if (!policy.allowed) {
          return createErrorResponse("NOT_ALLOWED_PATH", policy.message || "Read not allowed");
        }

        // 7. HITL 필요 시 처리 (TODO: interrupt 연동)
        if (policy.requiresHitl) {
          // HITL은 Tool 레벨에서 처리
        }

        // 8. 파일 읽기
        const stats = await fs.stat(resolvedPath);
        const maxBytes = request.maxBytes || 50 * 1024 * 1024; // 50MB default

        if (stats.size > maxBytes) {
          return createErrorResponse("FILE_TOO_LARGE", `File size ${stats.size} exceeds limit ${maxBytes}`);
        }

        const encoding = request.encoding || "utf8";
        const content = await fs.readFile(resolvedPath, encoding === "base64" ? "base64" : "utf8");
        const mimeType = getMimeType(extension);

        return {
          success: true,
          content,
          size: stats.size,
          mimeType,
        };
      } catch (error) {
        console.error("[AIFileHandler] Read 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 Write Handler
// ============================================

/**
 * 🎯 파일 쓰기 IPC Handler
 *
 * Safe Zone 내부: HITL 승인 후 쓰기
 * Safe Zone 외부: 항상 차단
 */
const aiFileWriteHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-write-handler",
  channel: aiFileWriteChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileWriteRequest): Promise<AIFileWriteResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return createErrorResponse("PATH_TRAVERSAL", "Path traversal detected");
        }

        // 4. 경로 검증 (symlink 해결 포함)
        const validation = await validatePath(resolvedPath, safeZonePath);

        // 5. 정책 확인 (쓰기 작업)
        const extension = getExtension(resolvedPath);
        const policy = checkFileOperationPolicy("write", validation.isInsideSafeZone, extension);

        if (!policy.allowed) {
          return createErrorResponse("NOT_ALLOWED_PATH", policy.message || "Write not allowed");
        }

        // 6. HITL 필요 시 처리 (TODO: interrupt 연동)
        if (policy.requiresHitl && request.requireHitl !== false) {
          // HITL은 Tool 레벨에서 처리
        }

        // 7. 파일 존재 확인 (모드별 처리)
        let fileExists = false;

        try {
          await fs.access(resolvedPath);
          fileExists = true;
        } catch {
          // 파일 없음
        }

        if (request.mode === "create" && fileExists) {
          return createErrorResponse("IO_ERROR", "File already exists (mode: create)");
        }

        // 8. 부모 디렉토리 생성
        const parentDir = path.dirname(resolvedPath);

        await fs.mkdir(parentDir, { recursive: true });

        // 9. 파일 쓰기
        if (request.mode === "append") {
          await fs.appendFile(resolvedPath, request.content, "utf8");
        } else {
          await fs.writeFile(resolvedPath, request.content, "utf8");
        }

        // 10. File Explorer 자동 갱신을 위한 알림 전송
        sendFileChangeNotification({
          action: "write",
          path: resolvedPath,
          isDirectory: false,
        });

        return {
          success: true,
          writtenPath: resolvedPath,
        };
      } catch (error) {
        console.error("[AIFileHandler] Write 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 Ensure Directory Handler
// ============================================

/**
 * 🎯 클러스터 폴더 생성 IPC Handler
 *
 * 클러스터별 표준 폴더 구조를 생성합니다.
 * HITL 승인 불필요 (Safe Zone 내부 폴더 생성은 안전)
 */
const aiFileEnsureDirHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-ensure-dir-handler",
  channel: aiFileEnsureDirChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileEnsureDirRequest): Promise<AIFileEnsureDirResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.scope?.basePath);

        // 2. 클러스터 이름 sanitize
        const clusterName = request.scope.clusterName || "default";
        const clusterId = request.scope.clusterId;
        const sanitizedName = sanitizeClusterName(clusterName, clusterId);

        // 3. 폴더 이름 결정
        let folderName: string;

        if (request.dirType === "custom") {
          folderName = request.customName || "custom";
        } else {
          folderName = request.dirType;
        }

        // 4. 전체 경로 구성
        const folderPath = path.join(safeZonePath, DAIVE_DOCUMENTS_ROOT, sanitizedName, folderName);

        // 5. 디렉토리 생성
        await fs.mkdir(folderPath, { recursive: true });

        // 6. File Explorer 자동 갱신을 위한 알림 전송
        sendFileChangeNotification({
          action: "create_dir",
          path: folderPath,
          isDirectory: true,
        });

        return {
          success: true,
          createdPath: folderPath,
        };
      } catch (error) {
        console.error("[AIFileHandler] EnsureDir 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 List Directory Handler
// ============================================

/**
 * 🎯 디렉토리 목록 조회 IPC Handler
 *
 * Safe Zone 내부 디렉토리의 파일 목록을 반환합니다.
 */
const aiFileListHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-list-handler",
  channel: aiFileListChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileListRequest): Promise<AIFileListResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return createErrorResponse("PATH_TRAVERSAL", "Path traversal detected");
        }

        // 4. 경로 검증
        const validation = await validatePath(resolvedPath, safeZonePath);

        if (!validation.isInsideSafeZone) {
          return createErrorResponse("NOT_ALLOWED_PATH", "List outside Safe Zone is not allowed");
        }

        // 5. 디렉토리 확인
        try {
          const stats = await fs.stat(resolvedPath);

          if (!stats.isDirectory()) {
            return createErrorResponse("IO_ERROR", "Path is not a directory");
          }
        } catch {
          return createErrorResponse("FILE_NOT_FOUND", `Directory not found: ${resolvedPath}`);
        }

        // 6. 디렉토리 읽기
        const entries: AIFileListEntry[] = [];

        const readDir = async (dirPath: string, baseRelative = ""): Promise<void> => {
          const items = await fs.readdir(dirPath, { withFileTypes: true });

          for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            const relativeName = baseRelative ? `${baseRelative}/${item.name}` : item.name;

            // 패턴 필터링
            if (request.pattern) {
              if (!minimatch(item.name, request.pattern)) {
                continue;
              }
            }

            const stats = await fs.stat(itemPath);

            entries.push({
              name: relativeName,
              path: itemPath,
              isDirectory: item.isDirectory(),
              size: item.isDirectory() ? undefined : stats.size,
              modifiedAt: stats.mtimeMs,
            });

            // 재귀적 탐색
            if (request.recursive && item.isDirectory()) {
              await readDir(itemPath, relativeName);
            }
          }
        };

        await readDir(resolvedPath);

        return {
          success: true,
          entries,
        };
      } catch (error) {
        console.error("[AIFileHandler] List 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 Exists Handler
// ============================================

/**
 * 🎯 파일 존재 확인 IPC Handler
 */
const aiFileExistsHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-exists-handler",
  channel: aiFileExistsChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileExistsRequest): Promise<AIFileExistsResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return {
            success: false,
            exists: false,
            error: "PATH_TRAVERSAL" as AIFileErrorCode,
            errorMessage: "Path traversal detected",
          };
        }

        // 4. 파일/폴더 존재 확인
        try {
          const stats = await fs.stat(resolvedPath);

          return {
            success: true,
            exists: true,
            isDirectory: stats.isDirectory(),
            size: stats.isDirectory() ? undefined : stats.size,
          };
        } catch {
          return {
            success: true,
            exists: false,
          };
        }
      } catch (error) {
        console.error("[AIFileHandler] Exists 에러:", error);

        return {
          success: false,
          exists: false,
          error: "IO_ERROR" as AIFileErrorCode,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },
});

// ============================================
// 🎯 Diff Handler
// ============================================

/**
 * 🎯 Diff 계산 IPC Handler
 *
 * 파일 쓰기 전 변경사항을 미리 계산합니다.
 */
const aiFileDiffHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-diff-handler",
  channel: aiFileDiffChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileDiffRequest): Promise<AIFileDiffResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return {
            success: false,
            exists: false,
            error: "PATH_TRAVERSAL" as AIFileErrorCode,
            errorMessage: "Path traversal detected",
          };
        }

        // 4. 기존 파일 읽기 시도
        let oldContent = "";
        let fileExists = false;

        try {
          oldContent = await fs.readFile(resolvedPath, "utf8");
          fileExists = true;
        } catch {
          // 파일 없음 - 새 파일로 처리
        }

        // 5. Diff 계산
        const fileName = path.basename(resolvedPath);
        const diff = createTwoFilesPatch(fileName, fileName, oldContent, request.newContent, "old", "new");

        return {
          success: true,
          diff,
          oldContent,
          exists: fileExists,
        };
      } catch (error) {
        console.error("[AIFileHandler] Diff 에러:", error);

        return {
          success: false,
          exists: false,
          error: "IO_ERROR" as AIFileErrorCode,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },
});

// ============================================
// 🎯 Delete Handler (Phase 2)
// ============================================

/**
 * 🎯 파일/폴더 삭제 IPC Handler
 *
 * Safe Zone 내부만 삭제 가능
 * HITL 승인 필수 (skipHitl: true가 아닌 경우)
 */
const aiFileDeleteHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-delete-handler",
  channel: aiFileDeleteChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileDeleteRequest): Promise<AIFileDeleteResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return createErrorResponse("PATH_TRAVERSAL", "Path traversal detected");
        }

        // 4. 경로 검증 (symlink 해결 포함)
        const validation = await validatePath(resolvedPath, safeZonePath);

        // 5. Safe Zone 내부만 삭제 허용
        if (!validation.isInsideSafeZone) {
          return createErrorResponse("NOT_ALLOWED_PATH", "Delete outside Safe Zone is not allowed");
        }

        // 6. 정책 확인 (삭제 작업)
        const extension = getExtension(resolvedPath);
        const policy = checkFileOperationPolicy("delete", validation.isInsideSafeZone, extension);

        if (!policy.allowed) {
          return createErrorResponse("NOT_ALLOWED_PATH", policy.message || "Delete not allowed");
        }

        // 7. HITL 필요 시 경고 (실제 HITL은 Tool 레벨에서 처리)
        if (policy.requiresHitl && !request.skipHitl) {
          // HITL은 Tool 레벨에서 처리
        }

        // 8. 파일/폴더 존재 확인
        try {
          await fs.access(resolvedPath);
        } catch {
          return createErrorResponse("FILE_NOT_FOUND", `File not found: ${resolvedPath}`);
        }

        // 9. 디렉토리인 경우 recursive 필요
        const stats = await fs.stat(resolvedPath);

        if (stats.isDirectory() && !request.recursive) {
          return createErrorResponse("IO_ERROR", "Cannot delete directory without recursive option");
        }

        // 10. 삭제 실행
        const wasDirectory = stats.isDirectory();

        if (wasDirectory) {
          await fs.rm(resolvedPath, { recursive: true, force: true });
        } else {
          await fs.unlink(resolvedPath);
        }

        // 11. File Explorer 자동 갱신을 위한 알림 전송
        sendFileChangeNotification({
          action: "delete",
          path: resolvedPath,
          isDirectory: wasDirectory,
        });

        return {
          success: true,
          deletedPath: resolvedPath,
        };
      } catch (error) {
        console.error("[AIFileHandler] Delete 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 Open Explorer Handler (Phase 2)
// ============================================

/**
 * 🎯 OS 탐색기 열기 IPC Handler
 *
 * Safe Zone 내부 파일/폴더를 OS 탐색기에서 엽니다.
 * Windows: Explorer, Mac: Finder, Linux: Nautilus 등
 */
const aiFileOpenExplorerHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-open-explorer-handler",
  channel: aiFileOpenExplorerChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileOpenExplorerRequest): Promise<AIFileOpenExplorerResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.path.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.path, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return createErrorResponse("PATH_TRAVERSAL", "Path traversal detected");
        }

        // 4. 경로 검증 (symlink 해결 포함)
        const validation = await validatePath(resolvedPath, safeZonePath);

        // 5. Safe Zone 내부만 열기 허용
        if (!validation.isInsideSafeZone) {
          return createErrorResponse("NOT_ALLOWED_PATH", "Open explorer outside Safe Zone is not allowed");
        }

        // 6. 파일/폴더 존재 확인
        try {
          await fs.access(resolvedPath);
        } catch {
          return createErrorResponse("FILE_NOT_FOUND", `Path not found: ${resolvedPath}`);
        }

        // 7. Electron shell API로 탐색기 열기
        if (request.selectFile) {
          // 파일 선택 모드: 파일을 선택한 상태로 폴더 열기
          shell.showItemInFolder(resolvedPath);
        } else {
          // 폴더 열기 모드
          const stats = await fs.stat(resolvedPath);

          if (stats.isDirectory()) {
            shell.openPath(resolvedPath);
          } else {
            // 파일인 경우 상위 폴더 열기
            shell.openPath(path.dirname(resolvedPath));
          }
        }

        return {
          success: true,
        };
      } catch (error) {
        console.error("[AIFileHandler] OpenExplorer 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 Search Handler (Phase 3)
// ============================================

/**
 * 🎯 파일 검색 IPC Handler
 *
 * Safe Zone 내부에서 파일명 및 내용 검색
 * 확장자 필터링, maxResults 제한 지원
 */
const aiFileSearchHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-file-search-handler",
  channel: aiFileSearchChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return async (request: AIFileSearchRequest): Promise<AIFileSearchResponse> => {
      try {
        // 1. Safe Zone 경로 가져오기 (scope.basePath 우선)
        const safeZonePath = getSafeZonePath(userPreferencesState, request.basePath.scope?.basePath);

        // 2. 경로 해석
        const resolvedPath = resolvePath(request.basePath, safeZonePath);

        // 3. Path traversal 검사
        if (detectPathTraversal(resolvedPath)) {
          return createErrorResponse("PATH_TRAVERSAL", "Path traversal detected");
        }

        // 4. 경로 검증
        const validation = await validatePath(resolvedPath, safeZonePath);

        if (!validation.isInsideSafeZone) {
          return createErrorResponse("NOT_ALLOWED_PATH", "Search outside Safe Zone is not allowed");
        }

        // 5. 디렉토리 확인
        try {
          const stats = await fs.stat(resolvedPath);

          if (!stats.isDirectory()) {
            return createErrorResponse("IO_ERROR", "Base path is not a directory");
          }
        } catch {
          return createErrorResponse("FILE_NOT_FOUND", `Directory not found: ${resolvedPath}`);
        }

        // 6. 검색 실행
        const results: AIFileSearchResult[] = [];
        const maxResults = request.maxResults || 100;
        let totalCount = 0;

        const searchDir = async (dirPath: string): Promise<void> => {
          if (results.length >= maxResults) return;

          const items = await fs.readdir(dirPath, { withFileTypes: true });

          for (const item of items) {
            if (results.length >= maxResults) break;

            const itemPath = path.join(dirPath, item.name);

            // 디렉토리는 재귀 탐색
            if (item.isDirectory()) {
              await searchDir(itemPath);
              continue;
            }

            // 확장자 필터링
            if (request.extensions && request.extensions.length > 0) {
              const ext = getExtension(item.name);
              const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
              const normalizedExtensions = request.extensions.map((e) => (e.startsWith(".") ? e : `.${e}`));

              if (!normalizedExtensions.includes(normalizedExt)) {
                continue;
              }
            }

            // 파일명 검색 (glob 패턴)
            const matchesName = minimatch(item.name, request.query, { nocase: true });

            // 내용 검색
            if (request.searchContent && !matchesName) {
              try {
                const content = await fs.readFile(itemPath, "utf8");
                const lines = content.split("\n");

                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].toLowerCase().includes(request.query.toLowerCase())) {
                    totalCount++;

                    if (results.length < maxResults) {
                      results.push({
                        path: itemPath,
                        name: item.name,
                        lineNumber: i + 1,
                        matchContext: lines[i].trim().slice(0, 200),
                      });
                    }
                    break; // 파일당 하나의 결과만
                  }
                }
              } catch {
                // 파일 읽기 실패 시 무시
              }
            } else if (matchesName) {
              totalCount++;

              if (results.length < maxResults) {
                results.push({
                  path: itemPath,
                  name: item.name,
                });
              }
            }
          }
        };

        await searchDir(resolvedPath);

        return {
          success: true,
          results,
          totalCount,
        };
      } catch (error) {
        console.error("[AIFileHandler] Search 에러:", error);

        return createErrorResponse("IO_ERROR", error instanceof Error ? error.message : "Unknown error");
      }
    };
  },
});

// ============================================
// 🎯 Exports
// ============================================

export {
  aiFileReadHandlerInjectable,
  aiFileWriteHandlerInjectable,
  aiFileEnsureDirHandlerInjectable,
  aiFileListHandlerInjectable,
  aiFileExistsHandlerInjectable,
  aiFileDiffHandlerInjectable,
  aiFileDeleteHandlerInjectable,
  aiFileOpenExplorerHandlerInjectable,
  aiFileSearchHandlerInjectable,
};

// Helper exports for testing
export { getSafeZonePath, resolvePath };
