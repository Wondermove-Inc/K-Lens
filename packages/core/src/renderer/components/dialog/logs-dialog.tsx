/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./logs-dialog.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { Icon } from "@skuberplus/icon";
import { clipboard } from "electron";
import { kebabCase } from "lodash/fp";
import React from "react";
import { Dialog } from "../dialog";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { Wizard, WizardStep } from "../wizard";

import type { DialogProps } from "../dialog";

export interface LogsDialogProps extends DialogProps {
  title: string;
  logs: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Dependencies {}

const NonInjectedLogsDialog = (props: LogsDialogProps & Dependencies) => {
  const { title, logs, ...dialogProps } = props;

  return (
    <Dialog {...dialogProps} className="LogsDialog" data-testid={`logs-dialog-for-${kebabCase(title)}`}>
      <Wizard header={<h5>{title}</h5>} done={dialogProps.close}>
        <WizardStep
          scrollable={false}
          customButtons={
            <div className="buttons flex gaps align-center justify-space-between">
              <Button
                plain
                onClick={() => {
                  clipboard.writeText(logs);
                  notificationPanelStore.addSuccess("file", "Copied", "Logs copied to clipboard.");
                }}
              >
                <Icon material="assignment" />
                {" Copy to clipboard"}
              </Button>
              <Button plain onClick={dialogProps.close}>
                Close
              </Button>
            </div>
          }
        >
          <code className="block">{logs || "There are no logs available."}</code>
        </WizardStep>
      </Wizard>
    </Dialog>
  );
};

export const LogsDialog = withInjectables<Dependencies, LogsDialogProps>(NonInjectedLogsDialog, {
  getProps: (di, props) => ({
    ...props,
  }),
});
