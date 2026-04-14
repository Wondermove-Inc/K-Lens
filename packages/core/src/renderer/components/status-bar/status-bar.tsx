/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { ipcRendererOn } from "../../../common/ipc";
import { cn } from "../../lib/utils";
import statusBarCurrentStatusInjectable from "./current-status.injectable";
import statusBarFlashMessageInjectable from "./flash-message.injectable";
import showStatusBarFlashInjectable from "./show-status-bar-flash.injectable";
import styles from "./status-bar.module.scss";
import statusBarItemsInjectable from "./status-bar-items.injectable";

import type { IComputedValue, IObservableValue } from "mobx";

import type { StatusBarStatus } from "./current-status.injectable";
import type { ShowStatusBarFlash } from "./show-status-bar-flash.injectable";
import type { StatusBarItems } from "./status-bar-items.injectable";

export interface StatusBarProps {}

interface Dependencies {
  items: IComputedValue<StatusBarItems>;
  status: IObservableValue<StatusBarStatus>;
  flashMessage: IObservableValue<string>;
  showFlash: ShowStatusBarFlash;
}

const NonInjectedStatusBar = observer(({ items, status, flashMessage, showFlash }: Dependencies & StatusBarProps) => {
  const { left, right } = items.get();
  const barStatus = status.get();
  const flash = flashMessage.get();

  // Listen for cross-frame flash messages (cluster frame → root frame)
  React.useEffect(() => {
    const dispose = ipcRendererOn("status-bar:flash", (_event: unknown, message: string) => {
      showFlash(message);
    });

    return dispose;
  }, [showFlash]);

  const renderItem = (item: StatusBarItems["left"][number], index: number) => {
    const ItemComponent = item.component;
    const itemState = item.state?.get() ?? "default";
    const badgeValue = item.badge?.get() ?? null;
    const tooltipContent = item.tooltip?.get();
    const onClick = item.onClick;
    const title = typeof tooltipContent === "string" ? tooltipContent : undefined;

    const body = onClick ? (
      <button
        type="button"
        className={cn(styles.itemBody, styles.clickable)}
        title={title}
        aria-label={title}
        onClick={onClick}
      >
        <ItemComponent />
        {badgeValue ? <span className={styles.badgePill}>{badgeValue}</span> : null}
      </button>
    ) : (
      <div className={styles.itemBody} title={title} aria-label={title}>
        <ItemComponent />
        {badgeValue ? <span className={styles.badgePill}>{badgeValue}</span> : null}
      </div>
    );

    const key = item.origin ? `${item.origin}-${index}` : String(index);

    return (
      <div
        className={styles.item}
        key={key}
        data-origin={item.origin}
        data-state={itemState}
        data-badge={badgeValue ?? undefined}
      >
        {body}
      </div>
    );
  };

  return (
    <div className={styles.StatusBar} data-status={barStatus} data-testid="status-bar" role="contentinfo">
      <div className={styles.leftSide} data-testid="status-bar-left">
        {left.map((item, index) => renderItem(item, index))}
        {flash && (
          <div className={styles.flashMessage} data-testid="status-bar-flash">
            {flash}
          </div>
        )}
      </div>
      <div className={styles.rightSide} data-testid="status-bar-right">
        {right.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
});

export const StatusBar = withInjectables<Dependencies, StatusBarProps>(NonInjectedStatusBar, {
  getProps: (di, props) => ({
    ...props,
    items: di.inject(statusBarItemsInjectable),
    status: di.inject(statusBarCurrentStatusInjectable),
    flashMessage: di.inject(statusBarFlashMessageInjectable),
    showFlash: di.inject(showStatusBarFlashInjectable),
  }),
});
