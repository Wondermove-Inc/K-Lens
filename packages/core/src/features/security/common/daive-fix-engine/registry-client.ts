/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: 컨테이너 레지스트리 태그 조회 API 추상화
 *
 * Docker Hub, ghcr.io, quay.io, ECR, GCR, ACR, 일반 OCI v2 레지스트리를
 * 동일한 인터페이스로 다루기 위한 추상화 레이어.
 *
 * HTTP 호출은 Main Process에서 실행.
 * Renderer → Main IPC를 통해 결과 수신.
 * 에어갭 환경 처리는에서.
 *
 * @packageDocumentation
 */

import type { ParsedImageRef } from "./cve-image-grouper";

// ============================================
// Types
// ============================================

export interface RegistryTag {
  /** 태그 이름 (예: "16-alpine", "v1.7.2", "latest") */
  tag: string;
  /** 최종 업데이트 시간 ISO 8601 (있으면) */
  lastUpdated?: string;
  /** 이미지 다이제스트 sha256:... (있으면) */
  digest?: string;
}

export interface RegistryAuthConfig {
  /**
   * Docker config.json 형식 credential
   * key: 레지스트리 호스트 (docker.io, ghcr.io, ...)
   */
  auths?: Record<string, { username?: string; password?: string; auth?: string }>;
}

export interface RegistryListTagsOptions {
  /** HTTP 요청 타임아웃 ms (기본 10_000) */
  timeoutMs?: number;
  /** 가져올 최대 태그 수 (기본 100, Docker Hub pagination 제한) */
  maxTags?: number;
}

/** suggestUpgradeTag 결과 */
export interface RegistryClientOptions {
  /** 동시 태그 조회 수 (기본: 5) */
  concurrency?: number;
  /** Docker Hub 429 등 rate limit 자동 재시도 여부 (기본: true) */
  rateLimitHandling?: boolean;
  /** rate limit 재시도 대기 ms (기본: 60000 = 1분) */
  rateLimitRetryMs?: number;
}

export interface UpgradeSuggestion {
  /** 추천 태그 */
  tag: RegistryTag;
  /** 업그레이드 유형 */
  upgradeType: "patch" | "minor" | "suffix-version";
  /** 현재 태그 */
  currentTag: string;
}

// ============================================
// RegistryClient 인터페이스
// ============================================

export interface RegistryClient {
  /**
   * 이미지의 사용 가능한 태그 목록 조회.
   *
   * @param parsed   - parseImageRef() 결과
   * @param auth     - 인증 정보 (없으면 anonymous)
   * @param options  - timeout 등
   * @returns 태그 목록 (최신순 정렬 시도) 또는 null (접근 불가/에러)
   */
  listTags(
    parsed: ParsedImageRef,
    auth?: RegistryAuthConfig,
    options?: RegistryListTagsOptions,
  ): Promise<RegistryTag[] | null>;

  /**
   * 현재 태그 기준으로 업그레이드 후보 태그 추천.
   *
   * 규칙:
   * - semver 태그 (v1.2.3, 1.2.3): 동일 major에서 minor/patch 업그레이드만 추천
   * - suffix 패턴 (16-alpine, 8-jre-slim): 동일 suffix에서 상위 버전
   * - "latest": 추천 불가 → null
   * - 알 수 없는 패턴: null
   *
   * @param parsed   - 현재 이미지 정보
   * @param allTags  - listTags() 결과
   * @returns 업그레이드 제안 또는 null
   */
  suggestUpgradeTag(parsed: ParsedImageRef, allTags: RegistryTag[]): UpgradeSuggestion | null;
}

// ============================================
// semver 파싱 유틸
// ============================================

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** v1.2.3-alpine → suffix="-alpine" */
  suffix: string;
  /** 원본 태그 */
  raw: string;
}

/**
 * 태그에서 semver 파싱 시도.
 * "v" prefix 허용. patch 생략 허용 (1.2 → 1.2.0).
 * 매칭 실패 시 null.
 */
function parseSemVer(tag: string): SemVer | null {
  // v1.2.3-suffix, 1.2.3, 1.2, v1.2
  const m = tag.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?([-+].*)?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1] ?? "0", 10),
    minor: parseInt(m[2] ?? "0", 10),
    patch: parseInt(m[3] ?? "0", 10),
    suffix: m[4] ?? "",
    raw: tag,
  };
}

/**
 * semver 비교: a > b → 양수, a < b → 음수, a === b → 0
 */
function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * "16-alpine", "8-jre-slim" 같은 suffix 패턴 파싱.
 * 앞부분 숫자 = version, 나머지 = suffix.
 * "16-alpine" → { version: 16, suffix: "-alpine" }
 */
interface SuffixPattern {
  version: number;
  suffix: string;
  raw: string;
}

function parseSuffixPattern(tag: string): SuffixPattern | null {
  const m = tag.match(/^(\d+)([-.].*)?$/);
  if (!m) return null;
  const version = parseInt(m[1] ?? "0", 10);
  if (isNaN(version)) return null;
  return { version, suffix: m[2] ?? "", raw: tag };
}

// ============================================
// suggestUpgradeTag (순수 함수 — 공유 로직)
// ============================================

/**
 * 현재 태그에서 업그레이드 후보를 결정하는 순수 함수.
 * DefaultRegistryClient.suggestUpgradeTag와 동일한 로직을 외부에서도 사용 가능.
 */
export function suggestUpgradeTagFn(currentTag: string, allTags: RegistryTag[]): UpgradeSuggestion | null {
  if (currentTag === "latest" || currentTag === "") return null;

  const currentSemVer = parseSemVer(currentTag);

  // 1. semver 패턴 (v1.2.3, 1.2.3 등)
  if (currentSemVer) {
    const candidates: Array<{ sv: SemVer; tag: RegistryTag }> = [];

    for (const t of allTags) {
      const sv = parseSemVer(t.tag);
      if (!sv) continue;
      // 동일 major + 동일 suffix (suffix 있으면 strict 매칭)
      if (sv.major !== currentSemVer.major) continue;
      if (sv.suffix !== currentSemVer.suffix) continue;
      if (compareSemVer(sv, currentSemVer) <= 0) continue; // 현재 이하 제외
      candidates.push({ sv, tag: t });
    }

    if (candidates.length === 0) return null;

    // 가장 높은 버전 선택
    candidates.sort((a, b) => compareSemVer(b.sv, a.sv));
    const best = candidates[0]!;
    const upgradeType: "patch" | "minor" = best.sv.minor === currentSemVer.minor ? "patch" : "minor";

    return { tag: best.tag, upgradeType, currentTag };
  }

  // 2. suffix 패턴 (16-alpine, 8-jre-slim 등)
  const currentSuffix = parseSuffixPattern(currentTag);
  if (currentSuffix) {
    const candidates: Array<{ sp: SuffixPattern; tag: RegistryTag }> = [];

    for (const t of allTags) {
      const sp = parseSuffixPattern(t.tag);
      if (!sp) continue;
      // 동일 suffix (예: "-alpine")만
      if (sp.suffix !== currentSuffix.suffix) continue;
      if (sp.version <= currentSuffix.version) continue;
      candidates.push({ sp, tag: t });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.sp.version - a.sp.version);
    const best = candidates[0]!;
    return { tag: best.tag, upgradeType: "suffix-version", currentTag };
  }

  return null;
}

// ============================================
// DefaultRegistryClient
// ============================================

/**
 * 레지스트리 종류 판별
 */
type RegistryKind = "dockerhub" | "ecr" | "oci-v2";

function detectRegistryKind(registry: string): RegistryKind {
  if (registry === "docker.io") return "dockerhub";
  // ECR: *.dkr.ecr.*.amazonaws.com
  if (/^\d+\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com$/.test(registry)) return "ecr";
  // ghcr.io, quay.io, gcr.io, azurecr.io, Harbor 등 → OCI Distribution Spec v2
  return "oci-v2";
}

/**
 * Docker Hub Bearer Token 교환 URL
 */
const DOCKERHUB_AUTH_URL = "https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull";
const DOCKERHUB_TAGS_URL = "https://registry.hub.docker.com/v2/repositories/{repo}/tags?page_size={pageSize}";
const OCI_V2_TAGS_URL = "https://{registry}/v2/{repo}/tags/list";

/**
 * DefaultRegistryClient: RegistryClient 기본 구현.
 *
 * HTTP 호출 예시 (Main Process에서):
 * ```ts
 * const client = new DefaultRegistryClient();
 * const tags = await client.listTags(parsedRef, auth, { timeoutMs: 10_000 });
 * const suggestion = client.suggestUpgradeTag(parsedRef, tags ?? []);
 * ```
 *
 * 에러 처리 정책:
 * - 네트워크 에러, 인증 실패, 404 → null 반환 (throw 안 함)
 * - 파싱 에러 → null 반환
 */
export class DefaultRegistryClient implements RegistryClient {
  async listTags(
    parsed: ParsedImageRef,
    auth?: RegistryAuthConfig,
    options?: RegistryListTagsOptions,
  ): Promise<RegistryTag[] | null> {
    const timeoutMs = options?.timeoutMs ?? 10_000;
    const maxTags = options?.maxTags ?? 100;
    const kind = detectRegistryKind(parsed.registry);

    try {
      switch (kind) {
        case "dockerhub":
          return await this._listDockerHubTags(parsed, auth, timeoutMs, maxTags);
        case "ecr":
          return await this._listEcrTags(parsed, auth, timeoutMs, maxTags);
        case "oci-v2":
        default:
          return await this._listOciV2Tags(parsed, auth, timeoutMs);
      }
    } catch {
      // 네트워크 에러, 인증 실패 등 → null
      return null;
    }
  }

  suggestUpgradeTag(parsed: ParsedImageRef, allTags: RegistryTag[]): UpgradeSuggestion | null {
    return suggestUpgradeTagFn(parsed.tag, allTags);
  }

  // ── Docker Hub ────────────────────────────────────────────────

  private async _listDockerHubTags(
    parsed: ParsedImageRef,
    _auth: RegistryAuthConfig | undefined,
    timeoutMs: number,
    maxTags: number,
  ): Promise<RegistryTag[] | null> {
    // Docker Hub v2 API: https://registry.hub.docker.com/v2/repositories/{repo}/tags
    // repo 형식: "library/nginx" or "org/app"
    const url = DOCKERHUB_TAGS_URL.replace("{repo}", parsed.repository).replace(
      "{pageSize}",
      String(Math.min(maxTags, 100)),
    );

    const res = await this._fetch(url, {}, timeoutMs);
    if (!res) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = res as any;
    if (!Array.isArray(data?.results)) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results as any[]).map((t: any) => ({
      tag: String(t.name ?? ""),
      lastUpdated: t.last_updated as string | undefined,
      digest: t.digest as string | undefined,
    }));
  }

  // ── ECR ───────────────────────────────────────────────────────

  private async _listEcrTags(
    parsed: ParsedImageRef,
    _auth: RegistryAuthConfig | undefined,
    timeoutMs: number,
    _maxTags: number,
  ): Promise<RegistryTag[] | null> {
    // ECR: Bearer Token은 `aws ecr get-login-password`로 교환 후 OCI v2 API 호출.
    // Main Process에서 aws-sdk / AWS CLI를 사용하여 토큰 교환 후 이 함수를 호출.
    // 현재 구현: anonymous OCI v2 시도 (Private ECR는 인증 필요 → null 반환)
    return await this._listOciV2Tags(parsed, _auth, timeoutMs);
  }

  // ── OCI Distribution Spec v2 ──────────────────────────────────

  private async _listOciV2Tags(
    parsed: ParsedImageRef,
    auth: RegistryAuthConfig | undefined,
    timeoutMs: number,
  ): Promise<RegistryTag[] | null> {
    const url = OCI_V2_TAGS_URL.replace("{registry}", parsed.registry).replace("{repo}", parsed.repository);

    console.log(
      `[RegistryClient._listOciV2Tags] url=${url}, registry=${parsed.registry}, repo=${parsed.repository}, timeout=${timeoutMs}`,
    );

    // Bearer Token 교환 (www-authenticate 헤더 기반)
    const headers: Record<string, string> = {};
    const cred = auth?.auths?.[parsed.registry];
    if (cred?.username && cred.password) {
      const encoded = Buffer.from(`${cred.username}:${cred.password}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    } else if (cred?.auth) {
      headers["Authorization"] = `Basic ${cred.auth}`;
    }

    const res = await this._fetch(url, headers, timeoutMs);
    if (!res) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = res as any;
    if (!Array.isArray(data?.tags)) return null;

    return (data.tags as string[]).map((tag) => ({ tag }));
  }

  // ── HTTP 헬퍼 (Main Process에서 실행) ─────────────────────────

  /**
   * JSON fetch 헬퍼.
   * AbortController로 timeout 처리.
   * 에러 시 null 반환.
   */
  private async _fetch(url: string, headers: Record<string, string>, timeoutMs: number): Promise<unknown | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal,
      });
      console.log(`[RegistryClient._fetch] url=${url.slice(0, 100)}, status=${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ============================================
// listTagsBatch (병렬 태그 조회 + rate limit 처리)
// ============================================

/**
 * 여러 이미지의 태그 목록을 concurrency 제한 하에 병렬 조회.
 *
 * - Docker Hub 429 (rate limit) → rateLimitRetryMs 대기 후 1회 재시도
 * - 실패 → null 반환 (cve_report_only fallback)
 *
 * @param client  - RegistryClient 구현체
 * @param images  - 조회할 ParsedImageRef 목록 (중복 제거된 상태)
 * @param auth    - 레지스트리 인증 정보
 * @param options - concurrency / rateLimitHandling / rateLimitRetryMs
 * @returns Map<imageUri, RegistryTag[] | null>
 *          imageUri 키는 registry + "/" + repository + ":" + tag 형식
 */
export async function listTagsBatch(
  client: RegistryClient,
  images: import("./cve-image-grouper").ParsedImageRef[],
  auth?: RegistryAuthConfig,
  options?: RegistryClientOptions,
): Promise<Map<string, RegistryTag[] | null>> {
  if (images.length === 0) return new Map();

  const concurrency = options?.concurrency ?? 5;
  const rateLimitHandling = options?.rateLimitHandling ?? true;
  const rateLimitRetryMs = options?.rateLimitRetryMs ?? 60_000;

  const result = new Map<string, RegistryTag[] | null>();
  let activeSlots = 0;
  let idx = 0;

  /** 이미지 URI 키 생성 */
  const toKey = (p: import("./cve-image-grouper").ParsedImageRef): string => `${p.registry}/${p.repository}:${p.tag}`;

  /** 단일 이미지 태그 조회 (rate limit 재시도 포함) */
  const fetchWithRetry = async (
    parsed: import("./cve-image-grouper").ParsedImageRef,
  ): Promise<RegistryTag[] | null> => {
    const tags = await client.listTags(parsed, auth);
    if (tags !== null) return tags;

    // rate limit 처리: listTags가 null 반환하면 원인을 알 수 없으므로,
    // rateLimitHandling=true이면 한 번 더 시도 (지수 백오프 없이 단순 1회)
    if (rateLimitHandling) {
      await new Promise<void>((r) => setTimeout(r, rateLimitRetryMs));
      return await client.listTags(parsed, auth);
    }
    return null;
  };

  await new Promise<void>((resolve) => {
    const tryNext = (): void => {
      if (idx >= images.length && activeSlots === 0) {
        resolve();
        return;
      }

      while (activeSlots < concurrency && idx < images.length) {
        const parsed = images[idx++]!;
        const key = toKey(parsed);
        activeSlots++;

        fetchWithRetry(parsed)
          .then((tags) => {
            result.set(key, tags);
          })
          .catch(() => {
            result.set(key, null);
          })
          .finally(() => {
            activeSlots--;
            tryNext();
          });
      }

      if (idx >= images.length && activeSlots === 0) {
        resolve();
      }
    };

    tryNext();
  });

  return result;
}

// ============================================
// 팩토리
// ============================================

/** 싱글턴 인스턴스 (Main Process에서 공유) */
let _defaultClient: DefaultRegistryClient | null = null;

export function getRegistryClient(): RegistryClient {
  _defaultClient ??= new DefaultRegistryClient();
  return _defaultClient;
}

// ============================================
// DOCKERHUB_AUTH_URL export (테스트용)
// ============================================

export { DOCKERHUB_AUTH_URL, DOCKERHUB_TAGS_URL, OCI_V2_TAGS_URL };
