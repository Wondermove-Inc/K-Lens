/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI 파일 시스템 LangGraph Tools
 *
 * AI Assistant가 파일을 읽기/쓰기/삭제/탐색/검색할 수 있는 Tool들을 정의합니다.
 *
 * 📋 Phase 1 Tools:
 * - read_file: 파일 읽기
 * - write_file: 파일 쓰기/수정
 * - list_directory: 디렉토리 목록 조회
 * - ensure_cluster_dir: 클러스터 폴더 생성
 * - save_to_cluster: 클러스터 폴더에 파일 저장 (고수준 래퍼)
 *
 * 📋 Phase 2 Tools:
 * - delete_file: 파일/폴더 삭제
 * - open_in_explorer: OS 탐색기에서 열기
 *
 * 📋 Phase 3 Tools:
 * - search_files: 파일명/내용 검색
 *
 * 📝 HITL 정책:
 * - read_file: Safe Zone 외부만 승인 필요
 * - write_file: 항상 승인 필요
 * - save_to_cluster: 항상 승인 필요
 * - delete_file: 항상 승인 필요
 * - list_directory, ensure_cluster_dir, open_in_explorer, search_files: 승인 불필요
 *
 * 🔄 변경이력:
 * - 2026-01-29: 초기 생성 (AI File System Integration)
 * - 2026-01-29: Phase 2 Tools 추가
 * - 2026-01-29: Phase 3 Tools 추가
 */

import { tool } from "@langchain/core/tools";
import * as path from "path";
import { z } from "zod";
import { AI_ALLOWED_EXTENSIONS } from "../../common/ai-file-channels";
import { addTimestampToFilename, sanitizeClusterName } from "../ai-file-utils";

import type {
  AIFileDeleteRequest,
  AIFileDeleteResponse,
  AIFileDiffRequest,
  AIFileDiffResponse,
  AIFileDirType,
  AIFileEnsureDirRequest,
  AIFileEnsureDirResponse,
  AIFileListRequest,
  AIFileListResponse,
  AIFileOpenExplorerRequest,
  AIFileOpenExplorerResponse,
  AIFileReadRequest,
  AIFileReadResponse,
  AIFileSearchRequest,
  AIFileSearchResponse,
  AIFileWriteRequest,
  AIFileWriteResponse,
} from "../../common/ai-file-channels";

// ============================================
// 🎯 IPC 함수 타입 정의
// ============================================

/**
 * 🎯 파일 읽기 IPC 함수 타입
 */
export interface AIFileReadFunction {
  (request: AIFileReadRequest): Promise<AIFileReadResponse>;
}

/**
 * 🎯 파일 쓰기 IPC 함수 타입
 */
export interface AIFileWriteFunction {
  (request: AIFileWriteRequest): Promise<AIFileWriteResponse>;
}

/**
 * 🎯 디렉토리 생성 IPC 함수 타입
 */
export interface AIFileEnsureDirFunction {
  (request: AIFileEnsureDirRequest): Promise<AIFileEnsureDirResponse>;
}

/**
 * 🎯 디렉토리 목록 IPC 함수 타입
 */
export interface AIFileListFunction {
  (request: AIFileListRequest): Promise<AIFileListResponse>;
}

/**
 * 🎯 Diff 계산 IPC 함수 타입
 */
export interface AIFileDiffFunction {
  (request: AIFileDiffRequest): Promise<AIFileDiffResponse>;
}

/**
 * 🎯 파일/폴더 삭제 IPC 함수 타입 (Phase 2)
 */
export interface AIFileDeleteFunction {
  (request: AIFileDeleteRequest): Promise<AIFileDeleteResponse>;
}

/**
 * 🎯 OS 탐색기 열기 IPC 함수 타입 (Phase 2)
 */
export interface AIFileOpenExplorerFunction {
  (request: AIFileOpenExplorerRequest): Promise<AIFileOpenExplorerResponse>;
}

/**
 * 🎯 파일 검색 IPC 함수 타입 (Phase 3)
 */
export interface AIFileSearchFunction {
  (request: AIFileSearchRequest): Promise<AIFileSearchResponse>;
}

// ============================================
// 🎯 Tool 응답 타입
// ============================================

export type FileToolResponseStatus = "success" | "error";

export interface FileToolResponse<TData = unknown> {
  status: FileToolResponseStatus;
  data?: TData;
  message?: string;
  code?: string;
}

// ============================================
// 🎯 Tools Dependencies
// ============================================

export interface AIFileToolsDependencies {
  /** 파일 읽기 IPC 함수 */
  readFile: AIFileReadFunction;
  /** 파일 쓰기 IPC 함수 */
  writeFile: AIFileWriteFunction;
  /** 디렉토리 생성 IPC 함수 */
  ensureDir: AIFileEnsureDirFunction;
  /** 디렉토리 목록 IPC 함수 */
  listDir: AIFileListFunction;
  /** Diff 계산 IPC 함수 */
  getDiff: AIFileDiffFunction;
  /** 파일/폴더 삭제 IPC 함수 (Phase 2) */
  deleteFile: AIFileDeleteFunction;
  /** OS 탐색기 열기 IPC 함수 (Phase 2) */
  openExplorer: AIFileOpenExplorerFunction;
  /** 파일 검색 IPC 함수 (Phase 3) */
  searchFiles: AIFileSearchFunction;
  /** 현재 클러스터 ID 가져오기 */
  getClusterId: () => string | null;
  /** 현재 클러스터 이름 가져오기 */
  getClusterName: () => string | null;
  /**
   * 🎯 Safe Zone 기본 경로 가져오기
   *
   * Settings > File Explorer > Default folder path에서 설정된 경로 반환
   * 설정되지 않은 경우 null 반환 (Handler에서 os.homedir() 사용)
   *
   * 📝 2026-01-29 FIX: Main Process에서 userPreferencesState가
   * 제대로 로드되지 않는 문제 대응 - Renderer에서 직접 전달
   */
  getBasePath: () => string | null;
}

// ============================================
// 🎯 Path Helper
// ============================================

/**
 * 🎯 경로가 절대 경로인지 판별
 *
 * @param filePath - 파일 경로
 * @returns 절대 경로 여부
 */
function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * 🎯 AIFilePath 구성
 *
 * 📝 스펙 문서 3.2절에 따라 scope.basePath를 포함하여 구성합니다.
 * basePath는 Settings > File Explorer > Default folder path에서 설정된 경로입니다.
 *
 * @param filePath - 파일 경로 (절대 또는 상대)
 * @param clusterId - 클러스터 ID
 * @param clusterName - 클러스터 이름
 * @param basePath - Safe Zone 기본 경로 (Renderer에서 전달)
 * @returns AIFilePath 형식의 경로 객체
 */
function buildAIFilePath(
  filePath: string,
  clusterId?: string | null,
  clusterName?: string | null,
  basePath?: string | null,
) {
  const scope = {
    clusterId: clusterId || undefined,
    clusterName: clusterName || undefined,
    // 🎯 FIX: basePath 전달 - Main Process에서 userPreferences 로드 문제 대응
    basePath: basePath || undefined,
  };

  if (isAbsolutePath(filePath)) {
    return { scope, absolutePath: filePath };
  }

  return { scope, relativePath: filePath };
}

// ============================================
// 🎯 AI File Tools Factory
// ============================================

/**
 * 🎯 AI 파일 시스템 Tools 생성
 *
 * @param dependencies - Tool 실행에 필요한 의존성
 * @returns LangChain Tool 배열
 */
export function createAIFileTools(dependencies: AIFileToolsDependencies) {
  const {
    readFile,
    writeFile,
    ensureDir,
    listDir,
    deleteFile,
    openExplorer,
    searchFiles,
    getClusterId,
    getClusterName,
    getBasePath,
  } = dependencies;

  // ============================================
  // 🎯 read_file Tool
  // ============================================

  const readFileTool = tool(
    async (input) => {
      const { path: filePath, maxBytes } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] read_file:", filePath, "basePath:", basePath);

      try {
        // IPC 호출
        const response = await readFile({
          path: buildAIFilePath(filePath, clusterId, clusterName, basePath),
          maxBytes,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            content: response.content,
            size: response.size,
            mimeType: response.mimeType,
          },
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "read_file",
      description: `Reads the content of a file.
Files inside Safe Zone can be read directly, while files outside require user approval.
Supported formats: ${AI_ALLOWED_EXTENSIONS.join(", ")}`,
      schema: z.object({
        path: z.string().describe("File path to read (relative or absolute)"),
        maxBytes: z.number().optional().describe("Maximum bytes to read (default 50MB)"),
      }),
    },
  );

  // ============================================
  // 🎯 write_file Tool
  // ============================================

  const writeFileTool = tool(
    async (input) => {
      const { path: filePath, content, mode = "create" } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] write_file:", filePath, "mode:", mode, "basePath:", basePath);

      try {
        // 파일 쓰기
        const response = await writeFile({
          path: buildAIFilePath(filePath, clusterId, clusterName, basePath),
          content,
          mode,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            writtenPath: response.writtenPath,
          },
          message: `File saved: ${response.writtenPath}`,
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "write_file",
      description: `Writes content to a file. Always requires user approval.
Supports modes: create (new file), overwrite (replace existing), append (add to existing).
For cluster-specific files, use save_to_cluster instead.`,
      schema: z.object({
        path: z.string().describe("File path to write (relative or absolute)"),
        content: z.string().describe("Content to write"),
        mode: z
          .enum(["create", "overwrite", "append"])
          .optional()
          .describe("Write mode: create (default), overwrite, or append"),
      }),
    },
  );

  // ============================================
  // 🎯 list_directory Tool
  // ============================================

  const listDirectoryTool = tool(
    async (input) => {
      const { path: dirPath, recursive = false, pattern } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] list_directory:", dirPath, "basePath:", basePath);

      try {
        const response = await listDir({
          path: buildAIFilePath(dirPath, clusterId, clusterName, basePath),
          recursive,
          pattern,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            entries: response.entries,
            count: response.entries?.length || 0,
          },
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "list_directory",
      description: `Lists files and directories in a path.
Only works inside Safe Zone. Does not require user approval.`,
      schema: z.object({
        path: z.string().describe("Directory path to list"),
        recursive: z.boolean().optional().describe("Include subdirectories (default: false)"),
        pattern: z.string().optional().describe("Glob pattern filter (e.g., '*.md')"),
      }),
    },
  );

  // ============================================
  // 🎯 ensure_cluster_dir Tool
  // ============================================

  const ensureClusterDirTool = tool(
    async (input) => {
      const { folderType, customName } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] ensure_cluster_dir:", folderType, "cluster:", clusterName, "basePath:", basePath);

      if (!clusterId || !clusterName) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "No cluster is currently selected. Please select a cluster first.",
        } as FileToolResponse);
      }

      try {
        const response = await ensureDir({
          // 🎯 FIX: basePath 전달 - Settings에서 설정된 경로 사용
          scope: { clusterId, clusterName, basePath: basePath || undefined },
          dirType: folderType as AIFileDirType,
          customName,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            createdPath: response.createdPath,
          },
          message: `Folder ready: ${response.createdPath}`,
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "ensure_cluster_dir",
      description: `Creates a folder structure for the current cluster.
Folder types: reports (analysis reports), plans (work plans), manifests (K8s YAML), configs (config files), misc (other).
Does not require user approval.`,
      schema: z.object({
        folderType: z
          .enum(["reports", "plans", "manifests", "configs", "misc", "custom"])
          .describe("Type of folder to create"),
        customName: z.string().optional().describe("Custom folder name (only for 'custom' type)"),
      }),
    },
  );

  // ============================================
  // 🎯 save_to_cluster Tool (고수준 래퍼)
  // ============================================

  const saveToClusterTool = tool(
    async (input) => {
      const { filename, content, folderType } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] save_to_cluster:", filename, "to:", folderType, "basePath:", basePath);

      if (!clusterId || !clusterName) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "No cluster is currently selected. Please select a cluster first.",
        } as FileToolResponse);
      }

      // 🎯 content 빈 값 방어 (validation 외 추가 체크)
      if (!content || content.trim().length === 0) {
        return JSON.stringify({
          status: "error",
          code: "EMPTY_CONTENT",
          message: "File content cannot be empty. Please provide the actual content to save.",
        } as FileToolResponse);
      }

      try {
        // 1. 클러스터 폴더 생성 (승인 불필요)
        // 🎯 FIX: basePath 전달 - Settings에서 설정된 경로 사용
        const dirResponse = await ensureDir({
          scope: { clusterId, clusterName, basePath: basePath || undefined },
          dirType: folderType as AIFileDirType,
        });

        if (!dirResponse.success) {
          return JSON.stringify({
            status: "error",
            code: dirResponse.error,
            message: "Failed to create folder: " + dirResponse.errorMessage,
          } as FileToolResponse);
        }

        // 2. 파일명 생성 (타임스탬프 추가)
        const finalFilename = addTimestampToFilename(filename);

        // 3. 전체 경로 구성
        const sanitizedName = sanitizeClusterName(clusterName, clusterId);
        const relativePath = path.join("daive-documents", sanitizedName, folderType, finalFilename);

        // 4. 파일 쓰기
        // 🎯 FIX: basePath 전달 - Settings에서 설정된 경로 사용
        const writeResponse = await writeFile({
          path: { scope: { clusterId, clusterName, basePath: basePath || undefined }, relativePath },
          content,
          mode: "create",
        });

        if (!writeResponse.success) {
          return JSON.stringify({
            status: "error",
            code: writeResponse.error,
            message: writeResponse.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            savedPath: writeResponse.writtenPath,
            filename: finalFilename,
            folderType,
          },
          message: `File saved: ${finalFilename}`,
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "save_to_cluster",
      description: `Saves a file to the current cluster's dedicated folder.
Automatically creates the folder structure and adds a timestamp to the filename.
Use this for saving analysis reports, manifests, plans, and other cluster-specific files.
IMPORTANT: Content must be non-empty. Call save_to_cluster only once per document.
Requires user approval.`,
      schema: z.object({
        filename: z.string().min(1).describe("Filename with extension (e.g., 'health-report.md', 'deployment.yaml')"),
        content: z.string().min(1).describe("File content (required, must be non-empty)"),
        folderType: z.enum(["reports", "plans", "manifests", "configs", "misc"]).describe("Target folder type"),
      }),
    },
  );

  // ============================================
  // 🎯 delete_file Tool (Phase 2)
  // ============================================

  const deleteFileTool = tool(
    async (input) => {
      const { path: filePath, recursive = false } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] delete_file:", filePath, "recursive:", recursive, "basePath:", basePath);

      try {
        // 삭제 실행
        const response = await deleteFile({
          path: buildAIFilePath(filePath, clusterId, clusterName, basePath),
          recursive,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            deletedPath: response.deletedPath,
          },
          message: `Deleted: ${response.deletedPath}`,
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "delete_file",
      description: `Deletes a file or folder. Always requires user approval.
For folders, use recursive=true to delete all contents.
Only works inside Safe Zone.`,
      schema: z.object({
        path: z.string().describe("Path to delete (relative or absolute)"),
        recursive: z.boolean().optional().describe("Delete folder and all contents (default: false)"),
      }),
    },
  );

  // ============================================
  // 🎯 open_in_explorer Tool (Phase 2)
  // ============================================

  const openInExplorerTool = tool(
    async (input) => {
      const { path: filePath, selectFile = false } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log("[AIFileTools] open_in_explorer:", filePath, "selectFile:", selectFile, "basePath:", basePath);

      try {
        // OS 탐색기 열기 (승인 불필요 - 읽기 전용 작업)
        const response = await openExplorer({
          path: buildAIFilePath(filePath, clusterId, clusterName, basePath),
          selectFile,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          message: `Opened in explorer: ${filePath}`,
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "open_in_explorer",
      description: `Opens a file or folder in the OS file explorer (Windows Explorer, macOS Finder, Linux file manager).
Use selectFile=true to highlight the file in its parent folder.
Does not require user approval. Only works inside Safe Zone.`,
      schema: z.object({
        path: z.string().describe("Path to open in explorer"),
        selectFile: z.boolean().optional().describe("Highlight file in folder (default: false)"),
      }),
    },
  );

  // ============================================
  // 🎯 search_files Tool (Phase 3)
  // ============================================

  const searchFilesTool = tool(
    async (input) => {
      const { query, basePath: searchBasePath = ".", searchContent = false, extensions, maxResults = 50 } = input;
      const clusterId = getClusterId();
      const clusterName = getClusterName();
      const basePath = getBasePath();

      console.log(
        "[AIFileTools] search_files:",
        query,
        "in:",
        searchBasePath,
        "searchContent:",
        searchContent,
        "basePath:",
        basePath,
      );

      try {
        // 검색 실행 (승인 불필요 - 읽기 전용 작업)
        const response = await searchFiles({
          basePath: buildAIFilePath(searchBasePath, clusterId, clusterName, basePath),
          query,
          searchContent,
          extensions,
          maxResults,
        });

        if (!response.success) {
          return JSON.stringify({
            status: "error",
            code: response.error,
            message: response.errorMessage,
          } as FileToolResponse);
        }

        return JSON.stringify({
          status: "success",
          data: {
            results: response.results,
            totalCount: response.totalCount,
            shownCount: response.results?.length ?? 0,
          },
          message: `Found ${response.totalCount} results (showing ${response.results?.length ?? 0})`,
        } as FileToolResponse);
      } catch (error) {
        return JSON.stringify({
          status: "error",
          code: "IO_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        } as FileToolResponse);
      }
    },
    {
      name: "search_files",
      description: `Searches for files by name or content inside Safe Zone.
Use glob patterns for filename search (e.g., '*.yaml', 'deploy*.md').
Enable searchContent to search within file contents (slower).
Use extensions filter to limit search to specific file types.`,
      schema: z.object({
        query: z.string().describe("Search query - glob pattern for filename, or text for content search"),
        basePath: z.string().optional().describe("Base directory to search in (default: current directory)"),
        searchContent: z.boolean().optional().describe("Search inside file contents (default: false)"),
        extensions: z.array(z.string()).optional().describe("Filter by extensions (e.g., ['.md', '.yaml'])"),
        maxResults: z.number().optional().describe("Maximum results to return (default: 50)"),
      }),
    },
  );

  // ============================================
  // 🎯 Return All Tools
  // ============================================

  return [
    readFileTool,
    writeFileTool,
    listDirectoryTool,
    ensureClusterDirTool,
    saveToClusterTool,
    deleteFileTool,
    openInExplorerTool,
    searchFilesTool,
  ];
}

// ============================================
// 🎯 Exports
// ============================================

export { buildAIFilePath };
