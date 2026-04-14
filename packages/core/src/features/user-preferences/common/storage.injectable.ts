/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { prefixedLoggerInjectable } from "@skuberplus/logger";
import { action } from "mobx";
import { toJS } from "../../../common/utils";
import storeMigrationVersionInjectable from "../../../common/vars/store-migration-version.injectable";
import createPersistentStorageInjectable from "../../persistent-storage/common/create.injectable";
import persistentStorageMigrationsInjectable from "../../persistent-storage/common/migrations.injectable";
import { userPreferencesMigrationInjectionToken } from "./migrations-token";
import userPreferenceDescriptorsInjectable from "./preference-descriptors.injectable";
import userPreferencesStateInjectable from "./state.injectable";

import type { UserPreferencesModel } from "./preferences-helpers";

export interface UserStoreModel {
  preferences: UserPreferencesModel;
}

const userPreferencesPersistentStorageInjectable = getInjectable({
  id: "user-preferences-persistent-storage",
  instantiate: (di) => {
    const createPersistentStorage = di.inject(createPersistentStorageInjectable);
    const logger = di.inject(prefixedLoggerInjectable, "USER-PREFERENCES");
    const descriptors = di.inject(userPreferenceDescriptorsInjectable);
    const state = di.inject(userPreferencesStateInjectable);

    return createPersistentStorage<UserStoreModel>({
      configName: "lens-user-store",
      projectVersion: di.inject(storeMigrationVersionInjectable),
      migrations: di.inject(persistentStorageMigrationsInjectable, userPreferencesMigrationInjectionToken),
      fromStore: action(({ preferences = {} }) => {
        logger.debug("fromStore()", { preferences });

        state.allowErrorReporting = descriptors.allowErrorReporting.fromStore(preferences.allowErrorReporting);
        state.allowUntrustedCAs = descriptors.allowUntrustedCAs.fromStore(preferences.allowUntrustedCAs);
        state.colorTheme = descriptors.colorTheme.fromStore(preferences.colorTheme);
        state.shadcnTheme = descriptors.shadcnTheme.fromStore(preferences.shadcnTheme);
        state.downloadBinariesPath = descriptors.downloadBinariesPath.fromStore(preferences.downloadBinariesPath);
        state.downloadKubectlBinaries = descriptors.downloadKubectlBinaries.fromStore(
          preferences.downloadKubectlBinaries,
        );
        state.downloadMirror = descriptors.downloadMirror.fromStore(preferences.downloadMirror);
        state.editorConfiguration = descriptors.editorConfiguration.fromStore(preferences.editorConfiguration);
        state.extensionRegistryUrl = descriptors.extensionRegistryUrl.fromStore(preferences.extensionRegistryUrl);
        state.hiddenTableColumns = descriptors.hiddenTableColumns.fromStore(preferences.hiddenTableColumns);
        state.httpsProxy = descriptors.httpsProxy.fromStore(preferences.httpsProxy);
        state.kubectlBinariesPath = descriptors.kubectlBinariesPath.fromStore(preferences.kubectlBinariesPath);
        state.localeTimezone = descriptors.localeTimezone.fromStore(preferences.localeTimezone);
        state.openAtLogin = descriptors.openAtLogin.fromStore(preferences.openAtLogin);
        state.shell = descriptors.shell.fromStore(preferences.shell);
        // 🎯 WSL 설정 로드 (Windows only)
        state.wslEnabled = descriptors.wslEnabled.fromStore(preferences.wslEnabled);
        state.wslDistribution = descriptors.wslDistribution.fromStore(preferences.wslDistribution);
        state.monitorConfig = descriptors.monitorConfig.fromStore(preferences.monitorConfig);
        // 기존 ObservableMap 참조를 유지해야 KubeconfigSyncManager의 observe()가 정상 발화
        const newSyncEntries = descriptors.syncKubeconfigEntries.fromStore(preferences.syncKubeconfigEntries);
        if (state.syncKubeconfigEntries) {
          state.syncKubeconfigEntries.replace(newSyncEntries);
        } else {
          state.syncKubeconfigEntries = newSyncEntries;
        }
        state.terminalConfig = descriptors.terminalConfig.fromStore(preferences.terminalConfig);
        state.terminalCopyOnSelect = descriptors.terminalCopyOnSelect.fromStore(preferences.terminalCopyOnSelect);
        state.terminalTheme = descriptors.terminalTheme.fromStore(preferences.terminalTheme);
        state.aiProvider = descriptors.aiProvider.fromStore(preferences.aiProvider);
        state.aiApiKeys = descriptors.aiApiKeys.fromStore(preferences.aiApiKeys);
        // 🎯 AI Provider/Model 스위치 상태 로드
        state.aiProviderEnabled = descriptors.aiProviderEnabled.fromStore(preferences.aiProviderEnabled);
        state.aiModelEnabled = descriptors.aiModelEnabled.fromStore(preferences.aiModelEnabled);
        state.aiModel = descriptors.aiModel.fromStore(preferences.aiModel);
        state.aiRecentModels = descriptors.aiRecentModels.fromStore(preferences.aiRecentModels);
        // 🎯 Ollama 설정 로드
        state.ollamaBaseUrl = descriptors.ollamaBaseUrl.fromStore(preferences.ollamaBaseUrl);
        state.ollamaModel = descriptors.ollamaModel.fromStore(preferences.ollamaModel);
        // 🎯 OpenRouter 커스텀 모델 로드
        state.openrouterCustomModel = descriptors.openrouterCustomModel.fromStore(preferences.openrouterCustomModel);
        // 🎯 Extension URL 목록 로드
        state.extensionUrls = descriptors.extensionUrls.fromStore(preferences.extensionUrls);
        // 🎯 FIX-039: File Explorer 설정 로드
        state.fileExplorerDefaultPath = descriptors.fileExplorerDefaultPath.fromStore(
          preferences.fileExplorerDefaultPath,
        );
        state.fileExplorerShowHiddenFiles = descriptors.fileExplorerShowHiddenFiles.fromStore(
          preferences.fileExplorerShowHiddenFiles,
        );
        state.fileExplorerAutoOpenOnConnect = descriptors.fileExplorerAutoOpenOnConnect.fromStore(
          preferences.fileExplorerAutoOpenOnConnect,
        );
      }),
      toJSON: () =>
        toJS({
          preferences: {
            allowErrorReporting: descriptors.allowErrorReporting.toStore(state.allowErrorReporting),
            allowUntrustedCAs: descriptors.allowUntrustedCAs.toStore(state.allowUntrustedCAs),
            colorTheme: descriptors.colorTheme.toStore(state.colorTheme),
            shadcnTheme: descriptors.shadcnTheme.toStore(state.shadcnTheme),
            downloadBinariesPath: descriptors.downloadBinariesPath.toStore(state.downloadBinariesPath),
            downloadKubectlBinaries: descriptors.downloadKubectlBinaries.toStore(state.downloadKubectlBinaries),
            downloadMirror: descriptors.downloadMirror.toStore(state.downloadMirror),
            editorConfiguration: descriptors.editorConfiguration.toStore(state.editorConfiguration),
            extensionRegistryUrl: descriptors.extensionRegistryUrl.toStore(state.extensionRegistryUrl),
            hiddenTableColumns: descriptors.hiddenTableColumns.toStore(state.hiddenTableColumns),
            httpsProxy: descriptors.httpsProxy.toStore(state.httpsProxy),
            kubectlBinariesPath: descriptors.kubectlBinariesPath.toStore(state.kubectlBinariesPath),
            localeTimezone: descriptors.localeTimezone.toStore(state.localeTimezone),
            openAtLogin: descriptors.openAtLogin.toStore(state.openAtLogin),
            shell: descriptors.shell.toStore(state.shell),
            // 🎯 WSL 설정 저장 (Windows only)
            wslEnabled: descriptors.wslEnabled.toStore(state.wslEnabled),
            wslDistribution: descriptors.wslDistribution.toStore(state.wslDistribution),
            monitorConfig: descriptors.monitorConfig.toStore(state.monitorConfig),
            syncKubeconfigEntries: descriptors.syncKubeconfigEntries.toStore(state.syncKubeconfigEntries),
            terminalConfig: descriptors.terminalConfig.toStore(state.terminalConfig),
            terminalCopyOnSelect: descriptors.terminalCopyOnSelect.toStore(state.terminalCopyOnSelect),
            terminalTheme: descriptors.terminalTheme.toStore(state.terminalTheme),
            aiProvider: descriptors.aiProvider.toStore(state.aiProvider),
            aiApiKeys: descriptors.aiApiKeys.toStore(state.aiApiKeys),
            // 🎯 AI Provider/Model 스위치 상태 저장
            aiProviderEnabled: descriptors.aiProviderEnabled.toStore(state.aiProviderEnabled),
            aiModelEnabled: descriptors.aiModelEnabled.toStore(state.aiModelEnabled),
            aiModel: descriptors.aiModel.toStore(state.aiModel),
            aiRecentModels: descriptors.aiRecentModels.toStore(state.aiRecentModels),
            // 🎯 Ollama 설정 저장
            ollamaBaseUrl: descriptors.ollamaBaseUrl.toStore(state.ollamaBaseUrl),
            ollamaModel: descriptors.ollamaModel.toStore(state.ollamaModel),
            // 🎯 OpenRouter 커스텀 모델 저장
            openrouterCustomModel: descriptors.openrouterCustomModel.toStore(state.openrouterCustomModel),
            // 🎯 Extension URL 목록 저장
            extensionUrls: descriptors.extensionUrls.toStore(state.extensionUrls),
            // 🎯 FIX-039: File Explorer 설정 저장
            fileExplorerDefaultPath: descriptors.fileExplorerDefaultPath.toStore(state.fileExplorerDefaultPath),
            fileExplorerShowHiddenFiles: descriptors.fileExplorerShowHiddenFiles.toStore(
              state.fileExplorerShowHiddenFiles,
            ),
            fileExplorerAutoOpenOnConnect: descriptors.fileExplorerAutoOpenOnConnect.toStore(
              state.fileExplorerAutoOpenOnConnect,
            ),
          },
        }),
    });
  },
});

export default userPreferencesPersistentStorageInjectable;
