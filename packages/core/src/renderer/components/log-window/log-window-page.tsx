/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./log-window-page.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
import { ipcRenderer } from "electron";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { LOG_WINDOW_REQUEST_INIT_CHANNEL } from "../../../common/ipc/log-window-channel";
import { LogControls } from "../dock/logs/controls";
import { LogList } from "../dock/logs/list";
import { LogResourceSelector } from "../dock/logs/resource-selector";
import { LogSearch } from "../dock/logs/search";
import createStandaloneLogViewModelInjectable from "./standalone-log-view-model.injectable";

import type { LogWindowInitData } from "../../../common/ipc/log-window-channel";
import type { LogListRef } from "../dock/logs/list";
import type { LogTabViewModel } from "../dock/logs/logs-view-model";
import type { CreateStandaloneLogViewModel, StandaloneLogViewModel } from "./standalone-log-view-model.injectable";

interface Dependencies {
  createViewModel: CreateStandaloneLogViewModel;
}

/**
 * 🎯 목적: 독립 로그 창의 메인 페이지 컴포넌트
 *
 * 📝 동작:
 * 1. IPC로 LogWindowInitData 수신 대기
 * 2. 데이터 수신 시 ViewModel 생성 및 초기화
 * 3. 로그 리스트, 컨트롤, 검색 UI 렌더링
 */
const NonInjectedLogWindowPage = observer(({ createViewModel }: Dependencies) => {
  const [viewModel, setViewModel] = useState<StandaloneLogViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logListElement = useRef<LogListRef>(null);

  useEffect(() => {
    // RootFrame 크롬(TopBar, StatusBar) 숨기기
    document.body.classList.add("log-window-mode");

    return () => {
      document.body.classList.remove("log-window-mode");
    };
  }, []);

  useEffect(() => {
    // URL에서 windowId 추출
    const urlParams = new URLSearchParams(window.location.search);
    const windowId = urlParams.get("windowId");

    if (!windowId) {
      setError("Window ID not found in URL");

      return;
    }

    let disposed = false;

    // Renderer가 준비되면 Main Process에 초기 데이터 요청 (pull 패턴)
    ipcRenderer
      .invoke(LOG_WINDOW_REQUEST_INIT_CHANNEL, windowId)
      .then((data: LogWindowInitData | null) => {
        if (disposed) return;

        if (!data) {
          setError("Failed to get init data from main process");

          return;
        }

        console.log("[LogWindowPage] Received init data:", data);

        if (!data.clusterId || !data.proxyPort || !data.namespace || !data.podName) {
          setError("Invalid initialization data received");

          return;
        }

        try {
          const vm = createViewModel(windowId, data);

          setViewModel(vm);
          vm.initialize();
        } catch (err) {
          console.error("[LogWindowPage] Failed to create view model:", err);
          setError("Failed to initialize log viewer");
        }
      })
      .catch((err: unknown) => {
        if (disposed) return;
        console.error("[LogWindowPage] Failed to request init data:", err);
        setError("Failed to request init data");
      });

    return () => {
      disposed = true;
      viewModel?.dispose();
    };
  }, []);

  // 에러 상태
  if (error) {
    return (
      <div className="LogWindowPage error">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // 로딩 상태
  if (!viewModel) {
    return (
      <div className="LogWindowPage loading">
        <Spinner />
        <p>Waiting for log data...</p>
      </div>
    );
  }

  // LogTabViewModel 인터페이스로 캐스팅하여 기존 컴포넌트에서 사용
  const model = createLogTabViewModelAdapter(viewModel);

  const scrollToOverlay = (overlayLine: number | undefined) => {
    if (!logListElement.current || overlayLine === undefined) {
      return;
    }

    // Scroll vertically
    logListElement.current.scrollToItem(overlayLine, "center");
    // Scroll horizontally in timeout since virtual list need some time to prepare its contents
    setTimeout(() => {
      const overlay = document.querySelector(".LogWindowPage .list span.active");

      if (!overlay) return;
      overlay?.scrollIntoViewIfNeeded?.();
    }, 100);
  };

  return (
    <div className="LogWindowPage">
      <div className="log-window-header">
        <LogResourceSelector model={model} />
        <LogSearch model={model} scrollToOverlay={scrollToOverlay} />
      </div>
      <div className="log-window-content">
        <LogList model={model} ref={logListElement} tabId={viewModel.windowId} isVisible={true} />
      </div>
      <div className="log-window-footer">
        <LogControls model={model} />
      </div>
    </div>
  );
});

/**
 * StandaloneLogViewModel을 LogTabViewModel 인터페이스로 어댑팅
 * 기존 LogList, LogControls 컴포넌트와 호환되도록 함
 *
 * Note: LogTabViewModel은 클래스지만 컴포넌트들은 public 인터페이스만 사용
 * 타입 단언을 통해 duck typing 호환성 보장
 */
function createLogTabViewModelAdapter(vm: StandaloneLogViewModel): LogTabViewModel {
  return {
    searchStore: vm.searchStore,
    isLoading: vm.isLoading,
    logs: vm.logs,
    logsWithoutTimestamps: vm.logsWithoutTimestamps,
    timestampSplitLogs: vm.timestampSplitLogs,
    logTabData: vm.logTabDataComputed,
    pods: vm.pods,
    pod: vm.podComputed,
    updateLogTabData: vm.updateLogTabData,
    loadLogs: vm.loadLogs,
    reloadLogs: vm.reloadLogs,
    renameTab: vm.renameTab,
    stopLoadingLogs: vm.stopLoadingLogs,
    downloadLogs: vm.downloadLogs,
    downloadAllLogs: vm.downloadAllLogs,
  } as unknown as LogTabViewModel;
}

export const LogWindowPage = withInjectables<Dependencies>(NonInjectedLogWindowPage, {
  getProps: (di) => ({
    createViewModel: di.inject(createStandaloneLogViewModelInjectable),
  }),
});
