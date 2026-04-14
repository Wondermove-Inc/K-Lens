/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Namespace } from "@skuberplus/kube-object";
import { noop, toggle } from "@skuberplus/utilities";
import autoBind from "auto-bind";
import { action, comparer, computed, makeObservable, reaction } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { NamespaceApi } from "@skuberplus/kube-api";

import type { IComputedValue, IReactionDisposer } from "mobx";

import type {
  KubeObjectStoreDependencies,
  KubeObjectStoreLoadingParams,
} from "../../../common/k8s-api/kube-object.store";
import type { StorageLayer } from "../../utils/storage-helper";

export interface NamespaceTree {
  id: string;
  namespace: Namespace;
  children?: NamespaceTree[];
}

interface Dependencies extends KubeObjectStoreDependencies {
  readonly storage: StorageLayer<string[]>;
  readonly clusterConfiguredAccessibleNamespaces: IComputedValue<string[]>;
}

export class NamespaceStore extends KubeObjectStore<Namespace, NamespaceApi> {
  constructor(
    protected readonly dependencies: Dependencies,
    api: NamespaceApi,
  ) {
    super(dependencies, api);
    makeObservable(this);
    autoBind(this);
  }

  public onContextChange(
    callback: (namespaces: string[]) => void,
    opts: { fireImmediately?: boolean } = {},
  ): IReactionDisposer {
    return reaction(() => Array.from(this.contextNamespaces), callback, {
      fireImmediately: opts.fireImmediately,
      equals: comparer.shallow,
    });
  }

  /**
   * @private
   * The current value (list of namespaces names) in the storage layer
   */
  @computed private get selectedNamespaces() {
    return this.dependencies.storage.get() ?? [];
  }

  /**
   * @deprecated This doesn't contain the namespaces from cluster settings or from cluster context
   */
  @computed get allowedNamespaces(): string[] {
    return this.items.map((item) => item.getName());
  }

  /**
   * The list of selected namespace names (for filtering)
   * @deprecated This doesn't contain the namespaces from cluster settings or from cluster context
   */
  @computed get contextNamespaces() {
    if (!this.selectedNamespaces.length) {
      return this.allowedNamespaces; // show all namespaces when nothing selected
    }

    return this.selectedNamespaces;
  }

  /**
   * 🎯 목적: 실제 선택된 네임스페이스 Set (storage의 실제 값)
   *
   * 📝 주의사항:
   *   - storage가 빈 배열이면 빈 Set 반환 (All namespaces 선택 상태)
   *   - contextNamespaces와 달리 확장되지 않은 실제 선택값만 반환
   *   - UI 체크 상태 및 Placeholder 표시 로직에서 사용
   *
   * 🔄 변경이력:
   *   - 2025-11-03: contextNamespaces → selectedNamespaces 변경 (All namespaces 표시 버그 수정)
   *
   * @deprecated This doesn't contain the namespaces from cluster settings or from cluster context
   */
  @computed get selectedNames(): Set<string> {
    return new Set(this.selectedNamespaces);
  }

  /**
   * Is true when the the set of namespace names selected is implicitly all
   *
   * Namely, this will be true if the user has deselected all namespaces from
   * the filter or if the user has clicked the "All Namespaces" option
   */
  @computed get areAllSelectedImplicitly(): boolean {
    return this.selectedNamespaces.length === 0;
  }

  subscribe() {
    const clusterConfiguredAccessibleNamespaces = this.dependencies.clusterConfiguredAccessibleNamespaces.get();

    /**
     * if user has given static list of namespaces let's not start watches
     * because watch adds stuff that's not wanted or will just fail
     */
    if (clusterConfiguredAccessibleNamespaces.length > 0) {
      return noop;
    }

    return super.subscribe();
  }

  protected async loadItems(params: KubeObjectStoreLoadingParams): Promise<Namespace[]> {
    const clusterConfiguredAccessibleNamespaces = this.dependencies.clusterConfiguredAccessibleNamespaces.get();

    if (clusterConfiguredAccessibleNamespaces.length > 0) {
      return clusterConfiguredAccessibleNamespaces.map(getDummyNamespace);
    }

    return super.loadItems(params);
  }

  /**
   * 🎯 목적: 네임스페이스 선택 설정 (단일 또는 복수 네임스페이스)
   *
   * @param namespace - 선택할 네임스페이스 (단일 문자열 또는 배열)
   *
   * 📝 주의사항:
   *   - 빈 배열 전달 시 "All namespaces" 선택으로 간주
   *   - MobX action으로 즉시 반영
   *   - StorageHelper는 빈 배열도 정상적으로 저장
   *
   * 🔄 변경이력:
   *   - 2025-11-03: 한국어 주석 추가 및 명시적 빈 배열 처리
   */
  @action selectNamespaces = (namespace: string | string[]) => {
    const namespaces = Array.from(new Set([namespace].flat()));

    // 🔄 즉시 storage 업데이트 (MobX action으로 동기화)
    this.dependencies.storage.set(namespaces);
  };

  @action
  clearSelected(namespaces?: string | string[]) {
    if (namespaces) {
      const resettingNamespaces = [namespaces].flat();
      const newNamespaces = this.dependencies.storage.get()?.filter((ns) => !resettingNamespaces.includes(ns));

      this.dependencies.storage.set(newNamespaces);
    } else {
      this.dependencies.storage.reset();
    }
  }

  /**
   * Checks if namespace names are selected for filtering
   * @param namespaces One or several names of namespaces to check if they are selected
   * @returns `true` if all the provided names are selected
   */
  hasContext(namespaces: string | string[]): boolean {
    return [namespaces].flat().every((namespace) => this.selectedNames.has(namespace));
  }

  /**
   * Is `true` if all available namespaces are selected, otherwise `false`
   */
  @computed get hasAllContexts(): boolean {
    return this.contextNamespaces.length === this.allowedNamespaces.length;
  }

  /**
   * Acts like `toggleSingle` but can work on several at a time
   * @param namespaces One or many names of namespaces to select
   */
  @action
  toggleContext(namespaces: string | string[]) {
    const nextState = new Set(this.contextNamespaces);

    for (const namespace of [namespaces].flat()) {
      toggle(nextState, namespace);
    }

    this.dependencies.storage.set([...nextState]);
  }

  /**
   * Toggles the selection state of `namespace`. Namely, if it was previously
   * specifically or implicitly selected then after this call it will be
   * explicitly deselected.
   * @param namespace The name of a namespace
   */
  toggleSingle(namespace: string) {
    const nextState = new Set(this.contextNamespaces);

    toggle(nextState, namespace);
    this.dependencies.storage.set([...nextState]);
  }

  /**
   * Makes the given namespace the sole selected namespace
   */
  selectSingle(namespace: string) {
    this.dependencies.storage.set([namespace]);
  }

  /**
   * 🎯 목적: 모든 네임스페이스 선택 ("All namespaces" 선택)
   *
   * 📝 주의사항:
   *   - 빈 배열로 설정하여 areAllSelectedImplicitly = true 상태로 만듦
   *   - contextNamespaces는 allowedNamespaces 전체를 반환
   *   - 미래에 추가되는 네임스페이스도 자동 포함됨
   *
   * 🔄 변경이력:
   *   - 2025-11-03: 한국어 주석 추가 및 명시적 빈 배열 처리 설명
   */
  selectAll() {
    // 🎯 빈 배열로 설정하여 "All namespaces" 선택 상태로 만듦
    this.selectNamespaces([]);
  }

  /**
   * This function selects all namespaces implicitly.
   *
   * NOTE: does not toggle any namespaces
   * @param selectAll NOT USED
   * @deprecated Use `NamespaceStore.selectAll` instead.
   */
  toggleAll(selectAll?: boolean) {
    void selectAll;
    this.selectAll();
  }

  getNamespaceTree(root: Namespace): NamespaceTree {
    const children = this.items.filter((namespace) => namespace.isChildOf(root.getName()));

    return {
      id: root.getId(),
      namespace: root,
      children: children.map((child) => this.getNamespaceTree(child)),
    };
  }

  @action
  async remove(item: Namespace) {
    await super.remove(item);
    this.clearSelected(item.getName());
  }
}

export function getDummyNamespace(name: string) {
  return new Namespace({
    kind: Namespace.kind,
    apiVersion: "v1",
    metadata: {
      name,
      uid: "",
      resourceVersion: "",
      selfLink: `/api/v1/namespaces/${name}`,
    },
  });
}
