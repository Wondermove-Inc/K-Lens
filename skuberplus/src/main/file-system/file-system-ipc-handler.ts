/**
 * 🎯 목적: 파일 시스템 IPC 핸들러 (Main Process)
 * 📝 기능:
 *   - 파일 읽기/쓰기/목록 조회
 *   - 파일 크기 제한 검사
 *   - 민감 파일 필터링
 *   - 에러 핸들링 및 로깅
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module main/file-system/file-system-ipc-handler
 */

import { execFile } from "child_process";
import { app, BrowserWindow, clipboard, ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import * as yaml from "yaml";

// 🆕 Windows CF_HDROP 클립보드 지원 (Electron clipboard API는 predefined format 매핑 버그)
// 네이티브 모듈이므로 Windows에서만 동적 로드 (macOS/Linux에서는 asar 내 바인딩 해결 불가)
let clipboardFiles: { readFiles(): string[]; writeFiles(filePaths: string[]): void } | null = null;
if (process.platform === "win32") {
  try {
    clipboardFiles = require("clipboard-files");
  } catch (loadErr) {
    console.error("clipboard-files native module FAILED to load:", loadErr);
    // 네이티브 모듈 로드 실패 시 Electron 클립보드 API 폴백
  }
}

const execFileAsync = promisify(execFile);

import { watch as chokidarWatch, type FSWatcher } from "chokidar";
import {
  checkFileSize,
  type DirectoryEntry,
  type DuplicateResponse,
  FILE_SIZE_LIMITS,
  type FileInfoResponse,
  type FileStatInfo,
  fileSystemChannels,
  isSensitiveFile,
  type ReadFileResponse,
  type SearchContentRequest,
  type SearchContentResponse,
  type SearchMatch,
  type ValidateYamlRequest,
  type ValidateYamlResponse,
  type WriteFileResponse,
  type YamlValidationError,
} from "../../../../packages/core/src/common/ipc/filesystem";

/** 로거 인터페이스 (간단 버전) */
interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

/** 기본 콘솔 로거 */
const defaultLogger: Logger = {
  info: (message, ...args) => console.log(`[FileSystem] ${message}`, ...args),
  error: (message, ...args) => console.error(`[FileSystem] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[FileSystem] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[FileSystem] ${message}`, ...args),
};

/**
 * 🆕 FIX-041: 파일 시스템 Watcher 관리자
 * 📝 열린 폴더의 파일 변경을 감지하여 Renderer에 알림
 */
class FileSystemWatcherManager {
  private watcher: FSWatcher | null = null;
  private watchedPath: string | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: Set<string> = new Set();
  private logger: Logger;
  /** Debounce 간격 (ms) - 연속 변경 시 한 번만 알림 */
  private readonly DEBOUNCE_INTERVAL = 300;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 폴더 감시 시작
   * @param folderPath - 감시할 폴더 경로
   */
  startWatching(folderPath: string): void {
    // 이미 같은 폴더를 감시 중이면 무시
    if (this.watchedPath === folderPath && this.watcher) {
      this.logger.debug(`Already watching: ${folderPath}`);
      return;
    }

    // 기존 watcher 정리
    this.stopWatching();

    this.watchedPath = folderPath;
    this.logger.info(`Starting file watcher for: ${folderPath}`);

    // 🆕 FIX-042: 홈 디렉토리인 경우 감시 깊이 제한 (TCC 보호 폴더 접근 방지)
    const normalizedPath = path.normalize(folderPath);
    const isHomeDir = normalizedPath === os.homedir();

    // Chokidar watcher 생성
    this.watcher = chokidarWatch(folderPath, {
      // 초기 스캔 시 이벤트 무시 (이미 로드된 상태)
      ignoreInitial: true,
      // 폴더 내 모든 파일/하위 폴더 감시
      persistent: true,
      // 숨김 파일도 감시 (필터링은 클라이언트에서)
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
      // 파일 크기 안정화 대기 (대용량 파일 쓰기 완료 대기)
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      // 🆕 FIX-042: 홈 디렉토리는 1단계만 감시 (TCC 보호 폴더 접근 방지)
      depth: isHomeDir ? 1 : undefined,
    });

    // 이벤트 핸들러 등록
    this.watcher
      .on("add", (filePath) => this.handleChange("add", filePath))
      .on("change", (filePath) => this.handleChange("change", filePath))
      .on("unlink", (filePath) => this.handleChange("unlink", filePath))
      .on("addDir", (filePath) => this.handleChange("addDir", filePath))
      .on("unlinkDir", (filePath) => this.handleChange("unlinkDir", filePath))
      .on("error", (error) => {
        this.logger.error(`Watcher error: ${error.message}`, error);
      })
      .on("ready", () => {
        this.logger.info(`File watcher ready for: ${folderPath}`);
      });
  }

  /**
   * 폴더 감시 중지
   */
  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.logger.info(`Stopping file watcher for: ${this.watchedPath}`);
      this.watcher.close().catch((err) => {
        this.logger.error(`Failed to close watcher: ${err.message}`, err);
      });
      this.watcher = null;
    }

    this.watchedPath = null;
    this.pendingChanges.clear();
  }

  /**
   * 파일 변경 처리 (debounced)
   * @param eventType - 이벤트 타입
   * @param filePath - 변경된 파일 경로
   */
  private handleChange(eventType: string, filePath: string): void {
    this.logger.debug(`File watcher event: ${eventType} - ${filePath}`);
    this.pendingChanges.add(filePath);

    // Debounce: 연속 변경 시 마지막 변경 후 DEBOUNCE_INTERVAL ms 후에 알림
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.sendNotification();
    }, this.DEBOUNCE_INTERVAL);
  }

  /**
   * Renderer에 파일 변경 알림 전송
   */
  private sendNotification(): void {
    const changedPaths = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    if (changedPaths.length === 0) {
      return;
    }

    this.logger.info(`Sending file change notification: ${changedPaths.length} files changed`);

    // 모든 BrowserWindow에 알림 전송
    const windows = BrowserWindow.getAllWindows();
    const notification = {
      paths: changedPaths,
      rootPath: this.watchedPath,
      timestamp: Date.now(),
    };

    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(fileSystemChannels.fileChanged, notification);

        // Cluster Frame (iframe) 에도 전달하여 File Explorer 자동 갱신
        try {
          for (const frame of window.webContents.mainFrame.frames) {
            try {
              frame.send(fileSystemChannels.fileChanged, notification);
            } catch {
              // Frame이 파괴되었거나 접근 불가능한 경우 무시
            }
          }
        } catch {
          // window shutdown 중 mainFrame 접근 에러 무시
        }
      }
    }
  }

  /**
   * 현재 감시 중인 경로 반환
   */
  getWatchedPath(): string | null {
    return this.watchedPath;
  }
}

/** 전역 Watcher 인스턴스 */
let watcherManager: FileSystemWatcherManager | null = null;

/**
 * 파일 크기를 사람이 읽을 수 있는 형식으로 변환
 * @param bytes - 바이트 크기
 * @returns 포맷된 문자열 (예: "1.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 파일 권한을 문자열로 변환 (Unix 스타일)
 * @param mode - 파일 모드
 * @returns 권한 문자열 (예: "rwxr-xr-x")
 */
function formatPermissions(mode: number): string {
  const permissions = [
    mode & 0o400 ? "r" : "-",
    mode & 0o200 ? "w" : "-",
    mode & 0o100 ? "x" : "-",
    mode & 0o040 ? "r" : "-",
    mode & 0o020 ? "w" : "-",
    mode & 0o010 ? "x" : "-",
    mode & 0o004 ? "r" : "-",
    mode & 0o002 ? "w" : "-",
    mode & 0o001 ? "x" : "-",
  ];
  return permissions.join("");
}

/**
 * 복제 파일명 생성 (중복 방지)
 * @param originalPath - 원본 파일 경로
 * @returns 고유한 복제 파일 경로
 */
async function generateDuplicatePath(originalPath: string): Promise<string> {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const baseName = path.basename(originalPath, ext);

  let counter = 1;
  let newPath = path.join(dir, `${baseName}_copy${ext}`);

  while (true) {
    try {
      await fs.access(newPath);
      // 파일이 존재하면 카운터 증가
      counter++;
      newPath = path.join(dir, `${baseName}_copy${counter}${ext}`);
    } catch {
      // 파일이 없으면 이 경로 사용
      return newPath;
    }
  }
}

/**
 * K8s 리소스 스키마 검증 (기본 검증)
 * @param doc - 파싱된 YAML 문서
 * @returns 검증 오류 배열
 */
function validateK8sResource(doc: unknown): YamlValidationError[] {
  const errors: YamlValidationError[] = [];

  if (!doc || typeof doc !== "object") {
    errors.push({
      type: "schema",
      message: "Document is not a valid object",
    });
    return errors;
  }

  const resource = doc as Record<string, unknown>;

  // apiVersion 필수
  if (!resource.apiVersion) {
    errors.push({
      type: "schema",
      message: "Missing required field: apiVersion",
      path: "apiVersion",
    });
  } else if (typeof resource.apiVersion !== "string") {
    errors.push({
      type: "schema",
      message: "apiVersion must be a string",
      path: "apiVersion",
    });
  }

  // kind 필수
  if (!resource.kind) {
    errors.push({
      type: "schema",
      message: "Missing required field: kind",
      path: "kind",
    });
  } else if (typeof resource.kind !== "string") {
    errors.push({
      type: "schema",
      message: "kind must be a string",
      path: "kind",
    });
  }

  // metadata 검증
  if (!resource.metadata) {
    errors.push({
      type: "schema",
      message: "Missing required field: metadata",
      path: "metadata",
    });
  } else if (typeof resource.metadata === "object" && resource.metadata !== null) {
    const metadata = resource.metadata as Record<string, unknown>;

    // name 또는 generateName 필요
    if (!metadata.name && !metadata.generateName) {
      errors.push({
        type: "schema",
        message: "metadata must have either 'name' or 'generateName'",
        path: "metadata.name",
      });
    }
  }

  return errors;
}

// ========== 🆕 Windows 경로 정규화 헬퍼 ==========

/**
 * Windows 백슬래시 경로를 슬래시 경로로 변환
 * Renderer가 슬래시 기반으로 경로를 조작하므로, IPC 반환값을 통일
 * @param p - 파일 경로 (Windows: 백슬래시, macOS/Linux: 슬래시)
 * @returns 슬래시로 정규화된 경로
 */
function toForwardSlashes(p: string): string {
  return process.platform === "win32" ? p.replace(/\\/g, "/") : p;
}

// ========== 🆕 Windows CF_HDROP 파싱/생성 헬퍼 ==========

/**
 * Windows CF_HDROP 바이너리 구조체 파싱
 * @param buffer - CF_HDROP 바이너리 데이터
 * @returns 파일 경로 배열
 */
function parseCFHDROP(buffer: Buffer): string[] {
  if (buffer.length < 20) return [];
  const pFiles = buffer.readUInt32LE(0);
  const fWide = buffer.readUInt32LE(16);
  const paths: string[] = [];
  let offset = pFiles;

  while (offset < buffer.length) {
    if (fWide) {
      // UTF-16LE: 2바이트 null terminator 검색
      let end = offset;
      while (end + 1 < buffer.length) {
        if (buffer[end] === 0 && buffer[end + 1] === 0) break;
        end += 2;
      }
      if (end <= offset) break;
      const str = buffer.subarray(offset, end).toString("utf16le");
      if (str.length > 0) paths.push(str);
      offset = end + 2;
    } else {
      // ASCII: 1바이트 null terminator 검색
      const end = buffer.indexOf(0, offset);
      if (end <= offset) break;
      const str = buffer.subarray(offset, end).toString("ascii");
      if (str.length > 0) paths.push(str);
      offset = end + 1;
    }
  }
  return paths;
}

/**
 * Windows CF_HDROP 바이너리 구조체 생성
 * @param filePaths - 파일 경로 배열
 * @returns CF_HDROP 바이너리 데이터
 */
function createCFHDROP(filePaths: string[]): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32LE(20, 0); // pFiles offset
  header.writeUInt32LE(0, 4); // pt.x
  header.writeUInt32LE(0, 8); // pt.y
  header.writeUInt32LE(0, 12); // fNC
  header.writeUInt32LE(1, 16); // fWide = true (UTF-16)
  const payload = Buffer.concat([
    ...filePaths.map((p) => Buffer.from(p + "\0", "utf16le")),
    Buffer.from("\0", "utf16le"), // double-null terminator
  ]);
  return Buffer.concat([header, payload]);
}

/**
 * 디렉토리 재귀 복사 헬퍼 함수
 * @param source - 원본 디렉토리 경로
 * @param dest - 대상 디렉토리 경로
 */
async function copyDirectory(source: string, dest: string): Promise<void> {
  // 대상 디렉토리 생성
  await fs.mkdir(dest, { recursive: true });

  // 원본 디렉토리 내용 읽기
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // 재귀적으로 하위 디렉토리 복사
      await copyDirectory(sourcePath, destPath);
    } else {
      // 파일 복사
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

/**
 * 파일 시스템 IPC 핸들러 등록
 * @param logger - 로거 인스턴스 (선택)
 */
export function registerFileSystemIpcHandlers(logger: Logger = defaultLogger): void {
  logger.info("Registering file system IPC handlers...");

  // 🆕 FIX-041: Watcher 매니저 초기화
  watcherManager = new FileSystemWatcherManager(logger);

  /**
   * fs:readFile - 파일 내용 읽기
   */
  ipcMain.handle(
    fileSystemChannels.readFile,
    async (_event, filePath: string, encoding: BufferEncoding = "utf-8"): Promise<ReadFileResponse> => {
      try {
        logger.debug(`Reading file: ${filePath}`);

        // 경로 정규화
        const normalizedPath = path.normalize(filePath);

        // 민감 파일 경고 (차단하지는 않음)
        if (isSensitiveFile(normalizedPath)) {
          logger.warn(`Reading sensitive file: ${normalizedPath}`);
        }

        // 파일 정보 확인
        const stats = await fs.stat(normalizedPath);

        if (stats.isDirectory()) {
          return {
            success: false,
            error: "Cannot read directory as file",
          };
        }

        // 파일 크기 검사
        const sizeCheck = checkFileSize(stats.size);
        if (sizeCheck === "blocked") {
          return {
            success: false,
            error: `File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${FILE_SIZE_LIMITS.MAX / 1024 / 1024}MB`,
            size: stats.size,
          };
        }

        // 파일 읽기
        const content = await fs.readFile(normalizedPath, { encoding });

        return {
          success: true,
          content,
          size: stats.size,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to read file: ${filePath}`, error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  /**
   * fs:writeFile - 파일 저장
   */
  ipcMain.handle(
    fileSystemChannels.writeFile,
    async (
      _event,
      filePath: string,
      content: string,
      encoding: BufferEncoding = "utf-8",
    ): Promise<WriteFileResponse> => {
      try {
        logger.debug(`Writing file: ${filePath}`);

        // 경로 정규화
        const normalizedPath = path.normalize(filePath);

        // 민감 파일 경고 (차단하지는 않음)
        if (isSensitiveFile(normalizedPath)) {
          logger.warn(`Writing to sensitive file: ${normalizedPath}`);
        }

        // 디렉토리 존재 확인 및 생성
        const dir = path.dirname(normalizedPath);
        await fs.mkdir(dir, { recursive: true });

        // 파일 저장
        await fs.writeFile(normalizedPath, content, { encoding });

        logger.info(`File saved: ${normalizedPath}`);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to write file: ${filePath}`, error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  /**
   * fs:readDir - 디렉토리 목록 조회
   * 🆕 FIX-042: 병렬 처리 + 타임아웃 적용 (macOS TCC 보호 폴더 hang 방지)
   */
  ipcMain.handle(fileSystemChannels.readDir, async (_event, dirPath: string): Promise<DirectoryEntry[]> => {
    try {
      logger.debug(`Reading directory: ${dirPath}`);

      // 경로 정규화
      const normalizedPath = path.normalize(dirPath);

      // 디렉토리 내용 읽기
      const entries = await fs.readdir(normalizedPath, { withFileTypes: true });

      // 🆕 FIX-042: 병렬 처리 + 타임아웃 적용 (macOS TCC 보호 폴더 hang 방지)
      const STAT_TIMEOUT = 500; // 500ms 타임아웃

      const statPromises = entries.map(async (entry) => {
        const entryPath = path.join(normalizedPath, entry.name);
        try {
          const stats = await Promise.race([
            fs.stat(entryPath),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("stat timeout")), STAT_TIMEOUT)),
          ]);
          return {
            name: entry.name,
            path: toForwardSlashes(entryPath),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modifiedAt: stats.mtimeMs,
          };
        } catch {
          // 타임아웃 또는 권한 에러 → 기본값으로 반환 (파일 접근은 여전히 가능)
          return {
            name: entry.name,
            path: toForwardSlashes(entryPath),
            isDirectory: entry.isDirectory(),
          };
        }
      });

      const result = await Promise.all(statPromises);
      return result;
    } catch (error) {
      logger.error(`Failed to read directory: ${dirPath}`, error);
      throw error;
    }
  });

  /**
   * fs:stat - 파일/디렉토리 정보 조회
   */
  ipcMain.handle(fileSystemChannels.stat, async (_event, filePath: string): Promise<FileStatInfo | null> => {
    try {
      logger.debug(`Getting stat: ${filePath}`);

      const normalizedPath = path.normalize(filePath);
      const stats = await fs.stat(normalizedPath);

      return {
        path: toForwardSlashes(normalizedPath),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        createdAt: stats.birthtimeMs,
        modifiedAt: stats.mtimeMs,
        accessedAt: stats.atimeMs,
      };
    } catch (error) {
      logger.error(`Failed to get stat: ${filePath}`, error);
      return null;
    }
  });

  /**
   * fs:exists - 파일/디렉토리 존재 여부 확인
   */
  ipcMain.handle(fileSystemChannels.exists, async (_event, filePath: string): Promise<boolean> => {
    try {
      const normalizedPath = path.normalize(filePath);
      await fs.access(normalizedPath);
      return true;
    } catch {
      return false;
    }
  });

  /**
   * 🆕 FIX-038: fs:getHomePath - 홈 디렉토리 경로 조회
   * 📝 Windows, Mac, Linux 모두 지원
   */
  ipcMain.handle(fileSystemChannels.getHomePath, async (): Promise<string> => {
    const homePath = os.homedir();
    logger.debug(`Getting home path: ${homePath}`);
    return toForwardSlashes(homePath);
  });

  /**
   * 🆕 FIX-041: fs:watch - 폴더 감시 시작
   * 📝 Chokidar를 사용하여 파일 변경 감지
   * 📝 변경 발생 시 fs:fileChanged 이벤트로 Renderer에 알림
   */
  ipcMain.handle(
    fileSystemChannels.watch,
    async (_event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        logger.debug(`Starting watch for: ${folderPath}`);

        const normalizedPath = path.normalize(folderPath);

        // 폴더 존재 여부 확인
        const stats = await fs.stat(normalizedPath);
        if (!stats.isDirectory()) {
          return {
            success: false,
            error: "Path is not a directory",
          };
        }

        // Watcher 시작
        watcherManager?.startWatching(normalizedPath);

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to start watch: ${folderPath}`, error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  /**
   * 🆕 FIX-041: fs:unwatch - 폴더 감시 중지
   */
  ipcMain.handle(fileSystemChannels.unwatch, async (): Promise<{ success: boolean }> => {
    logger.debug("Stopping folder watch");
    watcherManager?.stopWatching();
    return { success: true };
  });

  /**
   * fs:searchContent - 파일 내용 검색
   */
  ipcMain.handle(
    fileSystemChannels.searchContent,
    async (_event, request: SearchContentRequest): Promise<SearchContentResponse> => {
      const startTime = Date.now();
      const {
        rootPath,
        query,
        caseSensitive = false,
        useRegex = false,
        excludePatterns = [],
        maxResults = 100,
      } = request;

      try {
        logger.debug(`Searching content in: ${rootPath}, query: ${query}`);

        if (!query.trim()) {
          return {
            success: true,
            matches: [],
            totalMatches: 0,
            filesSearched: 0,
            elapsedMs: Date.now() - startTime,
          };
        }

        const matches: SearchMatch[] = [];
        let filesSearched = 0;
        let totalMatches = 0;

        // 검색 패턴 생성
        let searchPattern: RegExp;
        try {
          if (useRegex) {
            searchPattern = new RegExp(query, caseSensitive ? "g" : "gi");
          } else {
            // 특수 문자 이스케이프
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            searchPattern = new RegExp(escapedQuery, caseSensitive ? "g" : "gi");
          }
        } catch (regexError) {
          return {
            success: false,
            matches: [],
            totalMatches: 0,
            filesSearched: 0,
            error: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : "Unknown error"}`,
          };
        }

        // 제외 패턴을 정규식으로 변환
        const excludeRegexes = excludePatterns.map((pattern) => {
          // 간단한 glob -> regex 변환
          const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");
          return new RegExp(regexPattern);
        });

        // 기본 제외 패턴
        const defaultExcludes = [/node_modules/, /\.git/, /dist/, /build/, /\.next/, /coverage/, /\.DS_Store/];

        /**
         * 파일이 검색 대상인지 확인
         */
        const shouldSearchFile = (filePath: string): boolean => {
          // 기본 제외 패턴 확인
          if (defaultExcludes.some((regex) => regex.test(filePath))) {
            return false;
          }
          // 사용자 제외 패턴 확인
          if (excludeRegexes.some((regex) => regex.test(filePath))) {
            return false;
          }
          // 바이너리 파일 제외 (확장자 기반)
          const binaryExtensions = [
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".ico",
            ".webp",
            ".pdf",
            ".zip",
            ".tar",
            ".gz",
            ".rar",
            ".exe",
            ".dll",
            ".so",
            ".dylib",
            ".woff",
            ".woff2",
            ".ttf",
            ".eot",
            ".mp3",
            ".mp4",
            ".wav",
            ".avi",
            ".mov",
          ];
          const ext = path.extname(filePath).toLowerCase();
          if (binaryExtensions.includes(ext)) {
            return false;
          }
          return true;
        };

        /**
         * 파일 내용 검색
         */
        const searchFile = async (filePath: string): Promise<void> => {
          if (matches.length >= maxResults) {
            return;
          }

          try {
            const stats = await fs.stat(filePath);

            // 너무 큰 파일은 건너뜀 (1MB 이상)
            if (stats.size > 1024 * 1024) {
              return;
            }

            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split("\n");
            filesSearched++;

            for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
              const line = lines[i];
              searchPattern.lastIndex = 0; // Reset regex state

              let match: RegExpExecArray | null;
              while ((match = searchPattern.exec(line)) !== null && matches.length < maxResults) {
                totalMatches++;
                matches.push({
                  filePath: toForwardSlashes(filePath),
                  lineNumber: i + 1,
                  lineContent: line.substring(0, 500), // 라인 길이 제한
                  matchStart: match.index,
                  matchEnd: match.index + match[0].length,
                });

                // 같은 라인에서 여러 매치 방지 (첫 번째만)
                if (!useRegex) {
                  break;
                }
              }
            }
          } catch {
            // 파일 읽기 실패는 무시
          }
        };

        /**
         * 디렉토리 재귀 탐색
         */
        const searchDirectory = async (dirPath: string): Promise<void> => {
          if (matches.length >= maxResults) {
            return;
          }

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
              if (matches.length >= maxResults) {
                break;
              }

              const entryPath = path.join(dirPath, entry.name);

              if (!shouldSearchFile(entryPath)) {
                continue;
              }

              if (entry.isDirectory()) {
                await searchDirectory(entryPath);
              } else if (entry.isFile()) {
                await searchFile(entryPath);
              }
            }
          } catch {
            // 디렉토리 읽기 실패는 무시
          }
        };

        // 검색 실행
        await searchDirectory(path.normalize(rootPath));

        logger.info(
          `Search completed: ${totalMatches} matches in ${filesSearched} files (${Date.now() - startTime}ms)`,
        );

        return {
          success: true,
          matches,
          totalMatches,
          filesSearched,
          elapsedMs: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Search failed: ${errorMessage}`, error);
        return {
          success: false,
          matches: [],
          totalMatches: 0,
          filesSearched: 0,
          error: errorMessage,
          elapsedMs: Date.now() - startTime,
        };
      }
    },
  );

  /**
   * fs:createFile - 새 파일 생성
   */
  ipcMain.handle(
    fileSystemChannels.createFile,
    async (_event, filePath: string, content: string = ""): Promise<WriteFileResponse> => {
      try {
        logger.debug(`Creating file: ${filePath}`);

        const normalizedPath = path.normalize(filePath);

        // 파일이 이미 존재하는지 확인
        try {
          await fs.access(normalizedPath);
          return {
            success: false,
            error: "File already exists",
          };
        } catch {
          // 파일이 없으면 생성 가능
        }

        // 부모 디렉토리 생성
        const dir = path.dirname(normalizedPath);
        await fs.mkdir(dir, { recursive: true });

        // 파일 생성
        await fs.writeFile(normalizedPath, content, { encoding: "utf-8" });

        logger.info(`File created: ${normalizedPath}`);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to create file: ${filePath}`, error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  /**
   * fs:createDir - 새 폴더 생성
   */
  ipcMain.handle(fileSystemChannels.createDir, async (_event, dirPath: string): Promise<WriteFileResponse> => {
    try {
      logger.debug(`Creating directory: ${dirPath}`);

      const normalizedPath = path.normalize(dirPath);

      // 디렉토리가 이미 존재하는지 확인
      try {
        const stats = await fs.stat(normalizedPath);
        if (stats.isDirectory()) {
          return {
            success: false,
            error: "Directory already exists",
          };
        }
        return {
          success: false,
          error: "A file with this name already exists",
        };
      } catch {
        // 존재하지 않으면 생성 가능
      }

      // 디렉토리 생성
      await fs.mkdir(normalizedPath, { recursive: true });

      logger.info(`Directory created: ${normalizedPath}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to create directory: ${dirPath}`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  /**
   * fs:delete - 파일/폴더 삭제
   */
  ipcMain.handle(fileSystemChannels.delete, async (_event, targetPath: string): Promise<WriteFileResponse> => {
    try {
      logger.debug(`Deleting: ${targetPath}`);

      const normalizedPath = path.normalize(targetPath);

      // 존재 여부 확인
      const stats = await fs.stat(normalizedPath);

      if (stats.isDirectory()) {
        // 디렉토리 삭제 (재귀적)
        await fs.rm(normalizedPath, { recursive: true, force: true });
        logger.info(`Directory deleted: ${normalizedPath}`);
      } else {
        // 파일 삭제
        await fs.unlink(normalizedPath);
        logger.info(`File deleted: ${normalizedPath}`);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to delete: ${targetPath}`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  /**
   * fs:rename - 파일/폴더 이름 변경
   */
  ipcMain.handle(
    fileSystemChannels.rename,
    async (_event, oldPath: string, newPath: string): Promise<WriteFileResponse> => {
      try {
        logger.debug(`Renaming: ${oldPath} -> ${newPath}`);

        const normalizedOldPath = path.normalize(oldPath);
        const normalizedNewPath = path.normalize(newPath);

        // 원본 존재 여부 확인
        await fs.access(normalizedOldPath);

        // 대상 경로에 이미 파일/폴더가 있는지 확인
        try {
          await fs.access(normalizedNewPath);
          return {
            success: false,
            error: "A file or folder with this name already exists",
          };
        } catch {
          // 존재하지 않으면 이름 변경 가능
        }

        // 이름 변경
        await fs.rename(normalizedOldPath, normalizedNewPath);

        logger.info(`Renamed: ${normalizedOldPath} -> ${normalizedNewPath}`);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to rename: ${oldPath}`, error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  /**
   * fs:copy - 파일/폴더 복사
   */
  ipcMain.handle(
    fileSystemChannels.copy,
    async (_event, sourcePath: string, destPath: string): Promise<WriteFileResponse> => {
      try {
        logger.debug(`Copying: ${sourcePath} -> ${destPath}`);

        const normalizedSource = path.normalize(sourcePath);
        const normalizedDest = path.normalize(destPath);

        // 원본 존재 여부 확인
        const stats = await fs.stat(normalizedSource);

        // 대상 부모 디렉토리 생성
        const destDir = path.dirname(normalizedDest);
        await fs.mkdir(destDir, { recursive: true });

        if (stats.isDirectory()) {
          // 디렉토리 복사 (재귀적)
          await copyDirectory(normalizedSource, normalizedDest);
          logger.info(`Directory copied: ${normalizedSource} -> ${normalizedDest}`);
        } else {
          // 파일 복사
          await fs.copyFile(normalizedSource, normalizedDest);
          logger.info(`File copied: ${normalizedSource} -> ${normalizedDest}`);
        }

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to copy: ${sourcePath}`, error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  /**
   * fs:revealInExplorer - 시스템 파일 탐색기에서 파일/폴더 표시
   */
  ipcMain.handle(fileSystemChannels.revealInExplorer, async (_event, filePath: string): Promise<WriteFileResponse> => {
    try {
      logger.debug(`Revealing in explorer: ${filePath}`);

      const normalizedPath = path.normalize(filePath);

      // 존재 여부 확인
      await fs.access(normalizedPath);

      // 시스템 파일 탐색기에서 표시
      shell.showItemInFolder(normalizedPath);

      logger.info(`Revealed in explorer: ${normalizedPath}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to reveal in explorer: ${filePath}`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  /**
   * fs:duplicate - 파일/폴더 복제
   */
  ipcMain.handle(fileSystemChannels.duplicate, async (_event, filePath: string): Promise<DuplicateResponse> => {
    try {
      logger.debug(`Duplicating: ${filePath}`);

      const normalizedPath = path.normalize(filePath);

      // 원본 존재 여부 확인
      const stats = await fs.stat(normalizedPath);

      // 복제 경로 생성
      const newPath = await generateDuplicatePath(normalizedPath);

      if (stats.isDirectory()) {
        // 디렉토리 복제
        await copyDirectory(normalizedPath, newPath);
        logger.info(`Directory duplicated: ${normalizedPath} -> ${newPath}`);
      } else {
        // 파일 복제
        await fs.copyFile(normalizedPath, newPath);
        logger.info(`File duplicated: ${normalizedPath} -> ${newPath}`);
      }

      return { success: true, newPath: toForwardSlashes(newPath) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to duplicate: ${filePath}`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  /**
   * fs:getFileInfo - 파일 상세 정보 조회
   */
  ipcMain.handle(fileSystemChannels.getFileInfo, async (_event, filePath: string): Promise<FileInfoResponse> => {
    try {
      logger.debug(`Getting file info: ${filePath}`);

      const normalizedPath = path.normalize(filePath);
      const stats = await fs.stat(normalizedPath);

      return {
        success: true,
        name: path.basename(normalizedPath),
        path: toForwardSlashes(normalizedPath),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        createdAt: new Date(stats.birthtime).toISOString(),
        modifiedAt: new Date(stats.mtime).toISOString(),
        accessedAt: new Date(stats.atime).toISOString(),
        permissions: formatPermissions(stats.mode),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to get file info: ${filePath}`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  /**
   * fs:validateYaml - YAML 파일 검증 (K8s 스키마 포함)
   */
  ipcMain.handle(
    fileSystemChannels.validateYaml,
    async (_event, request: ValidateYamlRequest): Promise<ValidateYamlResponse> => {
      const { filePath, validateK8sSchema = true } = request;

      try {
        logger.debug(`Validating YAML: ${filePath}`);

        const normalizedPath = path.normalize(filePath);
        const content = await fs.readFile(normalizedPath, "utf-8");

        const errors: YamlValidationError[] = [];
        let resourceKind: string | undefined;
        let apiVersion: string | undefined;

        try {
          // YAML 구문 분석
          const documents = yaml.parseAllDocuments(content);

          for (const doc of documents) {
            // 구문 오류 확인
            if (doc.errors.length > 0) {
              for (const err of doc.errors) {
                errors.push({
                  type: "syntax",
                  message: err.message,
                  line: err.linePos?.[0]?.line,
                  column: err.linePos?.[0]?.col,
                });
              }
            }

            // K8s 스키마 검증
            if (validateK8sSchema && doc.errors.length === 0) {
              const parsed = doc.toJSON();
              if (parsed) {
                const schemaErrors = validateK8sResource(parsed);
                errors.push(...schemaErrors);

                // 리소스 정보 추출
                if (typeof parsed === "object" && parsed !== null) {
                  const resource = parsed as Record<string, unknown>;
                  if (typeof resource.kind === "string") {
                    resourceKind = resource.kind;
                  }
                  if (typeof resource.apiVersion === "string") {
                    apiVersion = resource.apiVersion;
                  }
                }
              }
            }
          }

          logger.info(`YAML validation completed: ${filePath}, ${errors.length} errors`);

          return {
            success: true,
            isValid: errors.length === 0,
            errors,
            resourceKind,
            apiVersion,
          };
        } catch (parseError) {
          // YAML 파싱 실패
          const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parse error";
          errors.push({
            type: "syntax",
            message: errorMessage,
          });

          return {
            success: true,
            isValid: false,
            errors,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to validate YAML: ${filePath}`, error);
        return {
          success: false,
          isValid: false,
          errors: [],
          error: errorMessage,
        };
      }
    },
  );

  /**
   * 🆕 fs:move - 파일/폴더 이동 (드래그 앤 드롭)
   * 📝 1차: fs.rename() (같은 파일시스템 내 atomic move)
   * 📝 2차: EXDEV 에러 시 copy + delete fallback (크로스 파일시스템)
   */
  ipcMain.handle(
    fileSystemChannels.move,
    async (
      _event,
      sourcePath: string,
      destPath: string,
      overwrite = false,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        logger.debug(`Moving: ${sourcePath} -> ${destPath}`);

        const normalizedSource = path.normalize(sourcePath);
        const normalizedDest = path.normalize(destPath);

        // 원본 존재 여부 확인
        await fs.access(normalizedSource);

        // 대상 경로에 파일/폴더 존재 여부 확인
        try {
          await fs.access(normalizedDest);
          if (!overwrite) {
            return { success: false, error: "DEST_EXISTS" };
          }
          // overwrite=true: 기존 파일/폴더 삭제
          const destStats = await fs.stat(normalizedDest);
          if (destStats.isDirectory()) {
            await fs.rm(normalizedDest, { recursive: true, force: true });
          } else {
            await fs.unlink(normalizedDest);
          }
        } catch {
          // 대상이 없으면 이동 가능
        }

        // 대상 부모 디렉토리 존재 확인
        const destDir = path.dirname(normalizedDest);
        await fs.mkdir(destDir, { recursive: true });

        try {
          // 1차: atomic rename
          await fs.rename(normalizedSource, normalizedDest);
        } catch (renameError) {
          // 2차: EXDEV (크로스 파일시스템) → copy + delete fallback
          if ((renameError as NodeJS.ErrnoException).code === "EXDEV") {
            logger.info(`Cross-filesystem move detected, using copy+delete: ${sourcePath}`);
            const sourceStats = await fs.stat(normalizedSource);
            if (sourceStats.isDirectory()) {
              await copyDirectory(normalizedSource, normalizedDest);
            } else {
              await fs.copyFile(normalizedSource, normalizedDest);
            }
            await fs.rm(normalizedSource, { recursive: true, force: true });
          } else {
            throw renameError;
          }
        }

        logger.info(`Moved: ${normalizedSource} -> ${normalizedDest}`);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to move: ${sourcePath} -> ${destPath}`, error);
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * 🆕 fs:startDrag - 네이티브 OS 드래그 시작
   * 📝 Electron의 webContents.startDrag() API 사용
   * 📝 앱에서 OS 파일 탐색기/바탕화면으로 파일 드래그
   */
  ipcMain.handle(fileSystemChannels.startDrag, async (event, filePath: string): Promise<void> => {
    try {
      logger.debug(`Starting native drag: ${filePath}`);

      const normalizedPath = path.normalize(filePath);

      // 파일 존재 확인
      await fs.access(normalizedPath);

      // 네이티브 파일 아이콘 획득
      const icon = await app.getFileIcon(normalizedPath);

      // OS 드래그 시작
      event.sender.startDrag({
        file: normalizedPath,
        icon,
      });

      logger.info(`Started native drag: ${normalizedPath}`);
    } catch (error) {
      logger.error(`Failed to start native drag: ${filePath}`, error);
    }
  });

  // ========== 🆕 OS 클립보드 파일 읽기/쓰기 ==========

  /**
   * fs:clipboard:readFiles - OS 클립보드에서 파일 경로 읽기 (External → Internal)
   *
   * macOS 전략 (순서대로 시도):
   *   1. clipboard.read('NSFilenamesPboardType') → plist XML 문자열 파싱
   *   2. clipboard.read('public.file-url') → file:// URL 파싱
   *   3. osascript 폴백 → AppleScript로 클립보드 파일 직접 읽기
   *
   * 📝 clipboard.read() vs readBuffer():
   *   - read()  = NSPasteboard.stringForType: (macOS가 bplist→string 자동 변환 시도)
   *   - readBuffer() = NSPasteboard.dataForType: (raw 바이너리)
   *   - NSFilenamesPboardType은 bplist 형식 → read()가 빈 문자열 반환할 수 있음
   *   - 이 경우 osascript 폴백으로 처리
   */
  ipcMain.handle(
    fileSystemChannels.clipboardReadFiles,
    async (): Promise<{ success: boolean; filePaths: string[] }> => {
      try {
        const formats = clipboard.availableFormats();
        logger.info(`[Clipboard:Read] Available formats: ${JSON.stringify(formats)}`);

        if (process.platform === "darwin") {
          // === Strategy 1: NSFilenamesPboardType (Electron clipboard.read) ===
          if (formats.includes("NSFilenamesPboardType")) {
            try {
              const plistStr = clipboard.read("NSFilenamesPboardType");
              logger.info(
                `[Clipboard:Read] NSFilenamesPboardType via read(): length=${plistStr?.length || 0}, first100=${JSON.stringify(plistStr?.substring(0, 100))}`,
              );

              if (plistStr && plistStr.length > 0) {
                // plist XML에서 <string>...</string> 추출
                const stringMatches = plistStr.match(/<string>(.*?)<\/string>/g);
                if (stringMatches && stringMatches.length > 0) {
                  const paths = stringMatches
                    .map((m) => m.replace(/<\/?string>/g, ""))
                    .map((p) => p.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
                    .filter((p) => p.startsWith("/"));
                  if (paths.length > 0) {
                    logger.info(`[Clipboard:Read] SUCCESS via NSFilenamesPboardType plist: ${paths.join(", ")}`);
                    return { success: true, filePaths: paths };
                  }
                }
                // 줄바꿈 구분 폴백
                const lines = plistStr
                  .split("\n")
                  .map((l) => l.trim())
                  .filter((l) => l.startsWith("/"));
                if (lines.length > 0) {
                  logger.info(`[Clipboard:Read] SUCCESS via NSFilenamesPboardType lines: ${lines.join(", ")}`);
                  return { success: true, filePaths: lines };
                }
                logger.warn(`[Clipboard:Read] NSFilenamesPboardType had data but no paths extracted`);
              } else {
                logger.warn(`[Clipboard:Read] NSFilenamesPboardType via read() returned empty`);
              }
            } catch (parseErr) {
              logger.warn(`[Clipboard:Read] NSFilenamesPboardType read() failed: ${parseErr}`);
            }

            // NSFilenamesPboardType이 있지만 read()가 실패한 경우 → readBuffer 시도
            try {
              const buf = clipboard.readBuffer("NSFilenamesPboardType");
              logger.info(
                `[Clipboard:Read] NSFilenamesPboardType via readBuffer(): ${buf.length} bytes, hex(first20)=${buf.subarray(0, 20).toString("hex")}`,
              );
              if (buf.length > 0) {
                // bplist00 magic check
                const magic = buf.subarray(0, 6).toString("ascii");
                if (magic === "bplis") {
                  logger.info(`[Clipboard:Read] Detected binary plist, trying regex extraction`);
                  // Binary plist에서 파일 경로 추출 (UTF-8 내 절대경로 패턴)
                  const rawText = buf.toString("utf8");
                  const pathRegex =
                    /\/(Users|Volumes|tmp|private|var|etc|opt|home|Applications|Library|System)[^\x00-\x1f]*/g;
                  const rawMatches = rawText.match(pathRegex);
                  if (rawMatches && rawMatches.length > 0) {
                    // 경로 정리: null 바이트 이후 제거
                    const cleanPaths = rawMatches
                      .map((p) => {
                        const nullIdx = p.indexOf("\x00");
                        return nullIdx >= 0 ? p.substring(0, nullIdx) : p;
                      })
                      .filter((p) => p.length > 1);
                    if (cleanPaths.length > 0) {
                      logger.info(`[Clipboard:Read] SUCCESS via bplist regex: ${cleanPaths.join(", ")}`);
                      return { success: true, filePaths: cleanPaths };
                    }
                  }
                }
                // XML plist in buffer
                const bufStr = buf.toString("utf8");
                const xmlMatches = bufStr.match(/<string>(.*?)<\/string>/g);
                if (xmlMatches) {
                  const paths = xmlMatches.map((m) => m.replace(/<\/?string>/g, "")).filter((p) => p.startsWith("/"));
                  if (paths.length > 0) {
                    logger.info(`[Clipboard:Read] SUCCESS via readBuffer XML plist: ${paths.join(", ")}`);
                    return { success: true, filePaths: paths };
                  }
                }
              }
            } catch (bufErr) {
              logger.warn(`[Clipboard:Read] NSFilenamesPboardType readBuffer() failed: ${bufErr}`);
            }
          }

          // === Strategy 2: public.file-url (단일 파일) ===
          if (formats.includes("public.file-url")) {
            try {
              const url = clipboard.read("public.file-url");
              logger.info(`[Clipboard:Read] public.file-url via read(): ${JSON.stringify(url?.substring(0, 200))}`);
              if (url && url.startsWith("file://")) {
                const filePath = decodeURIComponent(new URL(url).pathname);
                logger.info(`[Clipboard:Read] SUCCESS via public.file-url: ${filePath}`);
                return { success: true, filePaths: [filePath] };
              }
            } catch (urlErr) {
              logger.warn(`[Clipboard:Read] public.file-url failed: ${urlErr}`);
            }
          }

          // === Strategy 3: osascript 폴백 (macOS 네이티브) ===
          // Electron clipboard API가 모두 실패한 경우, AppleScript로 직접 읽기
          // execFileAsync로 비동기 실행 (main process 블로킹 방지)
          logger.info(`[Clipboard:Read] Electron API failed, trying osascript fallback...`);
          try {
            const { stdout } = await execFileAsync(
              "osascript",
              [
                "-e",
                "try",
                "-e",
                "  set theFiles to the clipboard as \u00ABclass furl\u00BB",
                "-e",
                "  if class of theFiles is list then",
                "-e",
                '    set output to ""',
                "-e",
                "    repeat with f in theFiles",
                "-e",
                "      set output to output & POSIX path of f & linefeed",
                "-e",
                "    end repeat",
                "-e",
                "    return output",
                "-e",
                "  else",
                "-e",
                "    return POSIX path of theFiles",
                "-e",
                "  end if",
                "-e",
                "on error errMsg",
                "-e",
                '  return ""',
                "-e",
                "end try",
              ],
              { encoding: "utf8", timeout: 3000 },
            );

            const osaPaths = stdout
              .trim()
              .split("\n")
              .filter((p) => p.length > 0 && p.startsWith("/"));
            if (osaPaths.length > 0) {
              logger.info(`[Clipboard:Read] SUCCESS via osascript: ${osaPaths.join(", ")}`);
              return { success: true, filePaths: osaPaths };
            }
            logger.info(
              `[Clipboard:Read] osascript returned no file paths (stdout: ${JSON.stringify(stdout.substring(0, 100))})`,
            );
          } catch (osaErr) {
            logger.warn(`[Clipboard:Read] osascript fallback failed: ${osaErr}`);
          }
        } else if (process.platform === "linux") {
          // Linux: text/uri-list
          const uriListFormat = formats.find((f) => f.includes("uri-list"));
          if (uriListFormat) {
            try {
              const buffer = clipboard.readBuffer(uriListFormat);
              const text = buffer.toString("utf8");
              const paths = text
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.startsWith("file://"))
                .map((l) => decodeURIComponent(new URL(l).pathname));
              if (paths.length > 0) {
                logger.info(`[Clipboard:Read] Read ${paths.length} file paths from text/uri-list`);
                return { success: true, filePaths: paths };
              }
            } catch (uriErr) {
              logger.warn(`[Clipboard:Read] Failed to parse text/uri-list: ${uriErr}`);
            }
          }
        } else if (process.platform === "win32") {
          // Windows: clipboard-files 네이티브 애드온 사용 (Electron clipboard API의 CF_HDROP 매핑 버그 우회)
          if (clipboardFiles) {
            try {
              const rawPaths = clipboardFiles.readFiles();
              if (rawPaths && rawPaths.length > 0) {
                const paths = rawPaths.map(toForwardSlashes);
                logger.info(`[Clipboard:Read] Read ${paths.length} file paths via clipboard-files`);
                return { success: true, filePaths: paths };
              }
            } catch (nativeErr) {
              logger.warn(`[Clipboard:Read] clipboard-files readFiles() failed: ${nativeErr}`);
            }
          }
          // 폴백: PowerShell Get-Clipboard (Electron clipboard API의 CF_HDROP/text/uri-list 버그 우회)
          try {
            const { stdout } = await execFileAsync(
              "powershell.exe",
              ["-NoProfile", "-Command", "Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }"],
              { encoding: "utf8", timeout: 5000 },
            );
            const psPaths = stdout.trim().split(/\r?\n/).filter(Boolean).map(toForwardSlashes);
            if (psPaths.length > 0) {
              logger.info(`[Clipboard:Read] Read ${psPaths.length} file paths via PowerShell`);
              return { success: true, filePaths: psPaths };
            }
          } catch (psErr) {
            logger.warn(`[Clipboard:Read] PowerShell fallback failed: ${psErr}`);
          }
        }

        logger.info(`[Clipboard:Read] No file paths found in clipboard`);
        return { success: false, filePaths: [] };
      } catch (error) {
        logger.error(`[Clipboard:Read] Failed to read files from clipboard`, error);
        return { success: false, filePaths: [] };
      }
    },
  );

  /**
   * fs:clipboard:writeFiles - OS 클립보드에 파일 경로 쓰기 (Internal → External)
   * 📝 macOS: NSFilenamesPboardType (bplist)
   * 📝 Linux: text/uri-list
   * 📝 Windows: CF_HDROP
   * 📝 FIX: setImmediate로 클립보드 쓰기를 지연하여 IPC 응답을 즉시 반환
   *    clipboard.writeBuffer가 main process 이벤트 루프를 블로킹하는 문제 방지
   */
  ipcMain.handle(
    fileSystemChannels.clipboardWriteFiles,
    async (_event, filePaths: string[]): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!filePaths || filePaths.length === 0) {
          return { success: false, error: "No file paths provided" };
        }

        if (process.platform === "darwin") {
          // macOS: setImmediate로 지연하여 IPC 응답을 먼저 반환
          // clipboard.writeBuffer가 main process를 블로킹해도 다른 IPC에 영향 없음
          const pathsCopy = [...filePaths];
          setImmediate(() => {
            try {
              // XML plist 형식 사용 (bplist-creator 의존성 제거)
              // macOS NSPasteboard는 binary/XML plist 모두 지원
              const xmlPlist = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
                '<plist version="1.0">',
                "<array>",
                ...pathsCopy.map(
                  (p) => `<string>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</string>`,
                ),
                "</array>",
                "</plist>",
              ].join("\n");
              const buffer = Buffer.from(xmlPlist, "utf-8");

              clipboard.writeBuffer("NSFilenamesPboardType", buffer);
              logger.info(
                `[Clipboard] Wrote ${pathsCopy.length} file paths to NSFilenamesPboardType (XML plist, ${buffer.length} bytes)`,
              );
            } catch (err) {
              logger.error(`[Clipboard] Deferred macOS clipboard write failed`, err);
            }
          });
          return { success: true };
        } else if (process.platform === "linux") {
          // Linux: text/uri-list
          const uriList = filePaths.map((p) => `file://${encodeURIComponent(p).replace(/%2F/g, "/")}`).join("\n");
          clipboard.writeBuffer("text/uri-list", Buffer.from(uriList, "utf8"));
          logger.info(`[Clipboard] Wrote ${filePaths.length} file paths to text/uri-list`);
          return { success: true };
        } else if (process.platform === "win32") {
          const winPaths = filePaths.map((p) => p.replace(/\//g, "\\"));
          if (clipboardFiles) {
            // clipboard-files 네이티브 애드온 (Win32 API로 predefined CF_HDROP format ID 15에 직접 쓰기)
            clipboardFiles.writeFiles(winPaths);
            logger.info(`[Clipboard] Wrote ${filePaths.length} file paths via clipboard-files`);
          } else {
            // 폴백: PowerShell [System.Windows.Forms.Clipboard]::SetFileDropList()
            // Electron clipboard API는 CF_HDROP format ID 15가 아닌 커스텀 포맷 ID를 사용하여 Windows Explorer와 호환 불가
            const psCommand = [
              "Add-Type -AssemblyName System.Windows.Forms",
              `$files = New-Object System.Collections.Specialized.StringCollection`,
              ...winPaths.map((p) => `$files.Add('${p.replace(/'/g, "''")}')`),
              `[System.Windows.Forms.Clipboard]::SetFileDropList($files)`,
            ].join("; ");
            await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", psCommand], {
              encoding: "utf8",
              timeout: 5000,
            });
            logger.info(`[Clipboard] Wrote ${filePaths.length} file paths via PowerShell SetFileDropList`);
          }
          return { success: true };
        }

        return { success: false, error: "Unsupported platform" };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Clipboard] Failed to write files to clipboard`, error);
        return { success: false, error: errorMessage };
      }
    },
  );

  logger.info("File system IPC handlers registered successfully");
}

/**
 * 파일 시스템 IPC 핸들러 해제
 */
export function unregisterFileSystemIpcHandlers(): void {
  // 🆕 FIX-041: Watcher 정리
  watcherManager?.stopWatching();
  watcherManager = null;

  ipcMain.removeHandler(fileSystemChannels.readFile);
  ipcMain.removeHandler(fileSystemChannels.writeFile);
  ipcMain.removeHandler(fileSystemChannels.readDir);
  ipcMain.removeHandler(fileSystemChannels.stat);
  ipcMain.removeHandler(fileSystemChannels.exists);
  ipcMain.removeHandler(fileSystemChannels.getHomePath);
  ipcMain.removeHandler(fileSystemChannels.watch);
  ipcMain.removeHandler(fileSystemChannels.unwatch);
  ipcMain.removeHandler(fileSystemChannels.searchContent);
  ipcMain.removeHandler(fileSystemChannels.createFile);
  ipcMain.removeHandler(fileSystemChannels.createDir);
  ipcMain.removeHandler(fileSystemChannels.delete);
  ipcMain.removeHandler(fileSystemChannels.rename);
  ipcMain.removeHandler(fileSystemChannels.copy);
  ipcMain.removeHandler(fileSystemChannels.revealInExplorer);
  ipcMain.removeHandler(fileSystemChannels.duplicate);
  ipcMain.removeHandler(fileSystemChannels.getFileInfo);
  ipcMain.removeHandler(fileSystemChannels.validateYaml);
  ipcMain.removeHandler(fileSystemChannels.move);
  ipcMain.removeHandler(fileSystemChannels.startDrag);
  ipcMain.removeHandler(fileSystemChannels.clipboardReadFiles);
  ipcMain.removeHandler(fileSystemChannels.clipboardWriteFiles);
}
