/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import Joi from "joi";

/**
 * JSON serializable metadata type
 */
export type ClusterMetadata = Record<string, string | number | boolean | object>;

/**
 * Metadata for cluster's prometheus settings
 */
export interface ClusterPrometheusMetadata {
  success?: boolean;
  provider?: string;
  autoDetected?: boolean;
}

/**
 * A ClusterId is an opaque string
 */
export type ClusterId = string;

/**
 * The fields that are used for updating a cluster instance
 */
export type UpdateClusterModel = Omit<ClusterModel, "id">;

/**
 * A type validator for `UpdateClusterModel` so that only expected types are present
 */
export const updateClusterModelChecker = Joi.object<UpdateClusterModel>({
  kubeConfigPath: Joi.string().required().min(1),
  contextName: Joi.string().required().min(1),
  preferences: Joi.object(),
  metadata: Joi.object(),
  accessibleNamespaces: Joi.array().items(Joi.string()),
  labels: Joi.object().pattern(Joi.string(), Joi.string()),
});

/**
 * A type validator for just the `id` fields of `ClusterModel`. The rest is
 * covered by `updateClusterModelChecker`
 */
export const clusterModelIdChecker = Joi.object<Pick<ClusterModel, "id">>({
  id: Joi.string().required().min(1),
});

/**
 * The model for passing cluster data around, including to disk
 */
export interface ClusterModel {
  /** Unique id for a cluster */
  id: ClusterId;

  /** Path to cluster kubeconfig */
  kubeConfigPath: string;

  /** User context in kubeconfig  */
  contextName: string;

  /** Preferences */
  preferences?: ClusterPreferences;

  /** Metadata */
  metadata?: ClusterMetadata;

  /** List of accessible namespaces */
  accessibleNamespaces?: string[];

  /**
   * Labels for the catalog entity
   */
  labels?: Partial<Record<string, string>>;
}

/**
 * This data is retreived from the kubeconfig file before calling the cluster constructor.
 *
 * That is done to remove the external dependency on the construction of Cluster instances.
 */
export interface ClusterConfigData {
  clusterServerUrl: string;
}

/**
 * The complete set of cluster settings or preferences
 */
export interface ClusterPreferences extends ClusterPrometheusPreferences {
  terminalCWD?: string;
  clusterName?: string;
  iconOrder?: number;
  /**
   * The <img> src for the cluster. If set to `null` that means that it was
   * cleared by preferences.
   */
  icon?: string | null;
  httpsProxy?: string;
  hiddenMetrics?: string[];
  nodeShellImage?: string;
  nodeShellWindowsImage?: string;
  imagePullSecret?: string;
  defaultNamespace?: string;
}

/**
 * 🎯 목적: 메트릭 소스 타입 정의
 * - "metrics-server": Kubernetes 기본 Metrics Server 사용 (기본값)
 * - "prometheus": 외부 Prometheus 서버 사용
 */
export type MetricsSourceType = "metrics-server" | "prometheus";

/**
 * 🎯 목적: 클러스터의 Prometheus/메트릭 설정 (클러스터 설정의 일부)
 *
 * 📝 주의사항:
 * - metricsSource가 없으면 "metrics-server"를 기본값으로 사용
 * - prometheusProvider는 deprecated됨 (마이그레이션용으로만 유지)
 *
 * 🔄 변경이력: 2026-01-09 - 단순화 리팩토링 (9가지 옵션 → 2가지)
 */
export interface ClusterPrometheusPreferences {
  /**
   * 메트릭 소스 타입
   * @default "metrics-server"
   */
  metricsSource?: MetricsSourceType;

  /**
   * Prometheus 엔드포인트 설정 (metricsSource가 "prometheus"일 때 사용)
   */
  prometheus?: {
    namespace: string;
    service: string;
    port: number;
    prefix: string;
    /** When true, add "https:" prefix to service proxy path */
    https?: boolean;
  };

  /**
   * @deprecated 마이그레이션용 - 새로운 설정에서는 metricsSource 사용
   * 기존 설정 로드 시 자동으로 metricsSource로 변환됨
   */
  prometheusProvider?: {
    type: string;
  };

  filesystemMountpoints?: string;
}

/**
 * The options for the status of connection attempts to a cluster
 */
export enum ClusterStatus {
  AccessGranted = 2,
  AccessDenied = 1,
  Offline = 0,
}

/**
 * The message format for the "cluster:<cluster-id>:connection-update" channels
 */
export interface KubeAuthUpdate {
  message: string;
  level: "info" | "warning" | "error";
}

/**
 * The OpenLens known static metadata keys
 */
export enum ClusterMetadataKey {
  VERSION = "version",
  CLUSTER_ID = "id",
  DISTRIBUTION = "distribution",
  NODES_COUNT = "nodes",
  LAST_SEEN = "lastSeen",
  PROMETHEUS = "prometheus",
  /**
   * 관리형 쿠버네티스 클러스터 여부 (EKS, GKE, AKS, NKS 등)
   * true: Control Plane이 클라우드 제공업체에 의해 관리됨 (Master 노드 없음)
   * false: 자체 관리형 클러스터 (Master 노드 존재)
   */
  IS_MANAGED = "isManaged",
}

/**
 * A shorthand enum for resource types that have metrics attached to them via OpenLens metrics stack
 */
export enum ClusterMetricsResourceType {
  Cluster = "Cluster",
  Node = "Node",
  Pod = "Pod",
  Deployment = "Deployment",
  StatefulSet = "StatefulSet",
  Container = "Container",
  Ingress = "Ingress",
  VolumeClaim = "PersistentVolumeClaim",
  ReplicaSet = "ReplicaSet",
  DaemonSet = "DaemonSet",
  Job = "Job",
  Namespace = "Namespace",
}

/**
 * The default filesystem mountpoints for metrics
 */
export const initialFilesystemMountpoints = "/|/local";

/**
 * The default node shell image
 */
export const initialNodeShellImage = "docker.io/library/alpine";

/**
 * The default node shell image for Windows
 */
export const initialNodeShellWindowsImage = "mcr.microsoft.com/powershell";

/**
 * The data representing a cluster's state, for passing between main and renderer
 */
export interface ClusterState {
  online: boolean;
  disconnected: boolean;
  accessible: boolean;
  ready: boolean;
  isAdmin: boolean;
  allowedNamespaces: string[];
  resourcesToShow: string[];
  isGlobalWatchEnabled: boolean;
}
