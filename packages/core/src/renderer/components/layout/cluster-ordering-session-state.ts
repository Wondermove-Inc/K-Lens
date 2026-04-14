interface ClusterOrderingSessionState {
  hasInitializedOrder: boolean;
  hasInitializedHistory: boolean;
  order: string[];
  connectionHistory: Map<string, boolean>;
}

/**
 * 🎯 목적: 클러스터 사이드바 정렬 상태를 렌더러 세션 전역에서 공유
 * 📝 컴포넌트가 remount 되어도 cold start 정렬 결과가 유지되도록 메모리에 저장
 */
export const clusterOrderingSessionState: ClusterOrderingSessionState = {
  hasInitializedOrder: false,
  hasInitializedHistory: false,
  order: [],
  connectionHistory: new Map<string, boolean>(),
};

export const syncClusterOrderSnapshot = (order: string[]) => {
  clusterOrderingSessionState.order = order;
};

export const markClusterOrderInitialized = () => {
  clusterOrderingSessionState.hasInitializedOrder = true;
};

export const resetClusterHistorySessionState = () => {
  clusterOrderingSessionState.connectionHistory.clear();
  clusterOrderingSessionState.hasInitializedHistory = false;
};

export const markClusterHistoryInitialized = () => {
  clusterOrderingSessionState.hasInitializedHistory = true;
};
