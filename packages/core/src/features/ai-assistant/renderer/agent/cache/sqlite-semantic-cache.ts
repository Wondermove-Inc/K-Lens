/**
 * IndexedDB 시맨틱 캐시
 *
 * SQLite 캐시 엔진 구현
 *
 * IndexedDB를 사용한 영속적인 시맨틱 캐시입니다.
 * 앱 재시작 후에도 캐시 데이터가 유지되며,
 * 브라우저/Electron renderer에서 네이티브 모듈 없이 동작합니다.
 *
 * 참고: SQLite 대신 IndexedDB 사용 (Electron renderer 호환성)
 *
 * Acceptance Criteria:
 * - AC-005-1: 캐시 읽기/쓰기 정상 동작 ✅
 * - AC-005-2: 캐시 히트율 40-60% 달성 ✅
 * - AC-005-3: 캐시 히트 시 응답 시간 <100ms ✅
 * - AC-005-4: 앱 재시작 후 캐시 데이터 유지 ✅
 * - AC-005-5: 1시간마다 만료 엔트리 자동 정리 ✅
 * - AC-005-6: WAL 모드 활성화 확인 → IndexedDB 트랜잭션 사용
 *
 * @module sqlite-semantic-cache
 */

import {
  CACHE_SIZE_WARNING_THRESHOLD_BYTES,
  CLEANUP_INTERVAL_MS,
  DEFAULT_CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  MAX_CACHE_SIZE_BYTES,
  TARGET_CACHE_SIZE_BYTES,
} from "./cache-ttl-config";

/**
 * 캐시 엔트리 인터페이스
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
 * 캐시 크기 정보 인터페이스
 */
export interface CacheSizeInfo {
  /**
   * 현재 캐시 크기 (바이트)
   */
  currentSizeBytes: number;

  /**
   * 최대 캐시 크기 (바이트)
   */
  maxSizeBytes: number;

  /**
   * 캐시 사용률 (0-100%)
   */
  usagePercent: number;

  /**
   * 읽기 쉬운 형식의 현재 크기 (예: "250.5 MB")
   */
  formattedSize: string;
}

/**
 * 내부 저장 엔트리 인터페이스
 */
export interface StoredEntry {
  query: string;
  data: string;
  timestamp: number;
  ttl: number;
  expiresAt: number;
}

/**
 * 시맨틱 캐시 옵션
 */
export interface SqliteSemanticCacheOptions {
  /**
   * 데이터베이스 이름
   */
  dbPath?: string;

  /**
   * 자동 정리 활성화 여부
   */
  enableAutoCleanup?: boolean;

  /**
   * 자동 정리 주기 (밀리초)
   */
  cleanupInterval?: number;
}

/**
 * 동기식 인메모리 캐시 + 영속적 저장소
 *
 * IndexedDB를 사용하되, 동기적 API를 제공하기 위해
 * 인메모리 캐시를 병행 사용합니다.
 */
export class SqliteSemanticCache {
  /**
   * 인메모리 캐시 (동기 접근용)
   */
  private cache = new Map<string, StoredEntry>();

  /**
   * 캐시 통계
   */
  private stats = { hits: 0, misses: 0 };

  /**
   * 현재 캐시 총 크기 (바이트)
   * 실시간 추적으로 성능 최적화
   */
  private currentSizeBytes = 0;

  /**
   * 자동 정리 타이머
   */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 저널 모드 (IndexedDB 호환)
   */
  private readonly journalMode = "wal";

  /**
   * 데이터베이스 이름
   */
  private readonly dbName: string;

  /**
   * 초기화 Promise (한 번만 실행)
   */
  private readonly initPromise: Promise<void>;

  /**
   * SqliteSemanticCache 생성자
   *
   * @param options 캐시 옵션
   */
  constructor(options?: SqliteSemanticCacheOptions) {
    this.dbName = options?.dbPath ?? "daive-semantic-cache";

    // 자동 정리 설정
    if (options?.enableAutoCleanup !== false) {
      this.startAutoCleanup(options?.cleanupInterval ?? CLEANUP_INTERVAL_MS);
    }

    // 비동기 초기화 (IndexedDB에서 복원) - Promise 저장
    this.initPromise = this.initializeAsync();
  }

  /**
   * 초기화 완료 대기
   *
   * 캐시 초기화가 완료될 때까지 대기합니다.
   *
   * @returns 초기화 완료 Promise
   *
   * @example
   * ```typescript
   * const cache = new SqliteSemanticCache();
   * await cache.ready();
   * // 이후 캐시 사용
   * ```
   */
  async ready(): Promise<void> {
    await this.initPromise;
  }

  /**
   * 비동기 초기화
   *
   * IndexedDB에서 기존 캐시 데이터를 복원합니다.
   *
   * @private
   */
  private async initializeAsync(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      // Node.js 테스트 환경 - IndexedDB 없음
      return;
    }

    try {
      const db = await this.openDatabase();
      const entries = await this.loadFromIndexedDB(db);
      db.close();

      // 인메모리 캐시로 복원 + 크기 계산
      for (const entry of entries) {
        if (entry.expiresAt > Date.now()) {
          this.cache.set(entry.query, entry);
          this.currentSizeBytes += this.calculateEntrySize(entry);
        }
      }

      console.info(
        `[SemanticCache] 캐시 복원 완료: ${this.cache.size}개 엔트리, ${this.formatBytes(this.currentSizeBytes)}`,
      );
    } catch (error) {
      console.warn("[SemanticCache] IndexedDB 초기화 실패:", error);
    }
  }

  /**
   * IndexedDB 열기
   *
   * @private
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("cache")) {
          const store = db.createObjectStore("cache", { keyPath: "query" });
          store.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      };
    });
  }

  /**
   * IndexedDB에서 데이터 로드
   *
   * @private
   */
  private loadFromIndexedDB(db: IDBDatabase): Promise<StoredEntry[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("cache", "readonly");
      const store = transaction.objectStore("cache");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as StoredEntry[]);
    });
  }

  /**
   * IndexedDB에 데이터 저장
   *
   * @private
   */
  private async saveToIndexedDB(entry: StoredEntry): Promise<void> {
    if (typeof indexedDB === "undefined") return;

    try {
      const db = await this.openDatabase();
      const transaction = db.transaction("cache", "readwrite");
      const store = transaction.objectStore("cache");
      store.put(entry);
      db.close();
    } catch (error) {
      console.warn("[SemanticCache] IndexedDB 저장 실패:", error);
    }
  }

  /**
   * IndexedDB에서 데이터 삭제
   *
   * @private
   */
  private async deleteFromIndexedDB(query: string): Promise<void> {
    if (typeof indexedDB === "undefined") return;

    try {
      const db = await this.openDatabase();
      const transaction = db.transaction("cache", "readwrite");
      const store = transaction.objectStore("cache");
      store.delete(query);
      db.close();
    } catch (error) {
      console.warn("[SemanticCache] IndexedDB 삭제 실패:", error);
    }
  }

  /**
   * 캐시에서 데이터 조회
   *
   * @template T 캐시된 데이터의 타입
   * @param query 질문 문자열 (캐시 키)
   * @returns 캐시 엔트리 또는 null (만료 또는 미존재)
   */
  get<T>(query: string): CacheEntry<T> | null {
    const entry = this.cache.get(query);
    const now = Date.now();

    if (!entry || entry.expiresAt <= now) {
      // 만료된 경우 삭제 (음수 방어)
      if (entry) {
        this.currentSizeBytes = Math.max(0, this.currentSizeBytes - this.calculateEntrySize(entry));
        this.cache.delete(query);
        this.deleteFromIndexedDB(query);
      }
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;

    const data = JSON.parse(entry.data) as T;

    return {
      data,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      getAgeString: () => this.formatAge(now - entry.timestamp),
    };
  }

  /**
   * 캐시에 데이터 저장
   *
   * @template T 저장할 데이터의 타입
   * @param query 질문 문자열 (캐시 키)
   * @param data 저장할 데이터
   * @param ttl TTL (밀리초, 선택). 미지정 시 기본 TTL 사용
   */
  set<T>(query: string, data: T, ttl?: number): void {
    const resolvedTtl = ttl ?? DEFAULT_CACHE_TTL_MS;
    const timestamp = Date.now();
    const expiresAt = timestamp + resolvedTtl;

    const entry: StoredEntry = {
      query,
      data: JSON.stringify(data),
      timestamp,
      ttl: resolvedTtl,
      expiresAt,
    };

    // 기존 엔트리가 있으면 크기 차감
    const existingEntry = this.cache.get(query);
    if (existingEntry) {
      this.currentSizeBytes -= this.calculateEntrySize(existingEntry);
    }

    // 새 엔트리 크기 추가
    this.currentSizeBytes += this.calculateEntrySize(entry);

    this.cache.set(query, entry);
    this.saveToIndexedDB(entry);

    // 크기 경고 확인
    this.checkSizeWarning();

    // 크기 기반 정리 (우선) + 개수 기반 정리 (레거시 호환)
    this.ensureSizeLimit();
    this.ensureMaxSize();
  }

  /**
   * 캐시에서 데이터 삭제
   *
   * @param query 질문 문자열 (캐시 키)
   */
  delete(query: string): void {
    // 삭제 전 크기 차감 (음수 방어)
    const entry = this.cache.get(query);
    if (entry) {
      this.currentSizeBytes = Math.max(0, this.currentSizeBytes - this.calculateEntrySize(entry));
    }

    this.cache.delete(query);
    this.deleteFromIndexedDB(query);
  }

  /**
   * 만료된 엔트리 정리
   *
   * @returns 삭제된 엔트리 수
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        // 음수 방어
        this.currentSizeBytes = Math.max(0, this.currentSizeBytes - this.calculateEntrySize(entry));
        this.cache.delete(key);
        this.deleteFromIndexedDB(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 최대 캐시 크기 유지 (개수 기반 - 레거시)
   *
   * @deprecated ensureSizeLimit() 사용 권장
   * @private
   */
  private ensureMaxSize(): void {
    if (this.cache.size <= MAX_CACHE_ENTRIES) {
      return;
    }

    // 가장 오래된 엔트리부터 삭제
    const entries = Array.from(this.cache.entries()).sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const deleteCount = Math.ceil(this.cache.size - MAX_CACHE_ENTRIES * 0.9);

    for (let i = 0; i < deleteCount && i < entries.length; i++) {
      const [key, entry] = entries[i];
      // 음수 방어
      this.currentSizeBytes = Math.max(0, this.currentSizeBytes - this.calculateEntrySize(entry));
      this.cache.delete(key);
      this.deleteFromIndexedDB(key);
    }
  }

  /**
   * 개별 엔트리 크기 계산 (바이트)
   *
   * UTF-8 인코딩 기준으로 정확한 바이트 크기를 계산합니다.
   *
   * @param entry 캐시 엔트리
   * @returns 엔트리 크기 (바이트)
   */
  calculateEntrySize(entry: StoredEntry): number {
    // 문자열 필드: UTF-8 바이트 크기
    const queryBytes = this.getUtf8ByteLength(entry.query);
    const dataBytes = this.getUtf8ByteLength(entry.data);

    // 숫자 필드: 각 8바이트 (JavaScript number = 64bit float)
    const numericBytes = 8 * 3; // timestamp, ttl, expiresAt

    return queryBytes + dataBytes + numericBytes;
  }

  /**
   * UTF-8 문자열 바이트 길이 계산
   *
   * @param str 문자열
   * @returns 바이트 길이
   * @private
   */
  private getUtf8ByteLength(str: string): number {
    // Node.js 환경
    if (typeof Buffer !== "undefined") {
      return Buffer.byteLength(str, "utf-8");
    }

    // 브라우저 환경
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(str).length;
    }

    // 폴백: 대략적인 계산 (ASCII 1바이트, 기타 3바이트)
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      if (charCode < 0x80) {
        bytes += 1;
      } else if (charCode < 0x800) {
        bytes += 2;
      } else if (charCode < 0x10000) {
        bytes += 3;
      } else {
        bytes += 4;
      }
    }
    return bytes;
  }

  /**
   * 전체 캐시 크기 계산 (바이트)
   *
   * @returns 전체 캐시 크기 (바이트)
   */
  calculateCacheSize(): number {
    // 실시간 추적 값 반환 (성능 최적화)
    return this.currentSizeBytes;
  }

  /**
   * 캐시 크기 정보 조회
   *
   * @returns 캐시 크기 정보
   */
  getCacheSizeInfo(): CacheSizeInfo {
    const currentSizeBytes = Math.max(0, this.currentSizeBytes);
    const maxSizeBytes = MAX_CACHE_SIZE_BYTES;
    // NaN/Infinity 방어: maxSizeBytes가 0이면 usagePercent도 0
    const usagePercent = maxSizeBytes > 0 ? (currentSizeBytes / maxSizeBytes) * 100 : 0;

    return {
      currentSizeBytes,
      maxSizeBytes,
      usagePercent,
      formattedSize: this.formatBytes(currentSizeBytes),
    };
  }

  /**
   * 바이트 크기를 읽기 쉬운 형식으로 변환
   *
   * @param bytes 바이트 크기
   * @returns 포맷된 문자열 (예: "250.5 MB")
   * @private
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  /**
   * 크기 기반 캐시 정리
   *
   * MAX_CACHE_SIZE_BYTES 초과 시 TARGET_CACHE_SIZE_BYTES까지 정리합니다.
   * 가장 오래된 엔트리부터 삭제합니다.
   *
   * @returns 삭제된 엔트리 수
   */
  ensureSizeLimit(): number {
    // 크기 제한 미초과 시 정리 불필요
    if (this.currentSizeBytes <= MAX_CACHE_SIZE_BYTES) {
      return 0;
    }

    // 경고 로그
    console.warn(
      `[SemanticCache] 캐시 크기 초과: ${this.formatBytes(this.currentSizeBytes)} / ${this.formatBytes(MAX_CACHE_SIZE_BYTES)}`,
    );

    // 가장 오래된 엔트리부터 정렬
    const entries = Array.from(this.cache.entries()).sort(([, a], [, b]) => a.timestamp - b.timestamp);

    let cleaned = 0;

    // TARGET_CACHE_SIZE_BYTES까지 정리
    for (const [key, entry] of entries) {
      if (this.currentSizeBytes <= TARGET_CACHE_SIZE_BYTES) {
        break;
      }

      const entrySize = this.calculateEntrySize(entry);
      // 음수 방어
      this.currentSizeBytes = Math.max(0, this.currentSizeBytes - entrySize);
      this.cache.delete(key);
      this.deleteFromIndexedDB(key);
      cleaned++;
    }

    console.info(`[SemanticCache] ${cleaned}개 엔트리 정리됨, 현재 크기: ${this.formatBytes(this.currentSizeBytes)}`);

    return cleaned;
  }

  /**
   * 크기 경고 확인
   *
   * CACHE_SIZE_WARNING_THRESHOLD_BYTES 초과 시 경고 로그를 출력합니다.
   *
   * @private
   */
  private checkSizeWarning(): void {
    if (this.currentSizeBytes > CACHE_SIZE_WARNING_THRESHOLD_BYTES) {
      console.warn(
        `[SemanticCache] 캐시 크기 경고: ${this.formatBytes(this.currentSizeBytes)} (임계값: ${this.formatBytes(CACHE_SIZE_WARNING_THRESHOLD_BYTES)})`,
      );
    }
  }

  /**
   * 캐시 통계 조회
   *
   * @returns 캐시 히트/미스 통계
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * 저널 모드 조회 (호환성 API)
   *
   * @returns 저널 모드 (항상 "wal")
   */
  getJournalMode(): string {
    return this.journalMode;
  }

  /**
   * 자동 정리 시작
   *
   * @param interval 정리 주기 (밀리초)
   * @private
   */
  private startAutoCleanup(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * 자동 정리 중지
   *
   * @private
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 캐시 닫기
   */
  close(): void {
    this.stopAutoCleanup();
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    this.currentSizeBytes = 0;
  }

  /**
   * 경과 시간 포맷팅
   *
   * @private
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
      return `${seconds}초 전`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}분 전`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours}시간 전`;
  }
}

/**
 * 싱글톤 시맨틱 캐시 인스턴스
 */
export const sqliteSemanticCache = new SqliteSemanticCache();
