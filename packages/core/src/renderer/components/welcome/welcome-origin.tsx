/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./welcome.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { observer } from "mobx-react";
import React from "react";
import navigateToAddClusterInjectable from "../../../common/front-end-routing/routes/add-cluster/navigate-to-add-cluster.injectable";
import { forumsUrl } from "../../../common/vars";
import productNameInjectable from "../../../common/vars/product-name.injectable";
import openPathPickingDialogInjectable from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import addSyncEntriesInjectable from "../../initializers/add-sync-entries.injectable";
import { MainLayout } from "../layout/main-layout";
import { Sidebar } from "../layout/sidebar";
import { Hotbar } from "../shadcn-ui/hotbar";

import type { OpenPathPickingDialog } from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";

export const defaultWidth = 320;

interface Dependencies {
  productName: string;
  navigateToAddCluster: () => void;
  openPathPickingDialog: OpenPathPickingDialog;
  addSyncEntries: (filePaths: string[]) => void;
}

const NonInjectedWelcome = observer(
  ({ productName, navigateToAddCluster, openPathPickingDialog, addSyncEntries }: Dependencies) => {
    // 🔗 kubeconfig 파일 동기화 핸들러
    const handleSyncKubeconfig = () => {
      openPathPickingDialog({
        message: "Select kubeconfig file",
        buttonLabel: "Sync",
        properties: ["showHiddenFiles", "multiSelections", "openFile"],
        onPick: addSyncEntries,
      });
    };
    return (
      <MainLayout hotbar={<Hotbar />} sidebar={<Sidebar />}>
        <div className="Welcome vscode-style" data-testid="welcome-page">
          {/* 🎯 VSCode 스타일 환영 화면 */}
          <div className="welcome-container">
            {/* 상단 로고 및 제목 */}
            <div className="welcome-header">
              <div className="header-title-wrapper">
                <Icon svg="logo-lens" className="logo" welcomeLogo={true} data-testid="welcome-logo" />
                <h1 className="welcome-title">{productName}</h1>
              </div>
              <p className="welcome-subtitle">Kubernetes IDE · Simplified Cluster Management</p>
            </div>

            {/* 메인 액션 섹션 */}
            <div className="welcome-content">
              <div className="start-section">
                <h2>Get Started</h2>
                <div className="action-cards">
                  <div className="action-card">
                    <h3>Add from kubeconfig</h3>
                    <p>Add clusters directly from your kubeconfig file</p>
                    <button className="action-button" onClick={() => navigateToAddCluster()}>
                      Add from kubeconfig
                    </button>
                  </div>

                  <div className="action-card">
                    <h3>Sync kubeconfig</h3>
                    <p>Automatically sync and manage your kubeconfig files</p>
                    <button className="action-button" onClick={handleSyncKubeconfig}>
                      Sync kubeconfig
                    </button>
                  </div>
                </div>
              </div>

              {/* 도움말 섹션 */}
              <div className="help-section">
                <h2>Need Help?</h2>
                <div className="help-links">
                  <a href={forumsUrl} target="_blank" rel="noreferrer" className="help-link">
                    <Icon material="help" />
                    <span>Get help on Github</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  },
);

export const Welcome = withInjectables<Dependencies>(NonInjectedWelcome, {
  getProps: (di) => ({
    productName: di.inject(productNameInjectable),
    navigateToAddCluster: di.inject(navigateToAddClusterInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    addSyncEntries: di.inject(addSyncEntriesInjectable),
  }),
});
