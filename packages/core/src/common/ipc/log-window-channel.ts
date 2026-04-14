/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 로그 레벨 타입 (log-utils.ts와 동일)
 */
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace" | "unknown";

/**
 * 타임스탬프 포맷 타입 (tab-store.ts와 동일)
 */
export type TimestampFormat = "iso" | "short" | "relative";

/**
 * 🎯 목적: 독립 로그 창을 위한 IPC 채널 및 페이로드 정의
 *
 * 📝 사용 흐름:
 * 1. Parent Window에서 Detach 버튼 클릭
 * 2. ipcRenderer.invoke(LOG_WINDOW_OPEN_CHANNEL, payload)
 * 3. Main Process에서 새 창 생성
 * 4. 새 창 Renderer에서 LOG_WINDOW_REQUEST_INIT_CHANNEL로 초기 데이터 요청 (pull 패턴)
 */

/**
 * IPC 채널 상수
 */
export const LOG_WINDOW_OPEN_CHANNEL = "log-window:open";
export const LOG_WINDOW_REQUEST_INIT_CHANNEL = "log-window:request-init";

/**
 * 로그 창 생성 시 전달되는 페이로드
 */
export interface LogWindowOpenPayload {
  /** 고유 창 ID (UUID) */
  windowId: string;
  /** 클러스터 ID */
  clusterId: string;
  /** 네임스페이스 */
  namespace: string;
  /** Pod UID */
  podId: string;
  /** Pod 이름 (창 제목용) */
  podName: string;
  /** 컨테이너 이름 */
  container: string;
  /** 타임스탬프 표시 여부 */
  showTimestamps: boolean;
  /** 이전 컨테이너 로그 표시 여부 */
  showPrevious: boolean;
  /** 타임스탬프 포맷 */
  timestampFormat: TimestampFormat;
  /** 표시할 로그 레벨 필터 */
  visibleLevels: LogLevel[];
  /** 전체 컨테이너 목록 (컨테이너 전환용) */
  allContainers: Array<{ name: string; isInit: boolean }>;
  /** Owner 워크로드 정보 (Pod 전환용, Deployment/StatefulSet 등) */
  owner?: { uid: string; name: string; kind: string };
}

/**
 * 로그 창 초기화 시 Main → Renderer로 전달되는 데이터
 */
export interface LogWindowInitData extends LogWindowOpenPayload {
  /** LensProxy 포트 번호 */
  proxyPort: number;
}
