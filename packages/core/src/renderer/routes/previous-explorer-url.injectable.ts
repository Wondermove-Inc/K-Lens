/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 화면에서 Explorer로 복귀 시 이전 URL 저장
 *
 * 📝 사용 시나리오:
 * 1. 사용자가 Cluster 화면에서 Observability로 이동
 * 2. Observability에서 Explorer 클릭
 * 3. 저장된 Cluster URL로 복귀
 *
 * 📝 주의사항:
 * - MobX observable.box로 상태 관리 (메모리 내 상태)
 * - 앱 재시작 시 자동 초기화 → /welcome으로 폴백
 * - Cluster Frame에서 전송된 IPC 메시지도 수신하여 상태 업데이트
 *
 * 🔄 변경이력:
 * - 2026-01-19: 초기 생성 (HotBar 화면 전환 복원 기능)
 * - 2026-01-19: IPC 수신 로직 추가 (Cluster Frame → Root Frame)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ipcRenderer } from "electron";
import { observable } from "mobx";
import { panelSyncChannels, type SaveExplorerUrlPayload } from "../../common/ipc/panel-sync";

/**
 * 🎯 목적: 이전 Explorer URL을 저장하는 MobX observable box
 *
 * 📝 사용법:
 * - get(): 저장된 URL 조회 (null이면 저장된 값 없음)
 * - set(url): 새 URL 저장
 *
 * 📝 IPC 수신:
 * - Cluster Frame에서 Observability로 이동 시 전송된 URL을 수신하여 자동 저장
 * - 채널: panel-sync:save-explorer-url
 *
 * @returns MobX IObservableValue<string | null>
 */
const previousExplorerUrlInjectable = getInjectable({
  id: "previous-explorer-url",

  instantiate: () => {
    const urlBox = observable.box<string | null>(null);

    // 🎯 IPC 리스너 설정: Cluster Frame에서 전송된 URL 수신
    // 📝 Main Process를 통해 전달된 메시지를 수신
    ipcRenderer.on(panelSyncChannels.saveExplorerUrl, (_event, payload: SaveExplorerUrlPayload) => {
      if (payload?.url) {
        urlBox.set(payload.url);
      }
    });

    return urlBox;
  },
});

export default previousExplorerUrlInjectable;
