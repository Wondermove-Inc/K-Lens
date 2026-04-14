/**
 * 🎯 목적: Kubernetes 리소스 Fetcher 훅
 * 실제 Kubernetes API를 통해 멘션 제안용 리소스를 가져옵니다.
 *
 * 📝 주의사항:
 * - kubectlExecuteChannel을 통해 IPC로 리소스 조회
 * - 캐싱으로 성능 최적화
 * - 에러 처리 및 로딩 상태 관리
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (실제 API 연결)
 *
 * @packageDocumentation
 */

import { ipcRenderer } from "electron";
import { useCallback, useRef, useState } from "react";
import { ContextType, type ContextTypeValue } from "../../../features/ai-assistant/common/context-types";
import {
  type KubectlExecuteArgs,
  type KubectlExecuteResponse,
  kubectlExecuteChannel,
} from "../../../features/ai-assistant/common/kubectl-execute-channel";

import type { MentionSuggestion } from "./mention-autocomplete";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 캐시 엔트리
 */
interface CacheEntry {
  data: MentionSuggestion[];
  timestamp: number;
}

// ============================================
// 🎯 상수 정의
// ============================================

/** 캐시 유효 시간 (30초) */
const CACHE_TTL_MS = 30 * 1000;

/** 지원되는 리소스 타입 매핑 */
const KIND_TO_CONTEXT_TYPE: Record<string, ContextTypeValue> = {
  Pod: ContextType.POD,
  Deployment: ContextType.DEPLOYMENT,
  Service: ContextType.SERVICE,
  ConfigMap: ContextType.CONFIGMAP,
  Secret: ContextType.SECRET,
  Namespace: ContextType.NAMESPACE,
  Node: ContextType.NODE,
  PersistentVolumeClaim: ContextType.PVC,
  StatefulSet: ContextType.STATEFULSET,
  DaemonSet: ContextType.DAEMONSET,
  ReplicaSet: ContextType.REPLICASET,
  Job: ContextType.JOB,
  CronJob: ContextType.CRONJOB,
  Ingress: ContextType.INGRESS,
};

// ============================================
// 🎯 훅 구현
// ============================================

/**
 * useKubernetesResourceFetcher 훅
 *
 * 📝 기능:
 * - kubectl을 통해 Kubernetes 리소스 목록 조회
 * - 캐싱으로 성능 최적화
 * - MentionSuggestion 형식으로 변환
 *
 * @param clusterId - 클러스터 ID
 * @param namespace - 네임스페이스 (선택, 없으면 전체 네임스페이스)
 * @returns fetcher 함수와 상태
 */
export function useKubernetesResourceFetcher(clusterId: string | undefined, namespace?: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * 🎯 리소스 조회 함수
   *
   * @param typeFilter - 타입 필터 (pod, deployment 등)
   * @returns MentionSuggestion 배열
   */
  const fetchResources = useCallback(
    async (typeFilter?: string): Promise<MentionSuggestion[]> => {
      if (!clusterId) {
        console.log("[KubeResourceFetcher] 클러스터 ID 없음, 빈 배열 반환");
        return [];
      }

      // 🎯 캐시 키 생성
      const cacheKey = `${clusterId}:${namespace ?? "all"}:${typeFilter ?? "all"}`;

      // 🎯 캐시 확인
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log("[KubeResourceFetcher] 캐시 히트:", cacheKey);
        return cached.data;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 🎯 조회할 리소스 타입 결정
        const resourceTypes = typeFilter ? [typeFilter] : ["pods", "deployments", "services", "configmaps", "secrets"];

        const allSuggestions: MentionSuggestion[] = [];

        // 🎯 각 리소스 타입별로 경량 조회 (대규모 클러스터 대응)
        // -o json은 전체 spec/status를 포함해 대규모 클러스터에서 100K Hard Limit 초과 가능
        // custom-columns로 필요한 필드(kind, name, namespace, uid)만 조회
        const CUSTOM_COLS =
          "custom-columns=KIND:.kind,NAME:.metadata.name,NAMESPACE:.metadata.namespace,UID:.metadata.uid";

        for (const resourceType of resourceTypes) {
          const args: KubectlExecuteArgs = {
            clusterId,
            command: "get",
            args: namespace
              ? [resourceType, "-n", namespace, "-o", CUSTOM_COLS, "--no-headers"]
              : [resourceType, "--all-namespaces", "-o", CUSTOM_COLS, "--no-headers"],
            skipTruncation: true,
          };

          console.log("[KubeResourceFetcher] kubectl 실행:", args);

          const response = (await ipcRenderer.invoke(kubectlExecuteChannel.id, args)) as KubectlExecuteResponse;

          if (response.callWasSuccessful && response.response.success) {
            // custom-columns 출력 파싱: "KIND  NAME  NAMESPACE  UID" (2+공백 구분)
            const lines = response.response.stdout.trim().split("\n").filter(Boolean);

            for (const line of lines) {
              const parts = line.trim().split(/\s{2,}/);

              if (parts.length >= 4) {
                const [kind, name, ns, uid] = parts;
                const contextType = KIND_TO_CONTEXT_TYPE[kind];

                if (contextType && name && uid) {
                  allSuggestions.push({
                    id: uid,
                    type: contextType,
                    name,
                    namespace: ns === "<none>" ? undefined : ns,
                  });
                }
              }
            }
          } else {
            console.warn("[KubeResourceFetcher] kubectl 실행 실패:", response);
          }
        }

        // 🎯 캐시 저장
        cacheRef.current.set(cacheKey, {
          data: allSuggestions,
          timestamp: Date.now(),
        });

        console.log(`[KubeResourceFetcher] ${allSuggestions.length}개 리소스 로드 완료`);
        return allSuggestions;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[KubeResourceFetcher] 에러:", error);
        setError(error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [clusterId, namespace],
  );

  /**
   * 🎯 캐시 무효화 함수
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    console.log("[KubeResourceFetcher] 캐시 클리어");
  }, []);

  return {
    fetchResources,
    isLoading,
    error,
    clearCache,
  };
}
