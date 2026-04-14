/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { ApiException, type KubeConfig } from "@skuberplus/kubernetes-client-node";
import { loggerInjectionToken } from "@skuberplus/logger";
import { disposer, isDefined, isRequestError, withConcurrencyLimit } from "@skuberplus/utilities";
import { BrowserWindow, app as electronApp } from "electron";
import { comparer, type IObservableValue, reaction, runInAction } from "mobx";
import createAuthorizationApiInjectable from "../../common/cluster/create-authorization-api.injectable";
import createCanIInjectable from "../../common/cluster/create-can-i.injectable";
import createCoreApiInjectable from "../../common/cluster/create-core-api.injectable";
import createRequestNamespaceListPermissionsInjectable from "../../common/cluster/create-request-namespace-list-permissions.injectable";
import createListNamespacesInjectable from "../../common/cluster/list-namespaces.injectable";
import { type ClusterId, ClusterStatus } from "../../common/cluster-types";
import broadcastMessageInjectable from "../../common/ipc/broadcast-message.injectable";
import { clusterListNamespaceForbiddenChannel } from "../../common/ipc/cluster";
import { formatKubeApiResource } from "../../common/rbac";
import { replaceObservableObject } from "../../common/utils/replace-observable-object";
import clusterVersionDetectorInjectable from "../cluster-detectors/cluster-version-detector.injectable";
import detectClusterMetadataInjectable from "../cluster-detectors/detect-cluster-metadata.injectable";
import broadcastConnectionUpdateInjectable from "./broadcast-connection-update.injectable";
import { clusterLatencyUpdateChannel } from "./get-cluster-latency.injectable";
import kubeAuthProxyServerInjectable from "./kube-auth-proxy-server.injectable";
import loadProxyKubeconfigInjectable from "./load-proxy-kubeconfig.injectable";
import prometheusHandlerInjectable from "./prometheus-handler/prometheus-handler.injectable";
import removeProxyKubeconfigInjectable from "./remove-proxy-kubeconfig.injectable";
import requestApiResourcesInjectable from "./request-api-resources.injectable";
import visibleClusterInjectable from "./visible-cluster.injectable";

import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../common/cluster/cluster";
import type { CreateAuthorizationApi } from "../../common/cluster/create-authorization-api.injectable";
import type { CreateCanI } from "../../common/cluster/create-can-i.injectable";
import type { CreateCoreApi } from "../../common/cluster/create-core-api.injectable";
import type {
  CreateRequestNamespaceListPermissions,
  RequestNamespaceListPermissions,
} from "../../common/cluster/create-request-namespace-list-permissions.injectable";
import type { CreateListNamespaces } from "../../common/cluster/list-namespaces.injectable";
import type { BroadcastMessage } from "../../common/ipc/broadcast-message.injectable";
import type { KubeApiResource } from "../../common/rbac";
import type { DetectClusterMetadata } from "../cluster-detectors/detect-cluster-metadata.injectable";
import type { FallibleOnlyClusterMetadataDetector } from "../cluster-detectors/token";
import type { BroadcastConnectionUpdate } from "./broadcast-connection-update.injectable";
import type { KubeAuthProxyServer } from "./kube-auth-proxy-server.injectable";
import type { LoadProxyKubeconfig } from "./load-proxy-kubeconfig.injectable";
import type { ClusterPrometheusHandler } from "./prometheus-handler/prometheus-handler";
import type { RemoveProxyKubeconfig } from "./remove-proxy-kubeconfig.injectable";
import type { RequestApiResources } from "./request-api-resources.injectable";

interface Dependencies {
  readonly logger: Logger;
  readonly prometheusHandler: ClusterPrometheusHandler;
  readonly kubeAuthProxyServer: KubeAuthProxyServer;
  readonly clusterVersionDetector: FallibleOnlyClusterMetadataDetector;
  readonly visibleCluster: IObservableValue<ClusterId | null>;
  createCanI: CreateCanI;
  requestApiResources: RequestApiResources;
  createRequestNamespaceListPermissions: CreateRequestNamespaceListPermissions;
  createAuthorizationApi: CreateAuthorizationApi;
  createCoreApi: CreateCoreApi;
  createListNamespaces: CreateListNamespaces;
  detectClusterMetadata: DetectClusterMetadata;
  broadcastMessage: BroadcastMessage;
  broadcastConnectionUpdate: BroadcastConnectionUpdate;
  loadProxyKubeconfig: LoadProxyKubeconfig;
  removeProxyKubeconfig: RemoveProxyKubeconfig;
}

export type { ClusterConnection };

class ClusterConnection {
  protected readonly eventsDisposer = disposer();

  protected activated = false;

  constructor(
    private readonly dependencies: Dependencies,
    private readonly cluster: Cluster,
  ) {}

  private static readonly FOREGROUND_REFRESH_MS = 60_000; // 60s
  private static readonly BACKGROUND_REFRESH_MS = 300_000; // 5 min

  private bindEvents() {
    this.dependencies.logger.info(`[CLUSTER]: bind events`, this.cluster.getMeta());

    // Dynamic refresh: 60s foreground / 300s background, with immediate
    // refresh when the user returns to the app.
    const isAppFocused = () => BrowserWindow.getAllWindows().some((w) => w.isFocused());

    let refreshTimeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextRefresh = () => {
      const delay = isAppFocused() ? ClusterConnection.FOREGROUND_REFRESH_MS : ClusterConnection.BACKGROUND_REFRESH_MS;

      refreshTimeoutId = setTimeout(() => {
        if (!this.cluster.disconnected.get()) {
          this.refresh();
        }
        scheduleNextRefresh();
      }, delay);
    };

    scheduleNextRefresh();

    // Active cluster refreshes on focus if enough time has passed since
    // the last refresh; background clusters use random jitter (0–3 s).
    // The cooldown prevents redundant API calls on rapid Alt-Tab switching.
    const FOCUS_REFRESH_COOLDOWN_MS = 10_000; // 10 s
    let lastRefreshTime = Date.now();
    let focusJitterTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const originalRefresh = this.refresh.bind(this);

    this.refresh = async () => {
      lastRefreshTime = Date.now();

      return originalRefresh();
    };

    const handleWindowFocus = () => {
      clearTimeout(refreshTimeoutId);
      clearTimeout(focusJitterTimeoutId);

      const elapsed = Date.now() - lastRefreshTime;

      if (!this.cluster.disconnected.get() && elapsed >= FOCUS_REFRESH_COOLDOWN_MS) {
        const isActiveCluster = this.dependencies.visibleCluster.get() === this.cluster.id;

        if (isActiveCluster) {
          this.refresh();
        } else {
          const jitter = Math.floor(Math.random() * 3_000);

          focusJitterTimeoutId = setTimeout(() => {
            if (!this.cluster.disconnected.get()) {
              this.refresh();
            }
          }, jitter);
        }
      }

      scheduleNextRefresh();
    };

    electronApp.on("browser-window-focus", handleWindowFocus);

    const refreshMetadataTimer = setInterval(() => {
      if (this.cluster.available.get()) {
        this.refreshAccessibilityAndMetadata();
      }
    }, 900000); // every 15 minutes

    this.eventsDisposer.push(
      reaction(
        () => this.cluster.prometheusPreferences.get(),
        (preferences) => this.dependencies.prometheusHandler.setupPrometheus(preferences),
        { equals: comparer.structural },
      ),
      () => clearTimeout(refreshTimeoutId),
      () => clearTimeout(focusJitterTimeoutId),
      () => electronApp.off("browser-window-focus", handleWindowFocus),
      () => clearInterval(refreshMetadataTimer),
      reaction(
        () => this.cluster.preferences.defaultNamespace,
        () => this.recreateProxyKubeconfig(),
      ),
    );
  }

  protected async recreateProxyKubeconfig() {
    this.dependencies.logger.info("[CLUSTER]: Recreating proxy kubeconfig");

    try {
      await this.dependencies.removeProxyKubeconfig();
      await this.dependencies.loadProxyKubeconfig();
    } catch (error) {
      this.dependencies.logger.error(`[CLUSTER]: failed to recreate proxy kubeconfig`, error);
    }
  }

  /**
   * @param force force activation
   */
  async activate(force = false) {
    if (this.activated && !force) {
      return;
    }

    this.dependencies.logger.info(`[CLUSTER]: activate`, this.cluster.getMeta());

    if (!this.eventsDisposer.length) {
      this.bindEvents();
    }

    if (this.cluster.disconnected.get() || !this.cluster.accessible.get()) {
      try {
        this.dependencies.broadcastConnectionUpdate({
          level: "info",
          message: "Starting connection ...",
        });
        await this.reconnect();
      } catch (error) {
        this.dependencies.broadcastConnectionUpdate({
          level: "error",
          message: `Failed to start connection: ${error}`,
        });

        return;
      }
    }

    try {
      this.dependencies.broadcastConnectionUpdate({
        level: "info",
        message: "Refreshing connection status ...",
      });
      await this.refreshConnectionStatus();
    } catch (error) {
      this.dependencies.broadcastConnectionUpdate({
        level: "error",
        message: `Failed to connection status: ${error}`,
      });

      return;
    }

    if (this.cluster.accessible.get()) {
      try {
        this.dependencies.broadcastConnectionUpdate({
          level: "info",
          message: "Refreshing cluster accessibility ...",
        });
        await this.refreshAccessibility();
      } catch (error) {
        this.dependencies.broadcastConnectionUpdate({
          level: "error",
          message: `Failed to refresh accessibility: ${error}`,
        });

        return;
      }

      // 🎯 클러스터 연결 시 메타데이터 감지 (CSP distribution 등)
      try {
        this.dependencies.broadcastConnectionUpdate({
          level: "info",
          message: "Detecting cluster metadata ...",
        });
        await this.refreshMetadata();
      } catch (error) {
        // 메타데이터 감지 실패는 연결 실패로 처리하지 않음 (경고만 로그)
        this.dependencies.logger.warn(`[CLUSTER]: Failed to detect metadata: ${error}`);
      }

      this.dependencies.broadcastConnectionUpdate({
        level: "info",
        message: "Connected, waiting for view to load ...",
      });
    }

    this.activated = true;
  }

  async reconnect() {
    this.dependencies.logger.info(`[CLUSTER]: reconnect`, this.cluster.getMeta());
    await this.dependencies.kubeAuthProxyServer?.restart();

    runInAction(() => {
      this.cluster.disconnected.set(false);
    });
  }

  disconnect() {
    if (this.cluster.disconnected.get()) {
      return this.dependencies.logger.debug("[CLUSTER]: already disconnected", { id: this.cluster.id });
    }

    runInAction(() => {
      this.dependencies.logger.info(`[CLUSTER]: disconnecting`, { id: this.cluster.id });
      this.eventsDisposer();
      this.dependencies.kubeAuthProxyServer?.stop();
      this.cluster.disconnected.set(true);
      this.cluster.online.set(false);
      this.cluster.accessible.set(false);
      this.cluster.ready.set(false);
      this.activated = false;
      this.cluster.allowedNamespaces.clear();
      this.dependencies.logger.info(`[CLUSTER]: disconnected`, { id: this.cluster.id });
    });
  }

  async refresh() {
    this.dependencies.logger.info(`[CLUSTER]: refresh`, this.cluster.getMeta());
    await this.refreshConnectionStatus();
  }

  async refreshAccessibilityAndMetadata() {
    await this.refreshAccessibility();
    await this.refreshMetadata();
  }

  async refreshMetadata() {
    this.dependencies.logger.info(`[CLUSTER]: refreshMetadata`, this.cluster.getMeta());
    const metadata = await this.dependencies.detectClusterMetadata(this.cluster);

    runInAction(() => {
      replaceObservableObject(this.cluster.metadata, metadata);
    });
  }

  private async refreshAccessibility(): Promise<void> {
    this.dependencies.logger.info(`[CLUSTER]: refreshAccessibility`, this.cluster.getMeta());
    const proxyConfig = await this.dependencies.loadProxyKubeconfig();
    const api = this.dependencies.createAuthorizationApi(proxyConfig);
    const canI = this.dependencies.createCanI(api);
    const requestNamespaceListPermissions = this.dependencies.createRequestNamespaceListPermissions(api);

    const isAdmin = await canI({
      namespace: "kube-system",
      resource: "*",
      verb: "create",
    });
    const isGlobalWatchEnabled = await canI({
      verb: "watch",
      resource: "*",
    });
    const allowedNamespaces = await this.requestAllowedNamespaces(proxyConfig);
    const knownResources = await (async () => {
      const result = await this.dependencies.requestApiResources(this.cluster);

      if (result.callWasSuccessful) {
        return result.response;
      }

      if (this.cluster.knownResources.length > 0) {
        this.dependencies.logger.warn(`[CLUSTER]: failed to list KUBE resources, sticking with previous list`);

        return this.cluster.knownResources;
      }

      this.dependencies.logger.warn(
        `[CLUSTER]: failed to list KUBE resources for the first time, blocking connection to cluster...`,
      );
      this.dependencies.broadcastConnectionUpdate({
        level: "error",
        message: "Failed to list kube API resources, please reconnect...",
      });

      return [];
    })();
    const resourcesToShow = await this.getResourcesToShow(
      allowedNamespaces,
      knownResources,
      requestNamespaceListPermissions,
    );

    runInAction(() => {
      this.cluster.isAdmin.set(isAdmin);
      this.cluster.isGlobalWatchEnabled.set(isGlobalWatchEnabled);
      this.cluster.allowedNamespaces.replace(allowedNamespaces);
      this.cluster.knownResources.replace(knownResources);
      this.cluster.resourcesToShow.replace(resourcesToShow);
      this.cluster.ready.set(this.cluster.knownResources.length > 0);
    });

    this.dependencies.logger.debug(`[CLUSTER]: refreshed accessibility data`, this.cluster.getState());
  }

  async refreshConnectionStatus() {
    const connectionStatus = await this.getConnectionStatus();

    runInAction(() => {
      this.cluster.online.set(connectionStatus > ClusterStatus.Offline);
      this.cluster.accessible.set(connectionStatus == ClusterStatus.AccessGranted);
    });
  }

  protected async getConnectionStatus(): Promise<ClusterStatus> {
    try {
      const startTime = performance.now();
      const versionData = await this.dependencies.clusterVersionDetector.detect(this.cluster);
      const latencyMs = Math.round(performance.now() - startTime);

      runInAction(() => {
        this.cluster.metadata.version = versionData.value;
      });

      this.dependencies.broadcastMessage(clusterLatencyUpdateChannel, {
        clusterId: this.cluster.id,
        latencyMs,
      });

      return ClusterStatus.AccessGranted;
    } catch (error) {
      this.dependencies.logger.error(`[CLUSTER]: Failed to connect to "${this.cluster.contextName.get()}": ${error}`);

      if (isRequestError(error)) {
        if (error.statusCode) {
          if (error.statusCode >= 400 && error.statusCode < 500) {
            this.dependencies.broadcastConnectionUpdate({
              level: "error",
              message: "Invalid credentials",
            });

            return ClusterStatus.AccessDenied;
          }

          const message = String(error.error || error.message) || String(error);

          this.dependencies.broadcastConnectionUpdate({
            level: "error",
            message,
          });

          return ClusterStatus.Offline;
        }

        if (error.failed === true) {
          if (error.timedOut === true) {
            this.dependencies.broadcastConnectionUpdate({
              level: "error",
              message: "Connection timed out",
            });

            return ClusterStatus.Offline;
          }

          this.dependencies.broadcastConnectionUpdate({
            level: "error",
            message: "Failed to fetch credentials",
          });

          return ClusterStatus.AccessDenied;
        }

        const message = String(error.error || error.message) || String(error);

        this.dependencies.broadcastConnectionUpdate({
          level: "error",
          message,
        });
      } else if (error instanceof Error || typeof error === "string") {
        this.dependencies.broadcastConnectionUpdate({
          level: "error",
          message: `${error}`,
        });
      } else {
        this.dependencies.broadcastConnectionUpdate({
          level: "error",
          message: "Unknown error has occurred",
        });
      }

      return ClusterStatus.Offline;
    }
  }

  protected async requestAllowedNamespaces(proxyConfig: KubeConfig) {
    if (this.cluster.accessibleNamespaces.length) {
      return this.cluster.accessibleNamespaces;
    }

    try {
      const api = this.dependencies.createCoreApi(proxyConfig);
      const listNamespaces = this.dependencies.createListNamespaces(api);

      return await listNamespaces();
    } catch (error) {
      const ctx = proxyConfig.getContextObject(this.cluster.contextName.get());
      const namespaceList = [ctx?.namespace].filter(isDefined);

      if (namespaceList.length === 0 && error instanceof ApiException && error.code === 403) {
        const { body } = error;

        this.dependencies.logger.info("[CLUSTER]: listing namespaces is forbidden, broadcasting", {
          clusterId: this.cluster.id,
          error: body,
        });
        this.dependencies.broadcastMessage(clusterListNamespaceForbiddenChannel, this.cluster.id);
      }

      return namespaceList;
    }
  }

  protected async getResourcesToShow(
    allowedNamespaces: string[],
    knownResources: KubeApiResource[],
    req: RequestNamespaceListPermissions,
  ) {
    if (!allowedNamespaces.length) {
      return [];
    }

    const requestNamespaceListPermissions = withConcurrencyLimit(5)(req);
    const namespaceListPermissions = allowedNamespaces.map(requestNamespaceListPermissions);
    const canListResources = await Promise.all(namespaceListPermissions);

    return knownResources.filter((resource) => canListResources.some((fn) => fn(resource))).map(formatKubeApiResource);
  }
}

const clusterConnectionInjectable = getInjectable({
  id: "cluster-connection",
  instantiate: (di, cluster) =>
    new ClusterConnection(
      {
        clusterVersionDetector: di.inject(clusterVersionDetectorInjectable),
        kubeAuthProxyServer: di.inject(kubeAuthProxyServerInjectable, cluster),
        logger: di.inject(loggerInjectionToken),
        prometheusHandler: di.inject(prometheusHandlerInjectable, cluster),
        broadcastConnectionUpdate: di.inject(broadcastConnectionUpdateInjectable, cluster),
        broadcastMessage: di.inject(broadcastMessageInjectable),
        createListNamespaces: di.inject(createListNamespacesInjectable),
        detectClusterMetadata: di.inject(detectClusterMetadataInjectable),
        loadProxyKubeconfig: di.inject(loadProxyKubeconfigInjectable, cluster),
        removeProxyKubeconfig: di.inject(removeProxyKubeconfigInjectable, cluster),
        requestApiResources: di.inject(requestApiResourcesInjectable),
        createAuthorizationApi: di.inject(createAuthorizationApiInjectable),
        createCoreApi: di.inject(createCoreApiInjectable),
        createCanI: di.inject(createCanIInjectable),
        createRequestNamespaceListPermissions: di.inject(createRequestNamespaceListPermissionsInjectable),
        visibleCluster: di.inject(visibleClusterInjectable),
      },
      cluster,
    ),
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, cluster: Cluster) => cluster.id,
  }),
});

export default clusterConnectionInjectable;
