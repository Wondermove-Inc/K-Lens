import hostedClusterIdInjectable from "../cluster-frame-context/hosted-cluster-id.injectable";
import matchedClusterIdInjectable from "./matched-cluster-id.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

/**
 * 🎯 목적: 클러스터 컨텍스트 키 계산을 중앙화하여 keyedSingleton 간 불일치 방지
 */
export const getCurrentClusterKey = (di: DiContainerForInjection): string => {
  const matchedClusterId = di.inject(matchedClusterIdInjectable)?.get?.();
  const hostedClusterId = di.inject(hostedClusterIdInjectable);

  // NOTE: matchedClusterId를 우선 사용해 root/cluster 프레임 간 키 일관성 확보
  return matchedClusterId ?? hostedClusterId ?? "no-cluster";
};
