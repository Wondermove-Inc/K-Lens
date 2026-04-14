/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { onKeyboardShortcut } from "@skuberplus/utilities";
import { disposeOnUnmount, observer } from "mobx-react";
import React from "react";
import { broadcastMessage } from "../../../common/ipc";
import isMacInjectable from "../../../common/vars/is-mac.injectable";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import legacyOnChannelListenInjectable from "../../ipc/legacy-channel-listen.injectable";
import matchedClusterIdInjectable from "../../navigation/matched-cluster-id.injectable";
import windowAddEventListenerInjectable from "../../window/event-listener.injectable";
import { Dialog } from "../dialog";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import styles from "./command-container.module.scss";
import commandOverlayInjectable from "./command-overlay.injectable";
import inlineCommandPaletteStoreInjectable from "./inline-command-palette-store.injectable";

import type { IComputedValue } from "mobx";

import type { ClusterId } from "../../../common/cluster-types";
import type { ipcRendererOn } from "../../../common/ipc";
import type { AddWindowEventListener } from "../../window/event-listener.injectable";
import type { CreateMainTab } from "../main-tabs/create-main-tab.injectable";
import type { CommandOverlay } from "./command-overlay.injectable";
import type { InlineCommandPaletteStore } from "./inline-command-palette-store.injectable";

interface Dependencies {
  addWindowEventListener: AddWindowEventListener;
  commandOverlay: CommandOverlay;
  clusterId: ClusterId | undefined;
  matchedClusterId: IComputedValue<ClusterId | undefined>;
  isMac: boolean;
  legacyOnChannelListen: typeof ipcRendererOn;
  createMainTab: CreateMainTab;
  inlineStore: InlineCommandPaletteStore;
}

/**
 * 🎯 목적: Command Palette 컨테이너 컴포넌트
 *
 * 📝 주의사항:
 * - observer() 함수 래퍼 사용 (데코레이터 트랜스파일 문제 우회)
 * - withInjectables는 export 시 적용 (DI)
 * - React.Component 사용 (Component 직접 import 대신)
 *
 * 🔄 변경이력:
 * - 2025-10-19 - @observer 데코레이터 추가 (MobX HOC 호환성 문제 해결)
 * - 2025-10-19 - React.Component로 변경 (TypeError 해결)
 * - 2025-10-19 - @observer → observer() 함수 래퍼로 변경 (트랜스파일 문제 우회)
 */
const NonInjectedCommandContainer = observer(
  class extends React.Component<Dependencies> {
    componentDidMount() {
      const { clusterId, addWindowEventListener, matchedClusterId, isMac, inlineStore } = this.props;

      // Shift+Cmd+P / Shift+Ctrl+P → focus inline search bar (no prefill)
      const focusInline = clusterId
        ? () => broadcastMessage("inline-command-palette:focus", "")
        : () => inlineStore.focus("");

      // IPC channel for cross-frame command palette open → redirect to inline
      const ipcAction = clusterId
        ? focusInline
        : () => {
            const matchedId = matchedClusterId.get();

            if (matchedId) {
              broadcastMessage(`command-palette:${matchedId}:open`);
            } else {
              focusInline();
            }
          };
      const ipcChannel = clusterId ? `command-palette:${clusterId}:open` : "command-palette:open";

      // `:` key (Shift+Semicolon) → focus inline search bar with ":" prefilled
      // Fallback for when the keyboard shortcut system blocks `:` (e.g., welcome page where Layer 3 is active)
      const focusInlineWithColon = clusterId
        ? () => broadcastMessage("inline-command-palette:focus", ":")
        : () => inlineStore.focus(":");

      const disposers = [
        this.props.legacyOnChannelListen(ipcChannel, ipcAction),
        addWindowEventListener("keydown", onKeyboardShortcut(isMac ? "Shift+Cmd+P" : "Shift+Ctrl+P", focusInline)),
        addWindowEventListener("keydown", (event) => {
          if (event.code === "Escape") {
            event.stopPropagation();
            this.props.commandOverlay.close();
          }
        }),
        addWindowEventListener("keydown", (event) => {
          if (event.code === "Semicolon" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            // Already handled by keyboard shortcut system (Layer 1/2 active) → skip
            if (event.defaultPrevented) return;

            // Block when user is typing in an input
            const activeEl = document.activeElement;

            if (activeEl) {
              const tag = activeEl.tagName.toLowerCase();

              if (tag === "input" || tag === "textarea") return;
              if (activeEl.getAttribute("contenteditable") === "true") return;
              if (
                activeEl.closest(".monaco-editor") ||
                activeEl.closest(".xterm") ||
                activeEl.closest(".react-select__input")
              )
                return;
            }

            event.preventDefault();
            focusInlineWithColon();
          }
        }),
      ];

      // Root frame: listen for cross-frame inline focus requests (`:` key from cluster frame)
      if (!clusterId) {
        disposers.push(
          this.props.legacyOnChannelListen("inline-command-palette:focus", (_event: unknown, prefill?: unknown) => {
            inlineStore.focus(typeof prefill === "string" ? prefill : ":");
          }),
        );
      }

      // Cluster frame: listen for navigation requests from root frame's inline palette
      if (clusterId) {
        disposers.push(
          this.props.legacyOnChannelListen(
            "inline-command-palette:navigate",
            (_event: unknown, url?: string, title?: string) => {
              if (url) {
                // createMainTab creates a tab AND calls navigate() internally.
                // Just navigate() alone won't update the tab content area.
                this.props.createMainTab({ title: title || url, route: url });
              }
            },
          ),
        );
      }

      disposeOnUnmount(this, disposers);
    }

    render() {
      const { commandOverlay } = this.props;

      return (
        <Dialog
          isOpen={commandOverlay.isOpen}
          animated={false}
          onClose={commandOverlay.close}
          modal={false}
          closeOnNavigation={false}
        >
          <div className={styles.CommandContainer} data-testid="command-container">
            {commandOverlay.component}
          </div>
        </Dialog>
      );
    }
  },
);

export const CommandContainer = withInjectables<Dependencies>(NonInjectedCommandContainer, {
  getProps: (di, props) => ({
    ...props,
    clusterId: di.inject(hostedClusterIdInjectable),
    addWindowEventListener: di.inject(windowAddEventListenerInjectable),
    commandOverlay: di.inject(commandOverlayInjectable),
    matchedClusterId: di.inject(matchedClusterIdInjectable),
    isMac: di.inject(isMacInjectable),
    legacyOnChannelListen: di.inject(legacyOnChannelListenInjectable),
    createMainTab: di.inject(createMainTabInjectable),
    inlineStore: di.inject(inlineCommandPaletteStoreInjectable),
  }),
});
