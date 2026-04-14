/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@xterm/xterm/css/xterm.css"; // 🎯 xterm 기본 CSS import
import "./terminal-window.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { cssNames } from "@skuberplus/utilities";
import assert from "assert";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import clustersStateInjectable from "../../../../features/cluster/storage/common/state.injectable";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import activeThemeTypeInjectable from "../../../themes/active-type.injectable";
import dockStoreInjectable from "../dock/store.injectable";
import terminalStoreInjectable from "./store.injectable";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../../common/catalog-entities";
import type { Cluster } from "../../../../common/cluster/cluster";
import type { ClusterId } from "../../../../common/cluster-types";
import type { ThemeType } from "../../../themes/lens-theme";
import type { DockStore, DockTab } from "../dock/store";
import type { TerminalStore } from "./store";
import type { Terminal } from "./terminal";

export interface TerminalWindowProps {
  tab: DockTab;
}

interface Dependencies {
  dockStore: DockStore;
  terminalStore: TerminalStore;
  activeThemeType: IComputedValue<ThemeType>;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
  clustersState: Map<ClusterId, Cluster>;
}

class NonInjectedTerminalWindow extends Component<TerminalWindowProps & Dependencies> {
  public elem: HTMLElement | null = null;
  public terminal!: Terminal;
  private resizeObserver?: ResizeObserver;
  private initialSizeTimeout?: number;

  /**
   * 🎯 목적: Terminal 마운트 및 초기화 (연결은 Dock이 담당)
   *
   * 📝 주의사항:
   * - createTerminal()로 Terminal/API만 생성 (connect는 호출하지 않음)
   * - Dock.componentDidMount()에서 배치 토큰 생성 후 connect 호출
   * - React Lifecycle 순서: TerminalWindow mount → connect (직접 호출)
   *
   * 🔄 변경이력:
   * - 2025-10-28 - connect 지연 호출로 마운트 순서 문제 근본 해결
   * - 2025-10-28 - connect 제거, Dock이 명시적으로 호출하도록 변경
   * - 2025-11-27 - Race Condition 수정: TerminalWindow에서 직접 connectTerminal 호출
   */
  componentDidMount() {
    // 1단계: Terminal/API 생성만 (connect 호출하지 않음)
    this.props.terminalStore.createTerminal(this.props.tab);

    const terminal = this.props.terminalStore.getTerminal(this.props.tab.id);

    assert(terminal, "Terminal must be created for tab before mounting");
    this.terminal = terminal;

    // 2단계: DOM에 attach
    this.terminal.attachTo(this.elem!);

    // 3단계: Resize reaction 등록 (fireImmediately로 초기 크기 설정)
    disposeOnUnmount(this, [
      this.props.dockStore.onResize(
        () => {
          const { selectedTab } = this.props.dockStore;

          if (selectedTab?.id === this.props.tab.id) {
            this.terminal.forceFit();
            this.terminal.ensureSizeFallback();
          } else {
            this.ensureConsistentSize("dock-resize");
          }
        },
        {
          fireImmediately: true, // 초기 크기 설정
        },
      ),
    ]);

    this.setupInitialSizeGuards();

    // 4단계: Terminal 연결 (TerminalWindow 마운트 완료 후 직접 연결)
    // 🎯 Dock.componentDidMount()보다 TerminalWindow가 나중에 마운트될 수 있으므로
    // 여기서 직접 connect 호출하여 Race Condition 방지
    this.props.terminalStore.connectTerminal(this.props.tab.id);
  }

  /**
   * 🎯 목적: 탭 전환 시 terminal instance 업데이트
   *
   * 📝 주의사항:
   * - 탭 ID가 변경되면 terminal instance를 새로 가져와서 detach/attach
   * - **중요**: terminal instance가 실제로 다를 때만 detach/attach 수행 (IMK 오류 방지)
   * - Popover는 Dock 레벨에서 관리하므로 여기서는 detach/attach만 처리
   *
   * 🔄 변경이력:
   * - 2025-10-28 - Popover를 Dock 레벨로 이동, componentDidUpdate 단순화
   */
  componentDidUpdate(prevProps: TerminalWindowProps & Dependencies): void {
    if (prevProps.tab.id !== this.props.tab.id) {
      const newTerminal = this.props.terminalStore.getTerminal(this.props.tab.id);

      if (newTerminal && newTerminal !== this.terminal) {
        // 🎯 terminal instance가 다를 때만 detach/attach 수행
        if (this.terminal) {
          this.terminal.detach();
        }
        this.terminal = newTerminal;
        if (this.elem) {
          this.terminal.attachTo(this.elem);
        }
      }
    }
  }

  componentWillUnmount(): void {
    this.terminal.detach();
    this.resizeObserver?.disconnect();
    if (this.initialSizeTimeout) {
      window.clearTimeout(this.initialSizeTimeout);
      this.initialSizeTimeout = undefined;
    }
  }

  private setupInitialSizeGuards() {
    this.ensureConsistentSize("mount");

    // 🎯 ResizeObserver: 컨테이너 크기 변경 시 fit()으로 터미널 크기 동기화
    // xterm.js 공식 권장 방식: https://stackoverflow.com/questions/67160005
    if (typeof ResizeObserver !== "undefined" && this.elem) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        const width = entry?.contentRect.width ?? 0;
        const height = entry?.contentRect.height ?? 0;

        if (width > 0 && height > 0) {
          // 🎯 fit()으로 실제 컨테이너 크기에 맞춰 터미널 크기 조정
          this.terminal.fit();
          this.ensureConsistentSize("resize-observer");
        }
      });

      this.resizeObserver.observe(this.elem);
    }

    this.initialSizeTimeout = window.setTimeout(() => {
      this.ensureConsistentSize("post-timeout");
    }, 0);
  }

  private ensureConsistentSize(reason: string) {
    const { dockStore, terminalStore } = this.props;
    const selectedTab = dockStore.selectedTab;

    if (!selectedTab) {
      this.terminal.ensureSizeFallback();
      return;
    }

    const activeTerminal = terminalStore.getTerminal(selectedTab.id);

    if (selectedTab.id === this.props.tab.id) {
      if (!this.terminal.hasValidSize()) {
        const fallback = activeTerminal?.getLastKnownSize();
        this.terminal.ensureSizeFallback(fallback);
      }
      return;
    }

    if (activeTerminal && activeTerminal.hasValidSize()) {
      const { cols, rows } = activeTerminal.getLastKnownSize();
      const needsUpdate = this.terminal.cols !== cols || this.terminal.rows !== rows;

      if (needsUpdate) {
        this.terminal.resize(cols, rows);
      }
    } else {
      this.terminal.ensureSizeFallback();
    }

    console.debug("[TERMINAL-WINDOW] ensureConsistentSize", {
      reason,
      tabId: this.props.tab.id,
      activeTabId: selectedTab.id,
      terminalSize: this.terminal.getLastKnownSize(),
    });
  }

  render() {
    return (
      <div className={cssNames("TerminalWindow", this.props.activeThemeType.get())}>
        {/* 🎯 TerminalContextHeader 제거: 클러스터 정보는 탭 제목에 표시 (base-structure-template 기준) */}
        <div className="terminal-content" ref={(elem) => (this.elem = elem)} />
        {/* 🎯 Popover는 Dock 레벨에서 관리 (dock.tsx 참조) */}
      </div>
    );
  }
}

export const TerminalWindow = withInjectables<Dependencies, TerminalWindowProps>(observer(NonInjectedTerminalWindow), {
  getProps: (di, props) => ({
    ...props,
    dockStore: di.inject(dockStoreInjectable),
    terminalStore: di.inject(terminalStoreInjectable),
    activeThemeType: di.inject(activeThemeTypeInjectable),
    activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
    clustersState: di.inject(clustersStateInjectable),
  }),
});
