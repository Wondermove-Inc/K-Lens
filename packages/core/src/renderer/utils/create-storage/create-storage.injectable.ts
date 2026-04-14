/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { action } from "mobx";
import createStorageHelperInjectable from "../create-storage-helper.injectable";

import type { StorageLayer } from "../storage-helper";

export type CreateStorage = <T>(key: string, defaultValue: T) => StorageLayer<T>;

const createStorageInjectable = getInjectable({
  id: "create-storage",

  instantiate: (di): CreateStorage => {
    const createStorageHelper = di.inject(createStorageHelperInjectable);

    return <T>(key: string, defaultValue: T) =>
      createStorageHelper<T>(key, {
        defaultValue,
        storage: {
          getItem: (storageKey) => {
            const raw = window.localStorage.getItem(storageKey);

            if (!raw) {
              return defaultValue;
            }

            try {
              return JSON.parse(raw) as T;
            } catch (error) {
              console.warn(`[create-storage] Failed to parse localStorage for key=${storageKey}`, error);
              return defaultValue;
            }
          },
          setItem: action((storageKey, value) => {
            try {
              window.localStorage.setItem(storageKey, JSON.stringify(value));
            } catch (error) {
              console.warn(`[create-storage] Failed to set localStorage for key=${storageKey}`, error);
            }
          }),
          removeItem: action((storageKey) => {
            try {
              window.localStorage.removeItem(storageKey);
            } catch (error) {
              console.warn(`[create-storage] Failed to remove localStorage for key=${storageKey}`, error);
            }
          }),
        },
      });
  },
});

export default createStorageInjectable;
