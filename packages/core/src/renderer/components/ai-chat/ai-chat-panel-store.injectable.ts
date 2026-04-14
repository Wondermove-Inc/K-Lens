/**
 * 🎯 목적: AI Chat Panel Store를 DI 컨테이너에 등록하는 Injectable
 *
 * DI 패턴:
 * - getInjectable로 Store 인스턴스를 생성
 * - Storage를 inject하여 의존성 주입
 * - 싱글톤으로 관리됨
 *
 * 📝 Extension Host 패턴 (2025-12-16):
 * - DaiveAgentOrchestrator 대신 AgentIPCClient 사용
 * - 모든 Agent 실행은 Main Process에서 처리
 * - Renderer는 IPC를 통해 요청만 전송하고 결과를 수신
 *
 * 📝 2026-01-17: DAIVE Root Frame Migration
 * - keyedSingleton → singleton 변경 (Root Frame에서 전역 관리)
 * - hostedClusterInjectable 의존성 제거
 * - clustersInjectable, activeKubernetesClusterInjectable 추가
 * - 다중 클러스터 선택 지원
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { computed } from "mobx";
import aiChatPanelStorageInjectable from "./ai-chat-panel-storage.injectable";
import { AIChatPanelStore, HITL_LEVEL_OPTIONS } from "./ai-chat-panel-store";

import type { ClusterInfo } from "./ai-chat-panel-store";
export { HITL_LEVEL_OPTIONS };

import agentIPCClientInjectable from "../../../features/ai-assistant/renderer/agent-ipc-client.injectable";
// 🆕 2026-01-17: 다중 클러스터 지원을 위한 Injectable 추가
import clustersInjectable from "../../../features/cluster/storage/common/clusters.injectable";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import encryptApiKeyInjectable from "../../../features/user-preferences/renderer/encrypt-api-key.injectable";
import activeEntityIdInjectable from "../../api/catalog/entity/active-entity-id.injectable";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";

const aiChatPanelStoreInjectable = getInjectable({
  id: "ai-chat-panel-store",

  instantiate: (di) => {
    // 🎯 목적: Storage, User Preferences, 암호화 서비스, AgentIPCClient를 inject하여 Store 인스턴스 생성
    // 📝 Extension Host 패턴: AgentIPCClient를 통해 Main Process의 AgentHost와 통신
    // 📝 2025-12-17: activeEntityId 추가 (Agent 컨텍스트 주입용)
    // 📝 2026-01-17: DAIVE Root Frame Migration - 다중 클러스터 지원

    // 🆕 연결된 클러스터 목록 (Root Frame에서 접근 가능)
    // 📝 Cluster 타입: id는 직접 접근, name은 .get() 메서드, 연결상태는 accessible/disconnected
    // 📝 2026-01-18: Issue 2 - 중복 클러스터 제거 (Set으로 ID 기반 dedup)
    const clusters = di.inject(clustersInjectable);
    const connectedClusters = computed((): ClusterInfo[] => {
      const seen = new Set<string>();
      return clusters
        .get()
        .filter((c) => c.accessible.get() && !c.disconnected.get())
        .filter((c) => {
          // 중복 ID 제거 (같은 클러스터가 여러 번 표시되는 것 방지)
          if (seen.has(c.id)) {
            return false;
          }
          seen.add(c.id);
          return true;
        })
        .map((c) => ({
          id: c.id,
          name: c.name.get(),
          isConnected: c.accessible.get() && !c.disconnected.get(),
        }));
    });

    // 🆕 현재 활성 클러스터 (자동 선택용)
    const activeClusterEntity = di.inject(activeKubernetesClusterInjectable);
    const activeKubernetesCluster = computed((): ClusterInfo | undefined => {
      const entity = activeClusterEntity.get();
      if (!entity) return undefined;
      return {
        id: entity.getId(),
        name: entity.getName(),
        isConnected: true,
      };
    });

    // 🆕 선택된 네임스페이스 저장소 (fallback 지원)
    // 📝 Root Frame에서는 hostedCluster가 없을 수 있으므로 빈 배열 반환하는 fallback 제공
    const selectedNamespacesStorage = {
      get(): string[] {
        // 📝 Root Frame에서는 기본적으로 빈 배열 (모든 네임스페이스)
        // 실제 네임스페이스 선택은 클러스터 선택 후 동적으로 처리
        return [];
      },
    };

    return new AIChatPanelStore({
      storage: di.inject(aiChatPanelStorageInjectable),
      userPreferencesState: di.inject(userPreferencesStateInjectable),
      encryptService: di.inject(encryptApiKeyInjectable),
      agentIPCClient: di.inject(agentIPCClientInjectable),
      activeEntityId: di.inject(activeEntityIdInjectable),
      selectedNamespacesStorage,
      // 🆕 2026-01-17: 다중 클러스터 지원 의존성 추가
      connectedClusters,
      activeKubernetesCluster,
    });
  },

  // 🆕 2026-01-17: 전역 싱글톤으로 변경 (Root Frame에서 단일 인스턴스 관리)
  // 📝 AS-IS: keyedSingleton (클러스터별 인스턴스)
  // 📝 TO-BE: singleton (전역 단일 인스턴스)
  lifecycle: lifecycleEnum.singleton,
});

export default aiChatPanelStoreInjectable;
