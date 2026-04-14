/**
 * 🎯 Purpose: FileEditorTab component DI Injectable setup
 * 📝 Features:
 *   - Connect FileEditorTab component to DI container
 *   - Apply withInjectables HOC
 *   - kubectl apply dependency injection
 *   - hostedClusterId injection (for fallback)
 * 🔄 Change History:
 *   - 2026-01-25: FIX-030 - Initial implementation (kubectl apply injectable)
 *   - 2026-01-25: FIX-031 - Added hostedClusterId
 *   - 2026-01-25: FIX-032 - Removed Notification injectable (using store directly)
 * @module file-editor/file-editor-tab.injectable
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import kubectlApplyFileInjectable, { type KubectlApplyFile } from "../../kubectl/apply-file.injectable";
import { FileEditorTabInternal } from "./file-editor-tab";

import type { FileEditorTabProps } from "./file-editor-tab";

/**
 * DI Dependencies interface
 */
export interface FileEditorTabDependencies {
  kubectlApplyFile: KubectlApplyFile;
  hostedClusterId: string | undefined;
}

/**
 * 🎯 FileEditorTab component (DI connected)
 * 📝 withInjectables HOC for DI dependency injection
 */
export const FileEditorTab = withInjectables<FileEditorTabDependencies, FileEditorTabProps>(FileEditorTabInternal, {
  getProps: (di, props) => ({
    ...props,
    kubectlApplyFile: di.inject(kubectlApplyFileInjectable),
    hostedClusterId: di.inject(hostedClusterIdInjectable),
  }),
});

FileEditorTab.displayName = "FileEditorTab";
