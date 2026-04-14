/**
 * 🎯 Purpose: FileExplorer component DI Injectable setup
 * 📝 Features:
 *   - Connect FileExplorer component to DI container
 *   - Apply withInjectables HOC
 *   - PathPicker dependency injection
 *   - kubectl apply/delete/diff dependency injection
 * 🔄 Change History:
 *   - 2026-01-24: Initial implementation
 *   - 2026-01-25: FIX-030 - Added kubectl apply/delete/diff injectable
 *   - 2026-01-25: FIX-032 - Removed Notification injectable (using store directly)
 * @module file-explorer/file-explorer.injectable
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import React, { useCallback } from "react";
import openPathPickingDialogInjectable from "../../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import kubectlApplyFileInjectable, { type KubectlApplyFile } from "../../../kubectl/apply-file.injectable";
import kubectlDeleteFileInjectable, { type KubectlDeleteFile } from "../../../kubectl/delete-file.injectable";
import kubectlDiffFileInjectable, { type KubectlDiffFile } from "../../../kubectl/diff-file.injectable";
import { FileExplorerInternal } from "./file-explorer";
import fileExplorerStoreInjectable from "./file-explorer-store.injectable";

import type { OpenPathPickingDialog } from "../../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import type { FileExplorerProps } from "./file-explorer.types";
import type { FileExplorerStore } from "./file-explorer-store";

/**
 * DI Dependencies interface
 */
interface Dependencies {
  store: FileExplorerStore;
  openPathPickingDialog: OpenPathPickingDialog;
  kubectlApplyFile: KubectlApplyFile;
  kubectlDeleteFile: KubectlDeleteFile;
  kubectlDiffFile: KubectlDiffFile;
}

/**
 * FileExplorer wrapper component
 * 📝 Receives DI dependencies and passes to FileExplorerInternal
 */
function FileExplorerWrapper({
  store,
  openPathPickingDialog,
  kubectlApplyFile,
  kubectlDeleteFile,
  kubectlDiffFile,
  ...props
}: Dependencies & FileExplorerProps) {
  /**
   * Open folder dialog handler
   */
  const handleOpenFolderDialog = useCallback(() => {
    openPathPickingDialog({
      message: "Select folder to open",
      buttonLabel: "Open",
      properties: ["openDirectory"],
      onPick: (paths) => {
        if (paths.length > 0) {
          store.openFolder(paths[0]);
        }
      },
    });
  }, [openPathPickingDialog, store]);

  return (
    <FileExplorerInternal
      store={store}
      onOpenFolderDialog={handleOpenFolderDialog}
      kubectlApplyFile={kubectlApplyFile}
      kubectlDeleteFile={kubectlDeleteFile}
      kubectlDiffFile={kubectlDiffFile}
      {...props}
    />
  );
}

/**
 * 🎯 FileExplorer component (DI connected)
 * 📝 withInjectables HOC for DI dependency injection
 */
export const FileExplorer = withInjectables<Dependencies, FileExplorerProps>(FileExplorerWrapper, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(fileExplorerStoreInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    kubectlApplyFile: di.inject(kubectlApplyFileInjectable),
    kubectlDeleteFile: di.inject(kubectlDeleteFileInjectable),
    kubectlDiffFile: di.inject(kubectlDiffFileInjectable),
  }),
});

FileExplorer.displayName = "FileExplorer";
