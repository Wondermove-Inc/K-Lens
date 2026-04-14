/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { disposer } from "@skuberplus/utilities";
import { remove as removeDir } from "fs-extra";
import React from "react";
import { ExtensionInstallationState } from "../../../../extensions/extension-installation-state-store/extension-installation-state-store";
import extensionInstallationStateStoreInjectable from "../../../../extensions/extension-installation-state-store/extension-installation-state-store.injectable";
import extensionLoaderInjectable from "../../../../extensions/extension-loader/extension-loader.injectable";
import confirmInjectable from "../../confirm-dialog/confirm.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import uninstallExtensionInjectable from "../uninstall-extension.injectable";
import createTempFilesAndValidateInjectable from "./create-temp-files-and-validate.injectable";
import getExtensionDestFolderInjectable from "./get-extension-dest-folder.injectable";
import unpackExtensionInjectable from "./unpack-extension.injectable";

import type { LensExtensionId } from "@skuberplus/legacy-extensions";
import type { Disposer } from "@skuberplus/utilities";

import type { ExtensionInstallationStateStore } from "../../../../extensions/extension-installation-state-store/extension-installation-state-store";
import type { ExtensionLoader } from "../../../../extensions/extension-loader";
import type { Confirm } from "../../confirm-dialog/confirm.injectable";
import type { CreateTempFilesAndValidate } from "./create-temp-files-and-validate.injectable";
import type { GetExtensionDestFolder } from "./get-extension-dest-folder.injectable";
import type { UnpackExtension } from "./unpack-extension.injectable";

export interface InstallRequest {
  fileName: string;
  data: Buffer;
}

interface Dependencies {
  extensionLoader: ExtensionLoader;
  uninstallExtension: (id: LensExtensionId) => Promise<boolean>;
  unpackExtension: UnpackExtension;
  createTempFilesAndValidate: CreateTempFilesAndValidate;
  getExtensionDestFolder: GetExtensionDestFolder;
  installStateStore: ExtensionInstallationStateStore;
  confirm: Confirm;
}

export type AttemptInstall = (request: InstallRequest, cleanup?: Disposer) => Promise<void>;

const attemptInstall =
  ({
    extensionLoader,
    uninstallExtension,
    unpackExtension,
    createTempFilesAndValidate,
    getExtensionDestFolder,
    installStateStore,
    confirm,
  }: Dependencies): AttemptInstall =>
  async (request, cleanup) => {
    const dispose = disposer(installStateStore.startPreInstall(), cleanup);

    const validatedRequest = await createTempFilesAndValidate(request);

    if (!validatedRequest) {
      return dispose();
    }

    const { name, version, description } = validatedRequest.manifest;
    const curState = installStateStore.getInstallationState(validatedRequest.id);

    if (curState !== ExtensionInstallationState.IDLE) {
      dispose();

      notificationPanelStore.addError(
        "extensions",
        "Extension Install Collision",
        `The "${name}" extension is currently ${curState.toLowerCase()}. Will not proceed with this current install request.`,
      );

      return;
    }

    const extensionFolder = getExtensionDestFolder(name);
    const installedExtension = extensionLoader.getExtensionById(validatedRequest.id);

    if (installedExtension) {
      const { version: oldVersion } = installedExtension.manifest;

      // confirm to uninstall old version before installing new version
      const proceed = await confirm({
        message: (
          <div className="flex column gaps">
            <p>
              {"Install extension "}
              <b>{`${name}@${version}`}</b>?
            </p>
            <p>
              {"Description: "}
              <em>{description}</em>
            </p>
            <p>
              <b>Warning:</b>
              {` ${name}@${oldVersion} will be removed before installation.`}
            </p>
          </div>
        ),
        labelCancel: "Cancel",
        labelOk: "Install",
      });

      if (!proceed) {
        return dispose();
      }

      if (await uninstallExtension(validatedRequest.id)) {
        await unpackExtension(validatedRequest, dispose);
      } else {
        dispose();
      }
    } else {
      // clean up old data if still around
      await removeDir(extensionFolder);

      // install extension if not yet exists
      await unpackExtension(validatedRequest, dispose);
    }
  };

const attemptInstallInjectable = getInjectable({
  id: "attempt-install",
  instantiate: (di) =>
    attemptInstall({
      extensionLoader: di.inject(extensionLoaderInjectable),
      uninstallExtension: di.inject(uninstallExtensionInjectable),
      unpackExtension: di.inject(unpackExtensionInjectable),
      createTempFilesAndValidate: di.inject(createTempFilesAndValidateInjectable),
      getExtensionDestFolder: di.inject(getExtensionDestFolderInjectable),
      installStateStore: di.inject(extensionInstallationStateStoreInjectable),
      confirm: di.inject(confirmInjectable),
    }),
});

export default attemptInstallInjectable;
