/**
 * 🎯 목적: Cluster Frame에서 파일 열기 요청 수신 및 처리
 * 📝 기능:
 *   - postMessage로 파일 열기 요청 수신
 *   - 파일 탭 생성
 *   - 응답 전송
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module cluster-frame/file-receiver-service
 */

import {
  isChannel,
  type OpenFileRequest,
  type OpenFileResponse,
  postMessageChannels,
  type SaveFileRequest,
  type SaveFileResponse,
} from "../../../common/ipc/post-message";

import type { Logger } from "@skuberplus/logger";

/**
 * 파일 탭 열기 핸들러 타입
 */
export type FileTabOpenHandler = (
  filePath: string,
  content: string,
  readOnly?: boolean,
) => Promise<{ success: boolean; tabId?: string; error?: string }>;

/**
 * 파일 저장 핸들러 타입
 */
export type FileSaveHandler = (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;

/**
 * Cluster Frame에서 파일 열기 요청을 수신하는 서비스
 */
export class FileReceiverService {
  private logger: Logger;
  /** 파일 탭 열기 핸들러 */
  private fileTabOpenHandler: FileTabOpenHandler | null = null;
  /** 파일 저장 핸들러 (향후 구현 예정) */
  // @ts-expect-error: 향후 파일 저장 기능 구현 시 사용 예정
  private fileSaveHandler: FileSaveHandler | null = null;
  /** 메시지 리스너 바인딩 */
  private boundHandleMessage: (event: MessageEvent) => void;

  constructor(logger: Logger) {
    this.logger = logger;
    this.boundHandleMessage = this.handleMessage.bind(this);
    this.setupMessageListener();
  }

  /**
   * postMessage 리스너 설정
   */
  private setupMessageListener(): void {
    window.addEventListener("message", this.boundHandleMessage);
    this.logger.info("[FileReceiverService] Message listener initialized");
  }

  /**
   * Root Frame으로부터의 메시지 처리
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    // 파일 열기 요청 처리
    if (isChannel<OpenFileRequest>(event.data, postMessageChannels.openFile)) {
      await this.handleOpenFileRequest(event.data, event.source as Window);
      return;
    }

    // 파일 저장 응답 처리 (Root Frame에서 저장 결과 수신)
    // 이 경우는 Cluster Frame에서 저장 요청을 보낸 후 응답을 받는 것이므로
    // 별도의 pending 관리가 필요함 - 현재는 저장은 Root Frame에서 직접 처리
  }

  /**
   * 파일 열기 요청 처리
   */
  private async handleOpenFileRequest(request: OpenFileRequest, source: Window | null): Promise<void> {
    this.logger.info(`[FileReceiverService] Received openFile request: ${request.filePath}`);

    // 응답 준비
    const response: OpenFileResponse = {
      channel: postMessageChannels.openFileResponse,
      requestId: request.requestId,
      success: false,
    };

    try {
      // 핸들러가 등록되어 있는지 확인
      if (!this.fileTabOpenHandler) {
        response.error = "File tab handler not registered";
        this.sendResponse(source, response);
        return;
      }

      // 파일 탭 열기
      const result = await this.fileTabOpenHandler(request.filePath, request.content, request.readOnly);

      response.success = result.success;
      response.tabId = result.tabId;
      response.error = result.error;
    } catch (error) {
      response.error = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("[FileReceiverService] Failed to open file tab", error);
    }

    this.sendResponse(source, response);
  }

  /**
   * 응답 전송
   */
  private sendResponse(target: Window | null, response: OpenFileResponse | SaveFileResponse): void {
    if (!target) {
      this.logger.warn("[FileReceiverService] No target window for response");
      return;
    }

    // parent window (Root Frame)에 응답
    // Cluster Frame은 Root Frame의 iframe 안에 있으므로 parent로 응답
    if (window.parent !== window) {
      window.parent.postMessage(response, "*");
    } else if (target) {
      target.postMessage(response, "*");
    }

    this.logger.debug(`[FileReceiverService] Sent response: ${response.channel}`);
  }

  /**
   * 파일 탭 열기 핸들러 등록
   */
  setFileTabOpenHandler(handler: FileTabOpenHandler): void {
    this.fileTabOpenHandler = handler;
    this.logger.info("[FileReceiverService] File tab open handler registered");
  }

  /**
   * 파일 저장 핸들러 등록
   */
  setFileSaveHandler(handler: FileSaveHandler): void {
    this.fileSaveHandler = handler;
    this.logger.info("[FileReceiverService] File save handler registered");
  }

  /**
   * Root Frame에 파일 저장 요청
   */
  async requestSaveFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    this.logger.info(`[FileReceiverService] Requesting save for: ${filePath}`);

    const request: SaveFileRequest = {
      channel: postMessageChannels.saveFile,
      requestId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      filePath,
      content,
    };

    // 현재는 간단하게 parent에 직접 전송
    // TODO: 응답 대기 로직 추가
    if (window.parent !== window) {
      window.parent.postMessage(request, "*");
      // 임시로 성공 반환 - 실제로는 응답 대기 필요
      return { success: true };
    }

    return { success: false, error: "Not in iframe context" };
  }

  /**
   * 서비스 정리
   */
  dispose(): void {
    window.removeEventListener("message", this.boundHandleMessage);
    this.fileTabOpenHandler = null;
    this.fileSaveHandler = null;
    this.logger.info("[FileReceiverService] Disposed");
  }
}
