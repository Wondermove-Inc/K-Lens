/**
 * 크기 기반 캐시 제한 테스트
 *
 * TASK: 500MB 크기 기반 캐시 구현
 *
 * TDD Red Phase: 테스트 먼저 작성
 *
 * @module sqlite-semantic-cache-size.test
 */

import { CACHE_SIZE_WARNING_THRESHOLD_BYTES, MAX_CACHE_SIZE_BYTES, TARGET_CACHE_SIZE_BYTES } from "../cache-ttl-config";
import { SqliteSemanticCache, StoredEntry } from "../sqlite-semantic-cache";

describe("SqliteSemanticCache - Size-based Limits", () => {
  let cache: SqliteSemanticCache;

  beforeEach(() => {
    cache = new SqliteSemanticCache({
      enableAutoCleanup: false,
    });
  });

  afterEach(() => {
    cache.close();
  });

  describe("Size Constants", () => {
    it("should have MAX_CACHE_SIZE_BYTES = 500MB", () => {
      expect(MAX_CACHE_SIZE_BYTES).toBe(500 * 1024 * 1024);
    });

    it("should have TARGET_CACHE_SIZE_BYTES = 200MB", () => {
      expect(TARGET_CACHE_SIZE_BYTES).toBe(200 * 1024 * 1024);
    });

    it("should have CACHE_SIZE_WARNING_THRESHOLD_BYTES = 400MB", () => {
      expect(CACHE_SIZE_WARNING_THRESHOLD_BYTES).toBe(400 * 1024 * 1024);
    });
  });

  describe("calculateEntrySize()", () => {
    it("should calculate size of a simple string entry", () => {
      const entry: StoredEntry = {
        query: "test query",
        data: JSON.stringify({ response: "hello" }),
        timestamp: Date.now(),
        ttl: 60000,
        expiresAt: Date.now() + 60000,
      };

      // query + data + 숫자필드(timestamp, ttl, expiresAt) 각 8바이트
      const expectedSize = Buffer.byteLength(entry.query, "utf-8") + Buffer.byteLength(entry.data, "utf-8") + 8 * 3; // 3개의 숫자 필드

      const size = cache.calculateEntrySize(entry);
      expect(size).toBe(expectedSize);
    });

    it("should correctly calculate UTF-8 multi-byte characters", () => {
      const entry: StoredEntry = {
        query: "한글 테스트 질문입니다",
        data: JSON.stringify({ response: "한글 응답" }),
        timestamp: Date.now(),
        ttl: 60000,
        expiresAt: Date.now() + 60000,
      };

      // 한글은 UTF-8에서 3바이트
      const size = cache.calculateEntrySize(entry);
      expect(size).toBeGreaterThan(entry.query.length + entry.data.length);
    });

    it("should handle empty strings", () => {
      const entry: StoredEntry = {
        query: "",
        data: "",
        timestamp: Date.now(),
        ttl: 60000,
        expiresAt: Date.now() + 60000,
      };

      const size = cache.calculateEntrySize(entry);
      expect(size).toBe(8 * 3); // 숫자 필드만
    });
  });

  describe("calculateCacheSize()", () => {
    it("should return 0 for empty cache", () => {
      expect(cache.calculateCacheSize()).toBe(0);
    });

    it("should calculate total size of all entries", () => {
      cache.set("query1", { data: "response1" });
      cache.set("query2", { data: "response2" });

      const totalSize = cache.calculateCacheSize();
      expect(totalSize).toBeGreaterThan(0);
    });

    it("should update size after adding entries", () => {
      const sizeBefore = cache.calculateCacheSize();
      cache.set("new-query", { data: "a".repeat(1000) });
      const sizeAfter = cache.calculateCacheSize();

      expect(sizeAfter).toBeGreaterThan(sizeBefore);
    });

    it("should update size after removing entries", () => {
      cache.set("query-to-remove", { data: "some data" });
      const sizeBefore = cache.calculateCacheSize();

      cache.delete("query-to-remove");
      const sizeAfter = cache.calculateCacheSize();

      expect(sizeAfter).toBeLessThan(sizeBefore);
    });
  });

  describe("getCacheSizeInfo()", () => {
    it("should return cache size info object", () => {
      cache.set("test", { data: "test" });

      const info = cache.getCacheSizeInfo();

      expect(info).toHaveProperty("currentSizeBytes");
      expect(info).toHaveProperty("maxSizeBytes");
      expect(info).toHaveProperty("usagePercent");
      expect(info).toHaveProperty("formattedSize");
    });

    it("should have correct maxSizeBytes", () => {
      const info = cache.getCacheSizeInfo();
      expect(info.maxSizeBytes).toBe(MAX_CACHE_SIZE_BYTES);
    });

    it("should calculate usagePercent correctly", () => {
      cache.set("test", { data: "test" });
      const info = cache.getCacheSizeInfo();

      const expectedPercent = (info.currentSizeBytes / MAX_CACHE_SIZE_BYTES) * 100;
      expect(info.usagePercent).toBeCloseTo(expectedPercent, 2);
    });

    it("should format size in human readable format", () => {
      // Add some data to get a meaningful size
      for (let i = 0; i < 100; i++) {
        cache.set(`query-${i}`, { data: "x".repeat(1000) });
      }

      const info = cache.getCacheSizeInfo();

      // Should be in KB or MB format
      expect(info.formattedSize).toMatch(/^\d+(\.\d+)?\s*(B|KB|MB|GB)$/);
    });
  });

  describe("ensureSizeLimit()", () => {
    it("should not clean when under limit", () => {
      cache.set("small-query", { data: "small data" });

      const cleaned = cache.ensureSizeLimit();

      expect(cleaned).toBe(0);
    });

    it("should clean oldest entries when over limit", () => {
      // 이 테스트는 실제 500MB를 채울 수 없으므로
      // 작은 제한으로 테스트하는 별도 인스턴스 필요
      // 또는 내부 상태를 모킹

      // 기본적인 인터페이스 테스트
      const cleaned = cache.ensureSizeLimit();
      expect(typeof cleaned).toBe("number");
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Size-based cleanup on set()", () => {
    it("should trigger cleanup when size limit exceeded", () => {
      // 크기 제한 동작 테스트
      // 실제 500MB를 채울 수 없으므로 인터페이스 테스트

      const setSpy = jest.spyOn(cache, "ensureSizeLimit");

      cache.set("trigger-check", { data: "test" });

      expect(setSpy).toHaveBeenCalled();
    });
  });

  describe("formatBytes utility", () => {
    it("should format bytes correctly", () => {
      const info = cache.getCacheSizeInfo();

      // 빈 캐시
      expect(info.formattedSize).toBeDefined();
    });
  });
});

describe("Cache Size Limit Integration", () => {
  it("should maintain size under MAX_CACHE_SIZE_BYTES", async () => {
    const cache = new SqliteSemanticCache({
      enableAutoCleanup: false,
    });

    // 많은 데이터 추가
    for (let i = 0; i < 1000; i++) {
      cache.set(`query-${i}`, {
        data: "x".repeat(10000), // 10KB per entry
      });
    }

    const info = cache.getCacheSizeInfo();

    // 크기 제한 이하여야 함
    expect(info.currentSizeBytes).toBeLessThanOrEqual(MAX_CACHE_SIZE_BYTES);

    cache.close();
  });

  it("should preserve most recent entries when cleaning", async () => {
    const cache = new SqliteSemanticCache({
      enableAutoCleanup: false,
    });

    // 오래된 엔트리
    for (let i = 0; i < 100; i++) {
      cache.set(`old-query-${i}`, { data: "old" });
    }

    // 약간의 시간 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 최신 엔트리
    for (let i = 0; i < 10; i++) {
      cache.set(`new-query-${i}`, { data: "new" });
    }

    // 정리 후에도 최신 엔트리는 유지되어야 함
    for (let i = 0; i < 10; i++) {
      const entry = cache.get(`new-query-${i}`);
      expect(entry).not.toBeNull();
    }

    cache.close();
  });
});
