/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog MessageChannel 리스너
 *
 * ClusterFrame (iframe)에서 보낸 Dialog 열기 메시지를 RootFrame에서 수신하여
 * Dialog를 열어주는 핸들러입니다.
 *
 * 📝 주의사항:
 * - 모든 프레임에 등록되지만 RootFrame에서만 실행됨 (handler 내부에서 조건 체크)
 * - @skuberplus/messaging 프레임워크가 IPC 자동 처리
 * - 레거시 라우팅 패턴과 동일한 방식
 *
 * 🔄 변경이력:
 * - 2025-11-20: 초기 생성 (MessageChannel 패턴 적용)
 * - 2025-11-20: handler 내부 조건 체크로 RootFrame 전용 실행
 */

import { getMessageChannelListenerInjectable } from "@skuberplus/messaging";
import { runInAction } from "mobx";
import currentlyInClusterFrameInjectable from "../../../routes/currently-in-cluster-frame.injectable";
import { addClusterDialogChannel } from "./add-cluster-dialog-channel";
import addClusterDialogStateInjectable from "./state.injectable";

/**
 * 🎯 목적: AddClusterDialog 열기 메시지 리스너 injectable
 *
 * ClusterFrame → RootFrame 메시지를 수신하여 Dialog 열기
 *
 * 📝 주의사항:
 * - handler 내부에서 ClusterFrame이면 early return (무한 루프 방지)
 * - openAddClusterDialog()를 호출하면 무한 루프 발생
 * - 대신 state를 직접 변경하여 Dialog 열기
 *
 * 🔄 변경이력:
 * - 2025-11-20: handler 실행 시점에 currentlyInClusterFrame 체크
 */
const addClusterDialogChannelListenerInjectable = getMessageChannelListenerInjectable({
  channel: addClusterDialogChannel,
  id: "add-cluster-dialog-channel-listener",

  getHandler: (di) => {
    const state = di.inject(addClusterDialogStateInjectable);
    const currentlyInClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    // ClusterFrame에서 보낸 메시지를 RootFrame에서만 받아서 Dialog 열기
    return () => {
      // ClusterFrame에서는 메시지를 받아도 무시 (자기가 보낸 메시지)
      if (currentlyInClusterFrame) {
        return;
      }

      // 무한 루프 방지: openAddClusterDialog() 호출하지 않고 직접 state 변경
      // (openAddClusterDialog()를 호출하면 다시 sendMessageToChannel()이 실행되어 무한 루프)
      state.isOpen.set(false);

      setTimeout(() => {
        runInAction(() => {
          state.isOpen.set(true);
          state.customConfig.set("");
          state.kubeContexts.clear();
          state.isWaiting.set(false);
          state.errors.clear();
        });
      }, 0);
    };
  },
});

export default addClusterDialogChannelListenerInjectable;
