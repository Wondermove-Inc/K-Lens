/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { Icon } from "@skuberplus/icon";
import { cssNames } from "@skuberplus/utilities";
import { clipboard } from "electron";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { saveFileDialog } from "../../utils/saveFile";
import { Dialog } from "../dialog";
import { MonacoEditor } from "../monaco-editor";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { Wizard, WizardStep } from "../wizard";
import styles from "./kubeconfig-dialog.module.scss";
import kubeconfigDialogStateInjectable from "./state.injectable";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { IObservableValue } from "mobx";

import type { DialogProps } from "../dialog";

export interface KubeconfigDialogData {
  title?: StrictReactNode;
  config: string;
}

export interface KubeConfigDialogProps extends Partial<DialogProps> {}

interface Dependencies {
  state: IObservableValue<KubeconfigDialogData | undefined>;
}

class NonInjectedKubeConfigDialog extends Component<KubeConfigDialogProps & Dependencies> {
  constructor(props: KubeConfigDialogProps & Dependencies) {
    super(props);
  }

  close = () => {
    this.props.state.set(undefined);
  };

  copyToClipboard = (config: string) => {
    clipboard.writeText(config);
    // 🎯 FIX-037: NotificationPanel으로 마이그레이션
    notificationPanelStore.addSuccess("cluster", "Copied", "Config copied to clipboard");
  };

  download = (config: string) => {
    saveFileDialog("config", config, "text/yaml");
  };

  renderContents = (data: KubeconfigDialogData) => (
    <Wizard header={<h5>{data.title || "Kubeconfig File"}</h5>}>
      <WizardStep
        customButtons={
          <div className="actions flex gaps">
            <Button plain onClick={() => this.copyToClipboard(data.config)}>
              <Icon material="assignment" />
              {" Copy to clipboard"}
            </Button>
            <Button plain onClick={() => this.download(data.config)}>
              <Icon material="cloud_download" />
              {" Download file"}
            </Button>
            <Button plain className="box right" onClick={this.close}>
              Close
            </Button>
          </div>
        }
        prev={this.close}
      >
        <MonacoEditor readOnly className={styles.editor} value={data.config} />
      </WizardStep>
    </Wizard>
  );

  render() {
    const { className, state, ...dialogProps } = this.props;
    const data = state.get();

    return (
      <Dialog
        {...dialogProps}
        className={cssNames(styles.KubeConfigDialog, className)}
        isOpen={!!data}
        close={this.close}
      >
        {data && this.renderContents(data)}
      </Dialog>
    );
  }
}

export const KubeConfigDialog = withInjectables<Dependencies, KubeConfigDialogProps>(
  observer(NonInjectedKubeConfigDialog),
  {
    getProps: (di, props) => ({
      ...props,
      state: di.inject(kubeconfigDialogStateInjectable),
    }),
  },
);
