/**
 * 캐시 타입 정의
 *
 * 세션 캐시와 SQLite 캐시에서 공통으로 사용하는 타입을 정의합니다.
 *
 * @module cache-types
 */

/**
 * 캐시 엔트리 인터페이스
 *
 * @template T 캐시된 데이터의 타입
 */
export interface CacheEntry<T = unknown> {
  /**
   * 캐시된 데이터
   */
  data: T;

  /**
   * 캐시 생성 시각 (Unix timestamp, ms)
   */
  timestamp: number;

  /**
   * TTL (Time To Live, ms)
   */
  ttl: number;

  /**
   * 경과 시간을 사람이 읽을 수 있는 형식으로 반환
   *
   * @returns "5초 전", "1분 전", "1시간 전" 등
   */
  getAgeString: () => string;
}

/**
 * 캐시 통계 인터페이스
 */
export interface CacheStats {
  /**
   * 캐시 히트 횟수
   */
  hits: number;

  /**
   * 캐시 미스 횟수
   */
  misses: number;

  /**
   * 현재 캐시된 엔트리 개수
   */
  size: number;

  /**
   * 캐시 히트율 (0.0 ~ 1.0)
   */
  hitRate: number;
}

/**
 * 리소스별 TTL 설정 (밀리초)
 *
 * 리소스 타입에 따라 상태 변화 빈도가 다르므로 차등 TTL 적용
 */
export const TTL_CONFIG: Record<string, number> = {
  /**
   * Pod: 30초
   * - 상태 변화 빈번 (Running → CrashLoopBackOff 등)
   * - 재시작 카운트 실시간 변화
   */
  Pod: 30 * 1000,

  /**
   * Event: 1분
   * - 실시간 모니터링 필수
   * - Warning/Normal 이벤트 지속 발생
   */
  Event: 60 * 1000,

  /**
   * Deployment: 5분
   * - 상태 변화 중간
   * - ReplicaSet 업데이트 빈도 낮음
   */
  Deployment: 5 * 60 * 1000,

  /**
   * ReplicaSet: 5분
   */
  ReplicaSet: 5 * 60 * 1000,

  /**
   * StatefulSet: 5분
   */
  StatefulSet: 5 * 60 * 1000,

  /**
   * DaemonSet: 5분
   */
  DaemonSet: 5 * 60 * 1000,

  /**
   * Service: 10분
   * - 상태 변화 드묾
   * - ClusterIP/NodePort 거의 고정
   */
  Service: 10 * 60 * 1000,

  /**
   * Node: 5분
   * - Ready/NotReady 변화 중간
   */
  Node: 5 * 60 * 1000,

  /**
   * Namespace: 10분
   * - 상태 변화 거의 없음
   */
  Namespace: 10 * 60 * 1000,

  /**
   * ConfigMap: 1시간
   * - 거의 정적 (수동 업데이트만)
   */
  ConfigMap: 60 * 60 * 1000,

  /**
   * Secret: 1시간
   * - 거의 정적 (수동 업데이트만)
   */
  Secret: 60 * 60 * 1000,
};

/**
 * 기본 TTL (리소스 타입이 정의되지 않은 경우)
 */
export const DEFAULT_TTL = 5 * 60 * 1000; // 5분
