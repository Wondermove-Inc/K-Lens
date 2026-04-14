/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog 열기 메시지를 ClusterFrame → RootFrame으로 relay
 *
 * ClusterFrame (iframe)에서 보낸 Dialog 열기 메시지를 Main Process에서 수신하고,
 * 모든 renderer (특히 RootFrame)에 브로드캐스트합니다.
 *
 * 📝 주의사항:
 * - Main Process는 모든 webContents와 frame에 메시지를 브로드캐스트
 * - RootFrame의 리스너만 실제로 Dialog를 열음
 * - ClusterFrame도 메시지를 받지만 무한 루프 없음 (open.injectable에서 조건 체크)
 *
 * 🔧 작동 원리:
 * 1. ClusterFrame: sendMessageToChannel() → ipcRenderer.send()
 * 2. Main Process: 이 리스너가 수신 → sendMessageToChannel()
 * 3. Main Process: webContents.send() → 모든 renderer에 브로드캐스트
 * 4. RootFrame: ipcRenderer.on() → openAddClusterDialog() → Dialog 열림
 *
 * 🔄 변경이력:
 * - 2025-11-20: 초기 생성 (ClusterFrame → RootFrame 통신 relay)
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@skuberplus/messaging";
import { addClusterDialogChannel } from "../../renderer/components/add-cluster/add-dialog/add-cluster-dialog-channel";

/**
 * 🎯 목적: Main Process에서 AddClusterDialog 메시지 relay
 *
 * ClusterFrame → Main → RootFrame 메시지 흐름을 처리
 */
const relayAddClusterDialogInjectable = getMessageChannelListenerInjectable({
  channel: addClusterDialogChannel,
  id: "relay-to-root-frame",

  getHandler: (di) => {
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    // ✅ ClusterFrame으로부터 받은 메시지를 모든 renderer에 브로드캐스트
    return () => {
      sendMessageToChannel(addClusterDialogChannel);
    };
  },
});

export default relayAddClusterDialogInjectable;
