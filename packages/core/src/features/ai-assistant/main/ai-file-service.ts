/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * AI File System Service (Pure Functions)
 *
 * Shared file operation functions used by both AI File Handler and Agent Tools.
 * Performs file system operations directly without IPC communication.
 *
 * Usage:
 * - ai-file-handler.injectable.ts (IPC handlers)
 * - agent-host.injectable.ts (Agent Tools)
 *
 * History:
 * - 2026-01-29: Initial creation (Agent integration)
 * - 2026-01-29: Type definition alignment (ai-file-channels.ts)
 */

// @ts-expect-error - diff package has no type definitions
import { createTwoFilesPatch } from "diff";
import * as fs from "fs/promises";
import { minimatch } from "minimatch";
import * as os from "os";
import * as path from "path";
import {
  DAIVE_DOCUMENTS_ROOT,
  detectPathTraversal,
  getExtension,
  getMimeType,
  sanitizeClusterName,
  validatePath,
} from "./ai-file-utils";

import type {
  AIFileChangeNotification,
  AIFileDeleteRequest,
  AIFileDeleteResponse,
  AIFileDiffRequest,
  AIFileDiffResponse,
  AIFileDirType,
  AIFileEnsureDirRequest,
  AIFileEnsureDirResponse,
  AIFileErrorCode,
  AIFileListEntry,
  AIFileListRequest,
  AIFileListResponse,
  AIFileOpenExplorerRequest,
  AIFileOpenExplorerResponse,
  AIFilePath,
  AIFileReadRequest,
  AIFileReadResponse,
  AIFileScope,
  AIFileSearchRequest,
  AIFileSearchResponse,
  AIFileSearchResult,
  AIFileWriteRequest,
  AIFileWriteResponse,
} from "../common/ai-file-channels";

// ============================================
// Helper Functions
// ============================================

/**
 * 🎯 Returns Safe Zone path
 *
 * 우선순위:
 * 1. scope.basePath (명시적 전달 - 가장 높은 우선순위)
 * 2. OS 홈 디렉토리 (기본값)
 *
 * 📝 2026-01-29 FIX: scope.basePath를 사용하도록 수정
 * 이전에는 os.homedir()/daive-documents로 하드코딩되어 있어서
 * Settings에서 설정한 경로가 무시되었음
 *
 * @param scopeBasePath - scope에서 전달된 basePath (optional)
 * @returns Safe Zone 루트 경로
 */
function getSafeZonePath(scopeBasePath?: string): string {
  // 1. scope.basePath가 있으면 우선 사용 (Renderer에서 직접 전달)
  if (scopeBasePath) {
    return scopeBasePath;
  }

  // 2. 기본값: OS 홈 디렉토리
  return os.homedir();
}

/**
 * 🎯 Resolves AIFilePath to actual path
 *
 * 📝 2026-01-29 FIX: scope.basePath를 사용하도록 수정
 * relativePath는 Safe Zone 기준 상대 경로 (예: "daive-documents/cluster/reports/...")
 * → 중복 경로 생성을 방지하기 위해 clusterDir 추가 로직 제거
 */
function resolvePath(filePath: AIFilePath): string {
  if (filePath.absolutePath) {
    return filePath.absolutePath;
  }

  // 🎯 FIX: scope.basePath 우선 사용
  const safeZone = getSafeZonePath(filePath.scope?.basePath);

  // 📝 relativePath는 이미 "daive-documents/cluster/..." 형식으로 전달됨
  // 추가로 clusterDir을 붙이면 중복 경로가 생성됨
  // 따라서 relativePath를 그대로 사용
  return path.join(safeZone, filePath.relativePath || "");
}

/**
 * 🎯 Resolves path from AIFileScope + dirType
 *
 * 📝 2026-01-29 FIX: scope.basePath를 사용하도록 수정
 */
function resolvePathFromScope(scope: AIFileScope, dirType: AIFileDirType, customName?: string): string {
  // 🎯 FIX: scope.basePath 우선 사용
  const safeZone = getSafeZonePath(scope.basePath);

  // Determine cluster directory
  // 🎯 FIX: clusterId를 전달하여 save_to_cluster와 동일한 폴더명 생성
  // 이전에는 clusterId 없이 호출해서 폴더명 불일치 발생
  let clusterDir = "";
  if (scope.clusterId || scope.clusterName) {
    clusterDir = scope.clusterName ? sanitizeClusterName(scope.clusterName, scope.clusterId) : scope.clusterId!;
  }

  // Map directory type to subfolder
  const typeDirMap: Record<AIFileDirType, string> = {
    reports: "reports",
    plans: "plans",
    manifests: "manifests",
    configs: "configs",
    misc: "misc",
    custom: customName || "custom",
  };

  const typeDir = typeDirMap[dirType] || "misc";

  // 🎯 FIX: daive-documents 폴더 추가
  if (clusterDir) {
    return path.join(safeZone, DAIVE_DOCUMENTS_ROOT, clusterDir, typeDir);
  }

  return path.join(safeZone, DAIVE_DOCUMENTS_ROOT, typeDir);
}

/**
 * Creates error response
 */
function createErrorResponse<T extends { success: false; error?: AIFileErrorCode; errorMessage?: string }>(
  errorMessage: string,
  error: AIFileErrorCode,
): T {
  return { success: false, error, errorMessage } as T;
}

// ============================================
// File Read Service
// ============================================

export interface AIFileServiceDependencies {
  /** Logger (optional) */
  logger?: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  /**
   * 🎯 FIX: File Explorer 자동 갱신을 위한 콜백 (optional)
   *
   * AI Tool에서 파일 작업 후 File Explorer가 자동 갱신되도록
   * 변경 알림을 전송하는 콜백입니다.
   *
   * @param notification - 파일 변경 알림 정보
   */
  onFileChange?: (notification: AIFileChangeNotification) => void;
}

/**
 * Creates file read function
 */
export function createReadFileService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileReadRequest): Promise<AIFileReadResponse> => {
    const { path: filePath, encoding = "utf8", maxBytes } = request;
    const resolvedPath = resolvePath(filePath);

    deps?.logger?.info(`[AIFileService] Read: ${resolvedPath}`);

    try {
      // Path traversal check
      if (detectPathTraversal(resolvedPath)) {
        return createErrorResponse("Path traversal attack detected", "PATH_TRAVERSAL");
      }

      // Path validation
      const safeZone = getSafeZonePath();
      const validPath = await validatePath(resolvedPath, safeZone);
      if (!validPath.valid) {
        return createErrorResponse(
          validPath.errorMessage || "Path validation failed",
          validPath.error || "PERMISSION_DENIED",
        );
      }

      // Check file exists
      try {
        await fs.access(resolvedPath);
      } catch {
        return createErrorResponse("File not found", "FILE_NOT_FOUND");
      }

      // Check file size
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        return createErrorResponse("Path is a directory", "IO_ERROR");
      }

      const fileSizeLimit = maxBytes ?? 50 * 1024 * 1024; // 50MB
      if (stats.size > fileSizeLimit) {
        return createErrorResponse(`File too large (${stats.size} bytes > ${fileSizeLimit} bytes)`, "FILE_TOO_LARGE");
      }

      // Read file
      const content = await fs.readFile(resolvedPath, encoding as BufferEncoding);

      return {
        success: true,
        content,
        size: stats.size,
        mimeType: getMimeType(resolvedPath),
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] Read error: ${error}`);
      return createErrorResponse(`Read failed: ${error instanceof Error ? error.message : String(error)}`, "IO_ERROR");
    }
  };
}

/**
 * Creates file write function
 */
export function createWriteFileService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileWriteRequest): Promise<AIFileWriteResponse> => {
    const { path: filePath, content, mode = "overwrite" } = request;
    const resolvedPath = resolvePath(filePath);

    deps?.logger?.info(`[AIFileService] Write: ${resolvedPath} (mode: ${mode})`);

    try {
      // Path validation
      if (detectPathTraversal(resolvedPath)) {
        return createErrorResponse("Path traversal attack detected", "PERMISSION_DENIED");
      }

      // 🎯 FIX: scope.basePath를 사용하여 Safe Zone 검사
      // 🎯 FIX: path.sep을 추가하여 /safe vs /safe2 우회 방지
      const safeZone = getSafeZonePath(filePath.scope?.basePath);
      const safeZoneWithSep = safeZone.endsWith(path.sep) ? safeZone : safeZone + path.sep;
      const isInsideSafeZone = resolvedPath === safeZone || resolvedPath.startsWith(safeZoneWithSep);
      if (!isInsideSafeZone) {
        return createErrorResponse("Cannot write outside Safe Zone", "NOT_ALLOWED_PATH");
      }

      // Create directory
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      let finalContent = content;
      if (mode === "append") {
        try {
          const existing = await fs.readFile(resolvedPath, "utf8");
          finalContent = existing + content;
        } catch {
          // File doesn't exist, create new
        }
      } else if (mode === "create") {
        try {
          await fs.access(resolvedPath);
          return createErrorResponse("File already exists (mode: create)", "IO_ERROR");
        } catch {
          // File doesn't exist, proceed normally
        }
      }

      await fs.writeFile(resolvedPath, finalContent, "utf8");

      // 🎯 FIX: File Explorer 자동 갱신을 위한 알림 전송
      deps?.onFileChange?.({
        action: "write",
        path: resolvedPath,
        isDirectory: false,
      });

      return {
        success: true,
        writtenPath: resolvedPath,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] Write error: ${error}`);
      return createErrorResponse(`Write failed: ${error instanceof Error ? error.message : String(error)}`, "IO_ERROR");
    }
  };
}

/**
 * Creates directory creation function
 */
export function createEnsureDirService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileEnsureDirRequest): Promise<AIFileEnsureDirResponse> => {
    const { scope, dirType, customName } = request;
    const resolvedPath = resolvePathFromScope(scope, dirType, customName);

    deps?.logger?.info(`[AIFileService] EnsureDir: ${resolvedPath} (type: ${dirType})`);

    try {
      // Path validation
      if (detectPathTraversal(resolvedPath)) {
        return createErrorResponse("Path traversal attack detected", "PERMISSION_DENIED");
      }

      // 🎯 FIX: scope.basePath를 사용하여 Safe Zone 검사
      // 🎯 FIX: path.sep을 추가하여 /safe vs /safe2 우회 방지
      const safeZone = getSafeZonePath(scope.basePath);
      const safeZoneWithSep = safeZone.endsWith(path.sep) ? safeZone : safeZone + path.sep;
      const isInsideSafeZone = resolvedPath === safeZone || resolvedPath.startsWith(safeZoneWithSep);
      if (!isInsideSafeZone) {
        return createErrorResponse("Cannot create folder outside Safe Zone", "NOT_ALLOWED_PATH");
      }

      // Create folder
      await fs.mkdir(resolvedPath, { recursive: true });

      // 🎯 FIX: File Explorer 자동 갱신을 위한 알림 전송
      deps?.onFileChange?.({
        action: "create_dir",
        path: resolvedPath,
        isDirectory: true,
      });

      return {
        success: true,
        createdPath: resolvedPath,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] EnsureDir error: ${error}`);
      return createErrorResponse(
        `Folder creation failed: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  };
}

/**
 * Creates directory listing function
 */
export function createListDirService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileListRequest): Promise<AIFileListResponse> => {
    const { path: filePath, pattern, recursive = false } = request;
    const resolvedPath = resolvePath(filePath);

    deps?.logger?.info(`[AIFileService] List: ${resolvedPath}`);

    try {
      // Path validation
      if (detectPathTraversal(resolvedPath)) {
        return createErrorResponse("Path traversal attack detected", "PERMISSION_DENIED");
      }

      // Check directory exists
      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          return createErrorResponse("Path is not a directory", "FILE_NOT_FOUND");
        }
      } catch {
        return createErrorResponse("Directory not found", "FILE_NOT_FOUND");
      }

      // Read directory
      const entries: AIFileListEntry[] = [];
      const listDir = async (dir: string, relativePath = ""): Promise<void> => {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;

          // Pattern matching
          if (pattern && !minimatch(itemRelativePath, pattern)) {
            if (!item.isDirectory() || !recursive) {
              continue;
            }
          }

          try {
            const stats = await fs.stat(fullPath);
            const entry: AIFileListEntry = {
              name: item.name,
              path: fullPath,
              isDirectory: item.isDirectory(),
              size: item.isFile() ? stats.size : undefined,
              modifiedAt: Math.floor(stats.mtime.getTime() / 1000), // Unix timestamp (number)
            };

            if (!pattern || minimatch(itemRelativePath, pattern)) {
              entries.push(entry);
            }

            if (recursive && item.isDirectory()) {
              await listDir(fullPath, itemRelativePath);
            }
          } catch {
            // Skip inaccessible items
          }
        }
      };

      await listDir(resolvedPath);

      return {
        success: true,
        entries,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] List error: ${error}`);
      return createErrorResponse(`List failed: ${error instanceof Error ? error.message : String(error)}`, "IO_ERROR");
    }
  };
}

/**
 * Creates diff calculation function
 */
export function createDiffService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileDiffRequest): Promise<AIFileDiffResponse> => {
    const { path: filePath, newContent } = request;
    const resolvedPath = resolvePath(filePath);

    deps?.logger?.info(`[AIFileService] Diff: ${resolvedPath}`);

    try {
      let oldContent = "";
      let exists = false;

      try {
        oldContent = await fs.readFile(resolvedPath, "utf-8");
        exists = true;
      } catch {
        exists = false;
      }

      // Generate diff
      const diff = createTwoFilesPatch(resolvedPath, resolvedPath, oldContent, newContent, "Original", "Modified");

      return {
        success: true,
        diff,
        oldContent: exists ? oldContent : undefined,
        exists,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] Diff error: ${error}`);
      // AIFileDiffResponse requires exists field
      return {
        success: false,
        exists: false,
        error: "IO_ERROR" as AIFileErrorCode,
        errorMessage: `Diff calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

/**
 * Creates file/folder delete function
 */
export function createDeleteService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileDeleteRequest): Promise<AIFileDeleteResponse> => {
    const { path: filePath, recursive = false, skipHitl = false } = request;
    const resolvedPath = resolvePath(filePath);

    deps?.logger?.info(`[AIFileService] Delete: ${resolvedPath}`);

    try {
      // Path validation
      if (detectPathTraversal(resolvedPath)) {
        return createErrorResponse("Path traversal attack detected", "PERMISSION_DENIED");
      }

      // 🎯 FIX: scope.basePath를 사용하여 Safe Zone 검사
      // 🎯 FIX: path.sep을 추가하여 /safe vs /safe2 우회 방지
      const safeZone = getSafeZonePath(filePath.scope?.basePath);
      const safeZoneWithSep = safeZone.endsWith(path.sep) ? safeZone : safeZone + path.sep;
      const isInsideSafeZone = resolvedPath === safeZone || resolvedPath.startsWith(safeZoneWithSep);
      if (!isInsideSafeZone && !skipHitl) {
        return createErrorResponse("Cannot delete outside Safe Zone", "NOT_ALLOWED_PATH");
      }

      // Check file/directory exists
      try {
        await fs.access(resolvedPath);
      } catch {
        return createErrorResponse("File or folder not found", "FILE_NOT_FOUND");
      }

      const stats = await fs.stat(resolvedPath);
      const wasDirectory = stats.isDirectory();

      // Delete
      if (wasDirectory) {
        if (!recursive) {
          return createErrorResponse("Directory deletion requires recursive option", "IO_ERROR");
        }
        await fs.rm(resolvedPath, { recursive: true, force: true });
      } else {
        await fs.unlink(resolvedPath);
      }

      // 🎯 FIX: File Explorer 자동 갱신을 위한 알림 전송
      deps?.onFileChange?.({
        action: "delete",
        path: resolvedPath,
        isDirectory: wasDirectory,
      });

      return {
        success: true,
        deletedPath: resolvedPath,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] Delete error: ${error}`);
      return createErrorResponse(
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  };
}

/**
 * Creates OS explorer open function (shell.showItemInFolder)
 */
export function createOpenExplorerService(
  deps?: AIFileServiceDependencies,
  shellModule?: typeof import("electron").shell,
) {
  return async (request: AIFileOpenExplorerRequest): Promise<AIFileOpenExplorerResponse> => {
    const { path: filePath, selectFile = true } = request;
    const resolvedPath = resolvePath(filePath);

    deps?.logger?.info(`[AIFileService] OpenExplorer: ${resolvedPath}`);

    try {
      // Check path exists
      try {
        await fs.access(resolvedPath);
      } catch {
        return createErrorResponse("Path not found", "FILE_NOT_FOUND");
      }

      // Use shell module (only available in Main Process)
      if (shellModule) {
        if (selectFile) {
          shellModule.showItemInFolder(resolvedPath);
        } else {
          await shellModule.openPath(resolvedPath);
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] OpenExplorer error: ${error}`);
      return createErrorResponse(
        `Open explorer failed: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  };
}

/**
 * Creates file search function
 */
export function createSearchService(deps?: AIFileServiceDependencies) {
  return async (request: AIFileSearchRequest): Promise<AIFileSearchResponse> => {
    const { basePath, query, searchContent = false, extensions, maxResults = 100 } = request;
    const resolvedPath = resolvePath(basePath);

    deps?.logger?.info(`[AIFileService] Search: ${resolvedPath} query=${query}`);

    try {
      // Check directory exists
      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          return createErrorResponse("Path is not a directory", "FILE_NOT_FOUND");
        }
      } catch {
        return createErrorResponse("Directory not found", "FILE_NOT_FOUND");
      }

      const results: AIFileSearchResult[] = [];

      const searchDir = async (dir: string): Promise<void> => {
        if (results.length >= maxResults) return;

        try {
          const items = await fs.readdir(dir, { withFileTypes: true });

          for (const item of items) {
            if (results.length >= maxResults) break;

            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
              await searchDir(fullPath);
            } else if (item.isFile()) {
              // Extension filter
              if (extensions && extensions.length > 0) {
                const ext = getExtension(item.name);
                if (!extensions.includes(ext)) {
                  continue;
                }
              }

              // Filename search
              if (minimatch(item.name, query) || item.name.includes(query)) {
                results.push({
                  path: fullPath,
                  name: item.name,
                });
                continue;
              }

              // Content search
              if (searchContent) {
                try {
                  const content = await fs.readFile(fullPath, "utf-8");
                  const lines = content.split("\n");

                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(query)) {
                      results.push({
                        path: fullPath,
                        name: item.name,
                        lineNumber: i + 1,
                        matchContext: lines[i].trim().substring(0, 100),
                      });
                      break;
                    }
                  }
                } catch {
                  // Skip unreadable files
                }
              }
            }
          }
        } catch {
          // Skip inaccessible directories
        }
      };

      await searchDir(resolvedPath);

      return {
        success: true,
        results,
        totalCount: results.length,
      };
    } catch (error) {
      deps?.logger?.error(`[AIFileService] Search error: ${error}`);
      return createErrorResponse(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  };
}

/**
 * Creates all services helper
 */
export function createAIFileServices(deps?: AIFileServiceDependencies, shellModule?: typeof import("electron").shell) {
  return {
    readFile: createReadFileService(deps),
    writeFile: createWriteFileService(deps),
    ensureDir: createEnsureDirService(deps),
    listDir: createListDirService(deps),
    getDiff: createDiffService(deps),
    deleteFile: createDeleteService(deps),
    openExplorer: createOpenExplorerService(deps, shellModule),
    searchFiles: createSearchService(deps),
  };
}
