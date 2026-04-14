/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { createKubeApiURL, parseKubeApi } from "@skuberplus/kube-api";
import { waitUntilDefined } from "@skuberplus/utilities";
import assert from "assert";
import yaml from "js-yaml";
import { action, computed, observable, runInAction } from "mobx";
import { createPatch } from "rfc6902";
import { defaultYamlDumpOptions } from "../../../../../common/kube-helpers";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import editResourceTabStoreInjectable from "../store.injectable";
import requestKubeResourceInjectable from "./request-kube-resource.injectable";
import requestPatchKubeResourceInjectable from "./request-patch-kube-resource.injectable";

import type { KubeObject, RawKubeObject } from "@skuberplus/kube-object";

import type { Cluster } from "../../../../../common/cluster/cluster";
import type { EditingResource, EditResourceTabStore } from "../store";
import type { RequestKubeResource } from "./request-kube-resource.injectable";
import type { RequestPatchKubeResource } from "./request-patch-kube-resource.injectable";

const editResourceModelInjectable = getInjectable({
  id: "edit-resource-model",

  instantiate: async (di, tabId: string) => {
    const store = di.inject(editResourceTabStoreInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    const model = new EditResourceModel({
      requestKubeResource: di.inject(requestKubeResourceInjectable),
      requestPatchKubeResource: di.inject(requestPatchKubeResourceInjectable),
      store,
      tabId,
      hostedCluster,
      waitForEditingResource: () => waitUntilDefined(() => store.getData(tabId)),
    });

    await model.load();

    return model;
  },

  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, tabId: string) => tabId,
  }),
});

export default editResourceModelInjectable;

interface Dependencies {
  requestKubeResource: RequestKubeResource;
  requestPatchKubeResource: RequestPatchKubeResource;
  waitForEditingResource: () => Promise<EditingResource>;
  readonly store: EditResourceTabStore;
  readonly tabId: string;
  readonly hostedCluster: Cluster | undefined;
}

function getEditSelfLinkFor(object: RawKubeObject): string | undefined {
  const lensVersionAnnotation = object.metadata.annotations?.[EditResourceAnnotationName];

  if (lensVersionAnnotation) {
    const parsedKubeApi = parseKubeApi(object.metadata.selfLink);

    if (!parsedKubeApi) {
      return undefined;
    }

    const { apiVersionWithGroup, ...parsedApi } = parsedKubeApi;

    return createKubeApiURL({
      ...parsedApi,
      apiVersion: lensVersionAnnotation,
    });
  }

  return object.metadata.selfLink;
}

/**
 * The annotation name that Lens uses to receive the desired api version
 */
export const EditResourceAnnotationName = "skuberplus.app/resource-version";

export class EditResourceModel {
  constructor(protected readonly dependencies: Dependencies) {}

  readonly configuration = {
    value: computed(() => this.editingResource.draft || this.editingResource.firstDraft || ""),

    onChange: action((value: string) => {
      this.editingResource.draft = value;
      this.configuration.error.value.set("");
    }),

    error: {
      value: observable.box(""),

      onChange: action((error: string) => {
        this.configuration.error.value.set(error);
      }),
    },
  };

  @observable private _resource: KubeObject | undefined;

  @computed get shouldShowErrorAboutNoResource() {
    return !this._resource;
  }

  @computed get resource() {
    assert(this._resource, "Resource does not have data");

    return this._resource;
  }

  @computed get editingResource() {
    const resource = this.dependencies.store.getData(this.dependencies.tabId);

    assert(resource, "Resource is not present in the store");

    return resource;
  }

  @computed private get selfLink() {
    return this.editingResource.resource;
  }

  // 🆕 FIX-038: clusterName 헬퍼
  private get clusterName(): string {
    return this.dependencies.hostedCluster?.name.get() ?? "Unknown Cluster";
  }

  load = async (): Promise<void> => {
    await this.dependencies.waitForEditingResource();

    let result = await this.dependencies.requestKubeResource(this.selfLink);

    if (!result.callWasSuccessful) {
      notificationPanelStore.addError("operations", "Load Failed", `Loading resource failed: ${result.error}`, {
        clusterName: this.clusterName,
      });
      return;
    }

    if (result?.response?.metadata.annotations?.[EditResourceAnnotationName]) {
      const parsed = parseKubeApi(this.selfLink);

      if (!parsed) {
        notificationPanelStore.addError(
          "operations",
          "Invalid Link",
          `Object's selfLink is invalid: "${this.selfLink}"`,
          { clusterName: this.clusterName },
        );
        return;
      }

      parsed.apiVersion = result.response.metadata.annotations[EditResourceAnnotationName];

      result = await this.dependencies.requestKubeResource(createKubeApiURL(parsed));
    }

    if (!result.callWasSuccessful) {
      notificationPanelStore.addError("operations", "Load Failed", `Loading resource failed: ${result.error}`, {
        clusterName: this.clusterName,
      });
      return;
    }

    const resource = result.response;

    runInAction(() => {
      this._resource = resource;
    });

    if (!resource) {
      return;
    }

    runInAction(() => {
      this.editingResource.firstDraft = yaml.dump(resource.toPlainObject(), defaultYamlDumpOptions);
    });
  };

  get namespace() {
    return this.resource.metadata.namespace || "default";
  }

  get name() {
    return this.resource.metadata.name;
  }

  get kind() {
    return this.resource.kind;
  }

  save = async () => {
    const currentValue = this.configuration.value.get();
    const currentVersion = yaml.load(currentValue) as RawKubeObject;
    const firstVersion = yaml.load(this.editingResource.firstDraft ?? currentValue);

    // Make sure we save this annotation so that we can use it in the future
    currentVersion.metadata.annotations ??= {};
    currentVersion.metadata.annotations[EditResourceAnnotationName] = currentVersion.apiVersion.split("/").pop();

    const patches = createPatch(firstVersion, currentVersion);
    const selfLink = getEditSelfLinkFor(currentVersion);

    if (!selfLink) {
      notificationPanelStore.addError(
        "operations",
        "Save Failed",
        `Cannot save resource, unknown selfLink: "${currentVersion.metadata.selfLink}"`,
        { clusterName: this.clusterName },
      );

      return null;
    }

    const result = await this.dependencies.requestPatchKubeResource(selfLink, patches);

    if (!result.callWasSuccessful) {
      notificationPanelStore.addError("operations", "Save Failed", `Failed to save resource: ${result.error}`, {
        clusterName: this.clusterName,
      });

      return null;
    }

    const { kind, name } = result.response;

    notificationPanelStore.addSuccess("operations", "Resource Updated", `${kind} ${name} updated.`, {
      clusterName: this.clusterName,
    });

    runInAction(() => {
      this.editingResource.firstDraft = yaml.dump(currentVersion, defaultYamlDumpOptions);
      this.editingResource.resource = selfLink;
    });

    // NOTE: This is required for `saveAndClose` to work correctly
    return [];
  };
}
