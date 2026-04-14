/**
 * 캐시 TTL 설정
 *
 * SQLite 캐시 엔진 구현
 *
 * 리소스 타입별 캐시 TTL과 자동 정리 주기를 정의합니다.
 *
 * @module cache-ttl-config
 */

/**
 * 캐시 정리 주기 (밀리초)
 *
 * 1시간마다 만료된 엔트리를 자동으로 정리합니다.
 */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1시간

/**
 * 기본 캐시 TTL (밀리초)
 *
 * 리소스 타입이 정의되지 않은 경우 사용하는 기본 TTL입니다.
 */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 최대 캐시 엔트리 수 (레거시, 하위 호환성 유지)
 *
 * @deprecated MAX_CACHE_SIZE_BYTES 사용 권장
 */
export const MAX_CACHE_ENTRIES = 10000;

/**
 * 캐시 만료 경고 임계값 (비율)
 *
 * 캐시 크기가 이 비율을 초과하면 경고 로그를 출력합니다.
 *
 * @deprecated CACHE_SIZE_WARNING_THRESHOLD_BYTES 사용 권장
 */
export const CACHE_SIZE_WARNING_THRESHOLD = 0.8; // 80%

/**
 * 최대 캐시 크기 (바이트)
 *
 * 500MB - Electron 앱에서 적절한 크기
 * 이 크기를 초과하면 TARGET_CACHE_SIZE_BYTES까지 정리합니다.
 */
export const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

/**
 * 목표 캐시 크기 (바이트)
 *
 * 200MB - 정리 후 목표 크기
 * MAX_CACHE_SIZE_BYTES 초과 시 이 크기까지 정리합니다.
 */
export const TARGET_CACHE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

/**
 * 캐시 크기 경고 임계값 (바이트)
 *
 * 400MB - 이 크기 초과 시 경고 로그 출력
 */
export const CACHE_SIZE_WARNING_THRESHOLD_BYTES = 400 * 1024 * 1024; // 400MB

/**
 * 시맨틱 캐시 TTL 설정
 *
 * 질문 유형별로 차등 TTL을 적용합니다.
 */
export const SEMANTIC_CACHE_TTL: Record<string, number> = {
  /**
   * 클러스터 정보 관련 질문
   * - 비교적 정적인 정보
   * - 10분 TTL
   */
  cluster_info: 10 * 60 * 1000,

  /**
   * 리소스 목록 조회
   * - 자주 변경될 수 있음
   * - 2분 TTL
   */
  resource_list: 2 * 60 * 1000,

  /**
   * 리소스 상세 조회
   * - 상태 변화 빈번
   * - 1분 TTL
   */
  resource_detail: 1 * 60 * 1000,

  /**
   * 일반 도움말/정보
   * - 거의 변경 없음
   * - 1시간 TTL
   */
  help: 60 * 60 * 1000,

  /**
   * 기본값
   */
  default: DEFAULT_CACHE_TTL_MS,
};

/**
 * 질문 유형 판별
 *
 * 사용자 질문을 분석하여 캐시 TTL 유형을 결정합니다.
 *
 * @param query 사용자 질문
 * @returns 캐시 TTL 유형
 */
export function determineQueryType(query: string): keyof typeof SEMANTIC_CACHE_TTL {
  const lowerQuery = query.toLowerCase();

  // 클러스터 정보 관련
  if (
    lowerQuery.includes("클러스터") ||
    lowerQuery.includes("cluster") ||
    lowerQuery.includes("버전") ||
    lowerQuery.includes("version")
  ) {
    return "cluster_info";
  }

  // 리소스 목록 조회
  if (
    lowerQuery.includes("목록") ||
    lowerQuery.includes("list") ||
    lowerQuery.includes("보여줘") ||
    lowerQuery.includes("조회")
  ) {
    return "resource_list";
  }

  // 리소스 상세 조회
  if (
    lowerQuery.includes("상세") ||
    lowerQuery.includes("describe") ||
    lowerQuery.includes("detail") ||
    lowerQuery.includes("정보")
  ) {
    return "resource_detail";
  }

  // 도움말
  if (
    lowerQuery.includes("도움말") ||
    lowerQuery.includes("help") ||
    lowerQuery.includes("사용법") ||
    lowerQuery.includes("how to")
  ) {
    return "help";
  }

  return "default";
}

/**
 * 질문에 대한 TTL 조회
 *
 * @param query 사용자 질문
 * @returns TTL (밀리초)
 */
export function getTtlForQuery(query: string): number {
  const queryType = determineQueryType(query);
  return SEMANTIC_CACHE_TTL[queryType];
}
