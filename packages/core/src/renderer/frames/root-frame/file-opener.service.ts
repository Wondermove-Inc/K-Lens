/**
 * 🎯 목적: Root Frame에서 파일 열기 요청을 Cluster Frame으로 전송
 * 📝 기능:
 *   - IPC로 파일 읽기
 *   - postMessage로 Cluster Frame에 전달
 *   - 응답 대기 및 처리
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module root-frame/file-opener-service
 */

import { ipcRenderer } from "electron";
import { fileSystemChannels, type ReadFileResponse as IpcReadFileResponse } from "../../../common/ipc/filesystem";
import {
  generateRequestId,
  isChannel,
  type OpenFileRequest,
  type OpenFileResponse,
  postMessageChannels,
} from "../../../common/ipc/post-message";

import type { Logger } from "@skuberplus/logger";

/** 응답 대기 타임아웃 (ms) */
const RESPONSE_TIMEOUT = 10000;

/**
 * 파일 열기 결과
 */
export interface FileOpenResult {
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 열린 탭 ID */
  tabId?: string;
}

/**
 * Root Frame에서 파일을 열고 Cluster Frame으로 전달하는 서비스
 */
export class FileOpenerService {
  private logger: Logger;
  /** 활성 Cluster Frame의 iframe 요소 */
  private clusterFrame: HTMLIFrameElement | null = null;
  /** 응답 대기 중인 요청들 */
  private pendingRequests: Map<
    string,
    {
      resolve: (result: FileOpenResult) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.setupMessageListener();
  }

  /**
   * postMessage 응답 리스너 설정
   */
  private setupMessageListener(): void {
    window.addEventListener("message", this.handleMessage.bind(this));
  }

  /**
   * Cluster Frame으로부터의 응답 처리
   */
  private handleMessage(event: MessageEvent): void {
    // 응답 메시지인지 확인
    if (!isChannel<OpenFileResponse>(event.data, postMessageChannels.openFileResponse)) {
      return;
    }

    const response = event.data;
    const requestId = response.requestId;

    if (!requestId) {
      this.logger.warn("[FileOpenerService] Received response without requestId");
      return;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      this.logger.warn(`[FileOpenerService] No pending request for: ${requestId}`);
      return;
    }

    // 타임아웃 클리어
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    // 응답 resolve
    pending.resolve({
      success: response.success,
      error: response.error,
      tabId: response.tabId,
    });

    this.logger.debug(`[FileOpenerService] Received response for: ${requestId}`);
  }

  /**
   * Cluster Frame 설정
   * @param iframe - Cluster Frame의 iframe 요소
   */
  setClusterFrame(iframe: HTMLIFrameElement | null): void {
    this.clusterFrame = iframe;
  }

  /**
   * 파일 열기
   * @param filePath - 열 파일의 경로
   * @param readOnly - 읽기 전용 여부
   * @returns 파일 열기 결과
   */
  async openFile(filePath: string, readOnly = false): Promise<FileOpenResult> {
    this.logger.info(`[FileOpenerService] Opening file: ${filePath}`);

    // 1. Cluster Frame 확인
    if (!this.clusterFrame || !this.clusterFrame.contentWindow) {
      return {
        success: false,
        error: "No active cluster frame",
      };
    }

    // 2. IPC로 파일 읽기
    try {
      const response = (await ipcRenderer.invoke(fileSystemChannels.readFile, filePath)) as IpcReadFileResponse;

      if (!response.success) {
        return {
          success: false,
          error: response.error || "Failed to read file",
        };
      }

      // 3. postMessage로 Cluster Frame에 전달
      const requestId = generateRequestId();
      const message: OpenFileRequest = {
        channel: postMessageChannels.openFile,
        requestId,
        filePath,
        content: response.content || "",
        size: response.size || 0,
        readOnly,
      };

      // 4. 응답 대기 Promise 생성
      const resultPromise = new Promise<FileOpenResult>((resolve) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          resolve({
            success: false,
            error: "Request timeout",
          });
        }, RESPONSE_TIMEOUT);

        this.pendingRequests.set(requestId, { resolve, timeout });
      });

      // 5. postMessage 전송
      this.clusterFrame.contentWindow.postMessage(message, "*");
      this.logger.debug(`[FileOpenerService] Sent openFile request: ${requestId}`);

      return resultPromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`[FileOpenerService] Failed to open file: ${filePath}`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 서비스 정리
   */
  dispose(): void {
    window.removeEventListener("message", this.handleMessage.bind(this));

    // 모든 대기 중인 요청 정리
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.resolve({
        success: false,
        error: "Service disposed",
      });
    }
    this.pendingRequests.clear();
  }
}
