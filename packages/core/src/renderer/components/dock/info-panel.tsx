/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./info-panel.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { Icon } from "@skuberplus/icon";
import { Spinner } from "@skuberplus/spinner";
import { cssNames } from "@skuberplus/utilities";
import { computed, makeObservable, observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import navigateInjectable from "../../navigation/navigate.injectable";
import mainTabStoreInjectable from "../main-tabs/main-tab-store.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import dockStoreInjectable from "./dock/store.injectable";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { Navigate } from "../../navigation/navigate.injectable";
import type { MainTabStore } from "../main-tabs/main-tab-store";
import type { DockStore, TabId } from "./dock/store";

export interface InfoPanelProps extends OptionalProps {
  tabId: TabId;
  submit?: () => Promise<string | React.ReactElement | React.ReactElement[] | null | undefined | false | void>;
}

export interface OptionalProps {
  className?: string;
  error?: string;
  controls?: StrictReactNode;
  submitLabel?: StrictReactNode;
  submittingMessage?: StrictReactNode;
  disableSubmit?: boolean;
  showButtons?: boolean;
  showSubmitClose?: boolean;
  showInlineInfo?: boolean;
  showNotifications?: boolean;
  showStatusPanel?: boolean;
  submitTestId?: string;
  submitAndCloseTestId?: string;
  cancelTestId?: string;
  submittingTestId?: string;
}

interface Dependencies {
  dockStore: DockStore;
  mainTabStore: MainTabStore;
  navigate: Navigate;
}

class NonInjectedInfoPanel extends Component<InfoPanelProps & Dependencies> {
  static defaultProps: OptionalProps = {
    submitLabel: "Submit",
    submittingMessage: "Submitting..",
    showButtons: true,
    showSubmitClose: true,
    showInlineInfo: true,
    showNotifications: true,
    showStatusPanel: true,
  };

  @observable error = "";
  @observable waiting = false;

  constructor(props: InfoPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      reaction(
        () => this.props.tabId,
        () => {
          this.waiting = false;
        },
      ),
    ]);
  }

  @computed get errorInfo() {
    return this.props.error;
  }

  submit = async () => {
    const { showNotifications } = this.props;

    this.waiting = true;

    try {
      const result = await this.props.submit?.();

      if (showNotifications && result) {
        const message = typeof result === "string" ? result : "Operation completed successfully";
        notificationPanelStore.addSuccess("operations", "Success", message);
      }

      return result;
    } catch (error) {
      if (showNotifications) {
        notificationPanelStore.addCheckedError("operations", error, "Unknown error while submitting");
      }

      return false;
    } finally {
      this.waiting = false;
    }
  };

  submitAndClose = async () => {
    const result = await this.submit();

    if (result) {
      this.close();
    }
  };

  close = () => {
    const { tabId, dockStore, mainTabStore, navigate } = this.props;

    // 🎯 Main Tab인지 확인 (Main Tab Store에 존재하는지 체크)
    if (mainTabStore.allTabs.some((tab) => tab.id === tabId)) {
      const { wasActive, nextActiveTab } = mainTabStore.removeTab(tabId);

      // 🔄 활성 탭이었고 다음 탭이 있으면 해당 라우트로 네비게이션
      if (wasActive && nextActiveTab) {
        navigate(nextActiveTab.route);
      }
    } else {
      // Dock Tab으로 처리
      dockStore.closeTab(tabId);
    }
  };

  renderErrorIcon() {
    if (!this.props.showInlineInfo || !this.errorInfo) {
      return null;
    }

    return (
      <div className="error">
        <Icon material="error_outline" tooltip={this.errorInfo} />
      </div>
    );
  }

  render() {
    const {
      className,
      controls,
      submitLabel,
      disableSubmit,
      error,
      submittingMessage,
      showButtons,
      showSubmitClose,
      showStatusPanel,
    } = this.props;
    const { submit, close, submitAndClose, waiting } = this;
    const isDisabled = !!(disableSubmit || waiting || error);

    return (
      <div className={cssNames("InfoPanel flex gaps align-center", className)}>
        <div className="controls">{controls}</div>
        {showStatusPanel && (
          <div className="flex gaps align-center">
            {waiting ? (
              <>
                <Spinner data-testid={this.props.submittingTestId} /> {submittingMessage}
              </>
            ) : (
              this.renderErrorIcon()
            )}
          </div>
        )}
        {showButtons && (
          <>
            <Button plain label="Cancel" onClick={close} data-testid={this.props.cancelTestId} />
            <Button
              plain
              outlined
              label={submitLabel}
              onClick={submit}
              disabled={isDisabled}
              data-testid={this.props.submitTestId}
            />
            {showSubmitClose && (
              <Button
                primary
                active
                label={`${submitLabel} & Close`}
                onClick={submitAndClose}
                disabled={isDisabled}
                data-testid={this.props.submitAndCloseTestId}
              />
            )}
          </>
        )}
      </div>
    );
  }
}

export const InfoPanel = withInjectables<Dependencies, InfoPanelProps>(
  observer(NonInjectedInfoPanel),

  {
    getProps: (di, props) => ({
      dockStore: di.inject(dockStoreInjectable),
      mainTabStore: di.inject(mainTabStoreInjectable),
      navigate: di.inject(navigateInjectable),
      ...props,
    }),
  },
);
