/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import {
  Bell,
  Box,
  Briefcase,
  Calendar,
  Cog,
  Copy,
  Cpu,
  Crown,
  Database,
  FolderTree,
  Forward,
  Gauge,
  Grid3x3,
  HardDrive,
  KeyRound,
  Layers,
  Layers2,
  LayoutDashboard,
  Link,
  Link2,
  MapPin,
  Network,
  PenSquare,
  PieChart,
  Rocket,
  ScrollText,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SquareChartGantt,
  Timer,
  UserCog,
  Users,
  Waypoints,
  Workflow,
} from "lucide-react";
import React from "react";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";
import navigateInjectable from "../../navigation/navigate.injectable";
import mainTabStoreInjectable from "./main-tab-store.injectable";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { Navigate } from "../../navigation/navigate.injectable";
import type { CreateMainTabOptions } from "./main-tab.model";
import type { MainTabStore } from "./main-tab-store";

/**
 * 🎯 목적: 사이드바 아이템 클릭 시 새로운 탭을 생성하고 활성화하는 기능 제공
 *
 * @description
 * - 사이드바 클릭 시 기존 navigate 동작을 탭 생성으로 확장
 * - 중복 탭 방지 및 기존 탭 활성화
 * - 라우트 이동과 탭 생성을 동시에 처리
 *
 * 📝 주의사항:
 * - 동일한 route에 대해서는 새 탭을 생성하지 않고 기존 탭 활성화
 * - navigate 호출도 함께 수행하여 라우터 상태 동기화
 *
 * 🔄 변경이력:
 * - 2025-09-25 - 초기 생성 (사이드바 탭 생성 기능)
 * - 2025-10-26 - Route 매핑 테이블 방식으로 icon name 추출 (production build 안정성)
 */

/**
 * 🎯 Route → Icon Name 매핑 테이블
 *
 * @description
 * - production build에서 React element의 type.name이 minified되는 문제 해결
 * - route 기반으로 icon name을 직접 매핑 (100% 신뢰도)
 * - lucide-react icon name을 string으로 저장하여 localStorage 직렬화 가능
 *
 * 📝 주의사항:
 * - Icon name은 lucide-react의 정확한 export name이어야 함 (예: "Server", "Box", "Layers")
 * - 새로운 route 추가 시 이 매핑 테이블에도 추가 필요
 *
 * 🔄 유지보수:
 * - sidebar-item.injectable.tsx 파일 추가 시 여기에 route 매핑 추가
 */
const ROUTE_ICON_MAP: Record<string, string> = {
  // 🎯 Main Categories (Top-level)
  "/overview": "Server", // Cluster Overview
  "/namespaces": "Layers", // Namespaces
  "/events": "Bell", // Events

  // 📦 Workloads
  "/workloads": "Workflow", // Workloads (parent)
  "/pods": "Workflow", // Pods
  "/deployments": "Workflow", // Deployments
  "/statefulsets": "Workflow", // StatefulSets
  "/daemonsets": "Workflow", // DaemonSets
  "/jobs": "Workflow", // Jobs
  "/cronjobs": "Workflow", // CronJobs
  "/replicasets": "Workflow", // ReplicaSets
  "/replication-controllers": "Workflow", // Replication Controllers

  // 🛡️ Network
  "/services": "Waypoints", // Services
  "/ingresses": "Waypoints", // Ingresses
  "/network-policies": "Waypoints", // Network Policies
  "/endpoints": "Waypoints", // Endpoints
  "/endpoint-slices": "Waypoints", // Endpoint Slices
  "/ingress-classes": "Waypoints", // Ingress Classes
  "/port-forwards": "Waypoints", // Port Forwards (with params)

  // 💾 Storage
  "/storage-classes": "HardDrive", // Storage Classes
  "/persistent-volumes": "HardDrive", // Persistent Volumes
  "/persistent-volume-claims": "HardDrive", // PVCs

  // ⚙️ Config
  "/configmaps": "Cog", // Config Maps
  "/secrets": "Cog", // Secrets
  "/resourcequotas": "Cog", // Resource Quotas
  "/limitranges": "Cog", // Limit Ranges
  "/hpa": "Cog", // Horizontal Pod Autoscalers
  "/vpa": "Cog", // Vertical Pod Autoscalers
  "/poddisruptionbudgets": "Cog", // Pod Disruption Budgets
  "/priorityclasses": "Cog", // Priority Classes
  "/runtimeclasses": "Cog", // Runtime Classes
  "/leases": "Cog", // Leases
  "/validatingwebhookconfigurations": "Cog", // Validating Webhook Configurations
  "/mutatingwebhookconfigurations": "Cog", // Mutating Webhook Configurations

  // 👥 User Management (Access Control)
  "/roles": "Users", // Roles
  "/role-bindings": "Users", // Role Bindings
  "/cluster-roles": "Users", // Cluster Roles
  "/cluster-role-bindings": "Users", // Cluster Role Bindings
  "/service-accounts": "Users", // Service Accounts
  "/pod-security-policies": "Users", // Pod Security Policies

  // 🔧 Other
  "/nodes": "Layers2", // Nodes
  "/crd": "Briefcase", // Custom Resources (with params)
  "/helm/charts": "SquareChartGantt", // Helm Charts (with params)
  "/helm/releases": "SquareChartGantt", // Helm Releases (with params)
};

/**
 * 🔄 Material Design → lucide-react Icon 매핑 테이블 (레거시 지원)
 *
 * @description
 * - localStorage에 저장된 레거시 Material Design icon names를 lucide-react icons로 자동 변환
 * - 앱 재시작 시에도 올바른 아이콘 표시 보장
 * - Phase 1에서 변환한 Material Design icons의 fallback 메커니즘
 *
 * 📝 매핑 규칙:
 * - 의미상 가장 유사한 lucide-react icon으로 매핑
 * - Phase 1에서 변환한 icon names와 동일하게 유지
 */
const MD_TO_LUCIDE_ICON_MAP: Record<string, string> = {
  // Material Design → lucide-react 매핑
  key: "KeyRound", // Secrets
  view_module: "Grid3x3", // Endpoint Slices
  place: "MapPin", // Endpoints
  security: "ShieldCheck", // Network Policies
  forward: "Forward", // Port Forwarding
  router: "Network", // Services
  request_page: "ScrollText", // Persistent Volume Claims
  storage: "HardDrive", // Persistent Volumes
  rocket_launch: "Rocket", // Deployments
  work: "Briefcase", // Jobs
  widgets: "Box", // Pods
  settings: "Settings", // Replication Controllers
  data_object: "Database", // StatefulSets
  content_copy: "Copy", // ReplicaSets
  shield: "Shield", // DaemonSets
  schedule: "Calendar", // CronJobs
};

/**
 * 🎨 lucide-react Icon Component Map (Production Build 안정성)
 *
 * @description
 * - Named import한 icon component들을 이름으로 lookup할 수 있도록 매핑
 * - `import * as LucideIcons`의 dynamic import 문제 해결
 * - Webpack tree-shaking에 안전한 방식
 */
const ICON_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  Bell,
  Box,
  Briefcase,
  Calendar,
  Cog,
  Copy,
  Cpu,
  Crown,
  Database,
  FolderTree,
  Forward,
  Gauge,
  Grid3x3,
  HardDrive,
  KeyRound,
  Layers,
  Layers2,
  LayoutDashboard,
  Link,
  Link2,
  MapPin,
  Network,
  PenSquare,
  PieChart,
  Rocket,
  ScrollText,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SquareChartGantt,
  Timer,
  UserCog,
  Users,
  Waypoints,
  Workflow,
};

export interface CreateMainTab {
  (options: CreateMainTabOptions): void;
}

interface Dependencies {
  mainTabStore: MainTabStore;
  navigate: Navigate;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
}

const createMainTabInjectable = getInjectable({
  id: "create-main-tab",

  instantiate: (di): CreateMainTab => {
    const { mainTabStore, navigate, activeKubernetesCluster }: Dependencies = {
      mainTabStore: di.inject(mainTabStoreInjectable),
      navigate: di.inject(navigateInjectable),
      activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
    };

    return (options: CreateMainTabOptions) => {
      // 🎯 현재 활성 클러스터 ID 자동 감지
      const activeCluster = activeKubernetesCluster.get();
      const clusterId = options.clusterId || activeCluster?.getId();

      // 🎨 자동 icon 감지: iconComponent가 제공되지 않은 경우
      let iconComponent = options.iconComponent;
      let icon = options.icon;

      if (!iconComponent) {
        // 🎯 Icon name 우선순위: options.icon → ROUTE_ICON_MAP[route] → "Server"
        if (!icon) {
          icon = ROUTE_ICON_MAP[options.route] ?? "Server";
        }

        // 🔄 Material Design → lucide-react 자동 변환 (레거시 지원)
        if (MD_TO_LUCIDE_ICON_MAP[icon]) {
          icon = MD_TO_LUCIDE_ICON_MAP[icon];
        }

        // 🎨 Icon Component Map에서 icon component 가져오기 (Production Build 안정성)
        const IconComponent = ICON_COMPONENT_MAP[icon];
        if (IconComponent) {
          iconComponent = React.createElement(IconComponent, { className: "h-4 w-4" });
        } else {
          // 🚫 Icon을 찾지 못한 경우 fallback
          console.warn("[Tab Icon] Icon component not found, using Server fallback. Icon name:", icon);
          iconComponent = React.createElement(Server, { className: "h-4 w-4" });
        }
      }

      // 🎯 Split 활성 시 현재 포커스된 그룹에 탭 추가
      const targetGroupId = mainTabStore.activeGroup?.id ?? "left";

      // 🎯 탭 생성 (중복 시 기존 탭 활성화) - clusterId, icon name, iconComponent 포함
      const tab = mainTabStore.createTab(
        {
          ...options,
          clusterId, // 클러스터 정보 자동 저장
          icon, // 🏷️ Icon name (string) - localStorage 저장용
          iconComponent, // 🎨 자동 감지된 icon component (React element)
        },
        targetGroupId,
      );

      // 🔄 라우트 이동으로 UI 상태 동기화
      navigate(tab.route);

      // 🧹 자동 정리: 기존 TabLayout 시스템 비활성화
      // 📝 참고: reactive 처리로 자동 동작 (siblingTabsInjectable에서 빈 배열 반환)
      // - MainTab 생성 시 mainTabStore.hasTabs = true
      // - siblingTabsInjectable에서 감지하여 기존 탭 목록 빈 배열로 반환
      // - SiblingsInTabLayout에서 조건부 렌더링으로 기존 TabLayout 숨김

      // 💡 추가 개선 사항: 기존 TabLayout의 활성 상태 정리
      // 향후 필요시 여기서 기존 사이드바 활성 상태 초기화 로직 추가 가능
    };
  },
});

export default createMainTabInjectable;
