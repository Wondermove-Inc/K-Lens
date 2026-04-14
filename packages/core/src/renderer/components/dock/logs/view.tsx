/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { cssNames } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { createRef, useCallback, useEffect } from "react";
import subscribeStoresInjectable from "../../../kube-watch-api/subscribe-stores.injectable";
import podStoreInjectable from "../../workloads-pods/store.injectable";
import closeDockTabInjectable from "../dock/close-dock-tab.injectable";
import { InfoPanel } from "../info-panel";
import { LogControls } from "./controls";
import detachLogWindowInjectable from "./detach-log-window.injectable";
import { LogList } from "./list";
import logsViewModelInjectable from "./logs-view-model.injectable";
import { LogResourceSelector } from "./resource-selector";
import { LogSearch } from "./search";

import type { SubscribeStores } from "../../../kube-watch-api/kube-watch-api";
import type { PodStore } from "../../workloads-pods/store";
import type { DockTab, TabId } from "../dock/store";
import type { DetachLogWindow } from "./detach-log-window.injectable";
import type { LogListRef } from "./list";
import type { LogTabViewModel } from "./logs-view-model";

export interface LogsDockTabProps {
  className?: string;
  tab: DockTab;
  isVisible: boolean;
}

interface Dependencies {
  model: LogTabViewModel;
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  detachLogWindow: DetachLogWindow;
  closeDockTab: (tabId: TabId) => void;
}

const NonInjectedLogsDockTab = observer(
  ({
    className,
    tab,
    model,
    subscribeStores,
    podStore,
    isVisible,
    detachLogWindow,
    closeDockTab,
  }: Dependencies & LogsDockTabProps) => {
    const logListElement = createRef<LogListRef>();
    const data = model.logTabData.get();
    const pod = model.pod.get();

    const handleDetach = useCallback(() => {
      if (pod && data) {
        detachLogWindow(pod, data);
        closeDockTab(tab.id);
      }
    }, [pod, data, detachLogWindow, closeDockTab, tab.id]);

    useEffect(() => {
      model.reloadLogs();

      return model.stopLoadingLogs;
    }, [tab.id]);
    useEffect(
      () =>
        subscribeStores([podStore], {
          namespaces: data ? [data.namespace] : [],
        }),
      [data?.namespace],
    );
    useEffect(() => {
      const panel = document.querySelector<HTMLElement>(".PodLogsInfoPanel");

      if (!panel) {
        return;
      }

      // 🎯 로그 상단 컨트롤 색상 강제 적용 (테마 우선순위 충돌 방지)
      panel.style.setProperty("color", "var(--logsForeground)", "important");
      panel.style.setProperty("background", "var(--logsBackground)", "important");

      const targets = panel.querySelectorAll<HTMLElement>(
        '.Icon, input, .Select__single-value, .Select__input, .Select__indicator, .Select__dropdown-indicator, .Select__control, [data-slot="badge"]',
      );

      targets.forEach((target) => {
        target.style.setProperty("color", "var(--logsForeground)", "important");
      });

      const panelSpans = panel.querySelectorAll<HTMLElement>("span");

      panelSpans.forEach((span) => {
        span.style.setProperty("color", "var(--logsForeground)", "important");
      });

      const logControls = document.querySelector<HTMLElement>('[data-testid="log-controls"]');

      if (logControls) {
        logControls.style.setProperty("color", "var(--logsForeground)", "important");
        logControls.style.setProperty("background", "var(--logsBackground)", "important");

        const controlTargets = logControls.querySelectorAll<HTMLElement>(
          "span, .Checkbox .label, .Checkbox .box, button, .Icon, input",
        );

        controlTargets.forEach((target) => {
          target.style.setProperty("color", "var(--logsForeground)", "important");
        });

        const downloadButton = logControls.querySelector<HTMLElement>('[data-testid="download-logs-dropdown"]');

        if (downloadButton) {
          downloadButton.style.setProperty("border-color", "var(--logsForeground)", "important");
        }
      }
    }, [tab.id]);

    const scrollToOverlay = (overlayLine: number | undefined) => {
      if (!logListElement.current || overlayLine === undefined) {
        return;
      }

      // Scroll vertically
      logListElement.current.scrollToItem(overlayLine, "center");
      // Scroll horizontally in timeout since virtual list need some time to prepare its contents
      setTimeout(() => {
        const overlay = document.querySelector(".PodLogs .list span.active");

        if (!overlay) return;
        // Note: .scrollIntoViewIfNeeded() is non-standard and thus not present in js-dom.
        overlay?.scrollIntoViewIfNeeded?.();
      }, 100);
    };

    if (!data) {
      return null;
    }

    return (
      <div className={cssNames("PodLogs flex column", className)}>
        <InfoPanel
          tabId={tab.id}
          className="PodLogsInfoPanel"
          controls={
            <div className="flex gaps">
              <LogResourceSelector model={model} />
              <LogSearch model={model} scrollToOverlay={scrollToOverlay} />
            </div>
          }
          showSubmitClose={false}
          showButtons={false}
          showStatusPanel={false}
        />
        <LogList model={model} ref={logListElement} tabId={tab.id} isVisible={isVisible} />
        <LogControls model={model} onDetach={handleDetach} />
      </div>
    );
  },
);

export const LogsDockTab = withInjectables<Dependencies, LogsDockTabProps>(NonInjectedLogsDockTab, {
  getProps: (di, props) => ({
    ...props,
    model: di.inject(logsViewModelInjectable, props.tab.id),
    subscribeStores: di.inject(subscribeStoresInjectable),
    podStore: di.inject(podStoreInjectable),
    detachLogWindow: di.inject(detachLogWindowInjectable),
    closeDockTab: di.inject(closeDockTabInjectable),
  }),
});
