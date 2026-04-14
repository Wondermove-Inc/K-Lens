/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "assert";
import { isDraft, produce } from "immer";
import { isEqual, isPlainObject } from "lodash";
// Helper for working with storages (e.g. window.localStorage, NodeJS/file-system, etc.)
import { action, comparer, computed, makeObservable, observable, observe, toJS } from "mobx";

import type { Logger } from "@skuberplus/logger";

import type { Draft } from "immer";

export interface StorageChange<T> {
  key: string;
  value: T | undefined;
  oldValue: T | undefined;
}

export interface StorageAdapter<T> {
  [metadata: string]: unknown;
  getItem(key: string): T;
  setItem(key: string, value: T): void;
  removeItem(key: string): void;
  onChange?(change: StorageChange<T>): void;
}

export interface StorageHelperOptions<T> {
  readonly storage: StorageAdapter<T>;
  readonly defaultValue: T;
}

export interface StorageLayer<T> {
  isDefaultValue(val: T): boolean;
  get(): T;
  set(value: T): void;
  reset(): void;
  merge(value: Partial<T> | ((draft: Draft<T>) => Partial<T> | void)): void;
}

export const storageHelperLogPrefix = "[STORAGE-HELPER]:";

export interface StorageHelperDependencies {
  readonly logger: Logger;
}

export class StorageHelper<T> implements StorageLayer<T> {
  readonly storage: StorageAdapter<T>;
  private readonly syncChannel: BroadcastChannel | null = null;

  private readonly data = observable.box<T>(undefined, {
    deep: true,
    equals: comparer.structural,
  });

  private readonly value = computed(() => this.data.get() ?? this.defaultValue);

  get defaultValue(): T {
    // return as-is since options.defaultValue might be a getter too
    return this.options.defaultValue;
  }

  constructor(
    private readonly dependencies: StorageHelperDependencies,
    readonly key: string,
    private readonly options: StorageHelperOptions<T>,
  ) {
    makeObservable(this);

    this.storage = this.options.storage;

    observe(this.data, (change) => {
      this.onChange(change.newValue as T | undefined, change.oldValue as T | undefined);
    });

    try {
      const data = this.storage.getItem(this.key);
      const notEmpty = data != null;
      const notDefault = !this.isDefaultValue(data);

      if (notEmpty && notDefault) {
        this.set(data);
      }
    } catch (error) {
      this.dependencies.logger.error(`${storageHelperLogPrefix} loading error: ${error}`, this);
    }

    // 🎯 목적: 현재 키가 초기화된 후 브로드캐스트 채널 준비
    if (typeof BroadcastChannel !== "undefined") {
      this.syncChannel = new BroadcastChannel(`storage-sync-${this.key}`);
    }

    // 🎯 목적: 다른 frame/localStorage 변경을 감지하여 observable 동기화
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("storage", (event) => {
        if (event.key !== this.key) {
          return;
        }

        try {
          if (event.newValue == null) {
            this.reset();
          } else {
            this.set(JSON.parse(event.newValue) as T);
          }
        } catch (error) {
          this.dependencies.logger.error(`${storageHelperLogPrefix} sync error: ${error}`, this);
        }
      });
    }

    // 🎯 목적: 동일 origin 내 다른 frame/worker와 상태 동기화
    this.syncChannel?.addEventListener("message", (event) => {
      const payload = event.data as { type: "update" | "reset"; value?: T } | undefined;

      if (!payload) {
        return;
      }

      try {
        if (payload.type === "reset") {
          this.reset();
        } else if (payload.type === "update") {
          this.set(payload.value as T);
        }
      } catch (error) {
        this.dependencies.logger.error(`${storageHelperLogPrefix} broadcast sync error: ${error}`, this);
      }
    });
  }

  isDefaultValue(value: T): boolean {
    return isEqual(value, this.defaultValue);
  }

  private onChange(value: T | undefined, oldValue: T | undefined) {
    try {
      if (value == null) {
        this.storage.removeItem(this.key);
        this.tryBroadcast({ type: "reset" });
      } else {
        this.storage.setItem(this.key, value);
        this.tryBroadcast({ type: "update", value });
      }

      this.storage.onChange?.({ value, oldValue, key: this.key });
    } catch (error) {
      this.dependencies.logger.error(`${storageHelperLogPrefix} updating storage: ${error}`, this, { value, oldValue });
    }
  }

  // 🎯 목적: BroadcastChannel에 안전하게 전송 (구조화 복제 불가능한 값 방지)
  private tryBroadcast(payload: { type: "update" | "reset"; value?: T }) {
    if (!this.syncChannel) {
      return;
    }

    try {
      const cloned = payload.value === undefined ? undefined : (JSON.parse(JSON.stringify(payload.value)) as T);
      this.syncChannel.postMessage({ ...payload, value: cloned });
    } catch (error) {
      this.dependencies.logger.warn(`${storageHelperLogPrefix} broadcast skipped: ${error}`, this);
    }
  }

  get(): T {
    return this.value.get();
  }

  @action
  set(value: T) {
    if (this.isDefaultValue(value)) {
      this.data.set(undefined);
    } else {
      this.data.set(value);
    }
  }

  @action
  reset() {
    this.data.set(undefined);
  }

  @action
  merge(value: T extends object ? Partial<T> | ((draft: Draft<T>) => Partial<T> | void) : never) {
    const nextValue = produce<T>(toJS(this.get()), (draft) => {
      assert(typeof draft === "object" && draft);

      if (typeof value == "function") {
        const newValue = value(draft);

        // merge returned plain objects from `value-as-callback` usage
        // otherwise `draft` can be just modified inside a callback without returning any value (void)
        if (newValue && !isDraft(newValue)) {
          Object.assign(draft, newValue);
        }
      } else if (isPlainObject(value)) {
        Object.assign(draft, value);
      }

      return draft;
    });

    this.set(nextValue);
  }
}
