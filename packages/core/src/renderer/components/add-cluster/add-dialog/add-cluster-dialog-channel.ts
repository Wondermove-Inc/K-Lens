/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog 열기 메시지 채널 정의
 *
 * ClusterFrame (iframe)에서 RootFrame으로 Dialog 열기 요청을 전송하기 위한
 * MessageChannel을 정의합니다.
 *
 * 📝 주의사항:
 * - @skuberplus/messaging 프레임워크 사용
 * - Electron IPC 채널 자동 처리
 * - 레거시 라우팅 패턴과 동일한 방식
 *
 * 🔄 변경이력:
 * - 2025-11-20: 초기 생성 (MessageChannel 패턴 적용)
 */

import { IpcRendererNavigationEvents } from "../../../../common/ipc/navigation-events";

import type { MessageChannel } from "@skuberplus/messaging";

/**
 * 🎯 목적: AddClusterDialog 열기 메시지 채널
 *
 * ClusterFrame → RootFrame으로 Dialog 열기 요청 전송
 * payload 없음 (단순 트리거)
 */
export const addClusterDialogChannel: MessageChannel<void> = {
  id: IpcRendererNavigationEvents.OPEN_ADD_CLUSTER_DIALOG,
};
