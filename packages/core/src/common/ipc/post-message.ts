/**
 * 🎯 목적: Root Frame ↔ Cluster Frame postMessage 통신 타입 정의
 * 📝 기능:
 *   - postMessage 채널명 상수 정의
 *   - 메시지 타입 정의
 *   - 파일 열기 요청/응답 타입
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module common/ipc/post-message
 */

/**
 * postMessage 채널명
 */
export const postMessageChannels = {
  /** 파일 열기 요청 (Root → Cluster) */
  openFile: "skuber:openFile",
  /** 파일 열기 응답 (Cluster → Root) */
  openFileResponse: "skuber:openFileResponse",
  /** 파일 저장 요청 (Cluster → Root) */
  saveFile: "skuber:saveFile",
  /** 파일 저장 응답 (Root → Cluster) */
  saveFileResponse: "skuber:saveFileResponse",
  /** 파일 탭 닫기 알림 */
  closeFileTab: "skuber:closeFileTab",
  /** 파일 변경 알림 (외부 변경) */
  fileChanged: "skuber:fileChanged",
} as const;

/**
 * postMessage 기본 구조
 */
export interface PostMessageBase {
  /** 메시지 채널 */
  channel: string;
  /** 요청 ID (응답 매칭용) */
  requestId?: string;
}

/**
 * 파일 열기 요청 (Root Frame → Cluster Frame)
 */
export interface OpenFileRequest extends PostMessageBase {
  channel: typeof postMessageChannels.openFile;
  /** 파일 경로 */
  filePath: string;
  /** 파일 내용 (Root Frame에서 미리 읽어옴) */
  content: string;
  /** 파일 크기 (바이트) */
  size: number;
  /** 읽기 전용 여부 */
  readOnly?: boolean;
}

/**
 * 파일 열기 응답 (Cluster Frame → Root Frame)
 */
export interface OpenFileResponse extends PostMessageBase {
  channel: typeof postMessageChannels.openFileResponse;
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 탭 ID (성공 시) */
  tabId?: string;
}

/**
 * 파일 저장 요청 (Cluster Frame → Root Frame)
 */
export interface SaveFileRequest extends PostMessageBase {
  channel: typeof postMessageChannels.saveFile;
  /** 파일 경로 */
  filePath: string;
  /** 저장할 내용 */
  content: string;
}

/**
 * 파일 저장 응답 (Root Frame → Cluster Frame)
 */
export interface SaveFileResponse extends PostMessageBase {
  channel: typeof postMessageChannels.saveFileResponse;
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 파일 탭 닫기 알림
 */
export interface CloseFileTabMessage extends PostMessageBase {
  channel: typeof postMessageChannels.closeFileTab;
  /** 탭 ID */
  tabId: string;
  /** 파일 경로 */
  filePath: string;
}

/**
 * 파일 변경 알림 (외부 변경 감지)
 */
export interface FileChangedMessage extends PostMessageBase {
  channel: typeof postMessageChannels.fileChanged;
  /** 파일 경로 */
  filePath: string;
  /** 변경 타입 */
  changeType: "modified" | "deleted";
}

/**
 * 모든 postMessage 타입 유니온
 */
export type PostMessage =
  | OpenFileRequest
  | OpenFileResponse
  | SaveFileRequest
  | SaveFileResponse
  | CloseFileTabMessage
  | FileChangedMessage;

/**
 * postMessage 타입 가드
 */
export function isSkuberPostMessage(data: unknown): data is PostMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as { channel?: unknown };
  return typeof message.channel === "string" && message.channel.startsWith("skuber:");
}

/**
 * 특정 채널의 메시지인지 확인
 */
export function isChannel<T extends PostMessage>(data: unknown, channel: T["channel"]): data is T {
  if (!isSkuberPostMessage(data)) {
    return false;
  }
  return data.channel === channel;
}

/**
 * 요청 ID 생성
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
