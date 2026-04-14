/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog 열기 액션 injectable
 *
 * Dialog를 열고 상태를 초기화하는 함수를 제공합니다.
 *
 * 📝 주의사항:
 * - MobX action으로 상태 변경
 * - ClusterFrame에서는 sendMessageToChannel로 RootFrame에 메시지 전송
 * - RootFrame에서는 직접 state 변경
 *
 * 🔄 변경이력:
 * - 2025-10-24: 초기 생성 (injectable 패턴 적용)
 * - 2025-11-20: sendMessageToChannel로 변경 (MessageChannel 패턴 적용)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sendMessageToChannelInjectionToken } from "@skuberplus/messaging";
import { action, runInAction } from "mobx";
import currentlyInClusterFrameInjectable from "../../../routes/currently-in-cluster-frame.injectable";
import { addClusterDialogChannel } from "./add-cluster-dialog-channel";
import addClusterDialogStateInjectable from "./state.injectable";

/**
 * 🎯 목적: AddClusterDialog 열기 함수 타입
 */
export type OpenAddClusterDialog = () => void;

/**
 * 🎯 목적: AddClusterDialog 열기 injectable 정의
 *
 * 🔧 수정사항:
 * - ClusterFrame에서도 작동하도록 MessageChannel 패턴 적용
 * - ClusterFrame (iframe)에서 호출 시: sendMessageToChannel로 RootFrame에 Dialog 열기 요청
 * - RootFrame에서 호출 시: 직접 state 변경하여 Dialog 열기
 * - 강제 재시작 패턴으로 MobX observable 변화 확실히 감지
 */
const openAddClusterDialogInjectable = getInjectable({
  id: "open-add-cluster-dialog",
  instantiate: (di): OpenAddClusterDialog => {
    const state = di.inject(addClusterDialogStateInjectable);
    const currentlyInClusterFrame = di.inject(currentlyInClusterFrameInjectable);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    return action(() => {
      if (currentlyInClusterFrame) {
        // ClusterFrame (iframe) -> RootFrame으로 MessageChannel 메시지 전송
        sendMessageToChannel(addClusterDialogChannel);
      } else {
        // RootFrame → 직접 state 변경
        // 🔧 강제 재시작 패턴: 먼저 닫기
        state.isOpen.set(false);

        // 다음 프레임에 상태 초기화 후 열기 (MobX observable 변화 확실히 감지)
        setTimeout(() => {
          runInAction(() => {
            state.isOpen.set(true);
            state.customConfig.set("");
            state.kubeContexts.clear();
            state.isWaiting.set(false);
            state.errors.clear();
          });
        }, 0);
      }
    });
  },
});

export default openAddClusterDialogInjectable;
