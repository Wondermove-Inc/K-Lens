/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI 파일 시스템 Safe Zone 유틸리티
 *
 * AI Assistant가 파일 작업을 수행할 때 필요한 보안 검증 및 경로 처리 유틸리티
 *
 * 📋 주요 기능:
 * - Safe Zone 경로 검증 (symlink 해결, path traversal 차단)
 * - 파일 작업 정책 확인 (읽기/쓰기 권한)
 * - 클러스터 이름 sanitize (폴더명 안전 변환)
 * - 파일명 타임스탬프 추가
 *
 * 🔒 보안 고려사항:
 * - symlink를 통한 Safe Zone 탈출 방지
 * - Windows 대소문자 무시 처리
 * - path.sep을 사용한 정확한 경로 비교
 *
 * 🔄 변경이력:
 * - 2026-01-29: 초기 생성 (AI File System Integration)
 */

import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { AI_ALLOWED_EXTENSIONS } from "../common/ai-file-channels";

import type { AIFileErrorCode } from "../common/ai-file-channels";

// ============================================
// 🎯 Constants
// ============================================

/**
 * DAIVE 문서 루트 폴더명
 */
export const DAIVE_DOCUMENTS_ROOT = "daive-documents";

/**
 * 클러스터 폴더 내 기본 하위 디렉토리
 */
export const CLUSTER_SUBDIRS = ["reports", "plans", "manifests", "configs", "misc"] as const;

// ============================================
// 🎯 Path Validation
// ============================================

/**
 * 경로 검증 결과 타입
 */
export interface PathValidationResult {
  /** 경로가 유효한지 여부 */
  valid: boolean;
  /** Safe Zone 내부인지 여부 */
  isInsideSafeZone: boolean;
  /** 정규화된 실제 경로 (symlink 해결됨) */
  resolvedPath?: string;
  /** 에러 코드 (유효하지 않은 경우) */
  error?: AIFileErrorCode;
  /** 에러 상세 메시지 */
  errorMessage?: string;
}

/**
 * 🎯 경로 안전성 검증
 *
 * Safe Zone 기준으로 요청된 경로가 안전한지 검증합니다.
 *
 * @param requestedPath - 요청된 파일 경로 (절대 또는 상대)
 * @param safeZonePath - Safe Zone 루트 경로 (절대)
 * @returns 검증 결과 (유효성, Safe Zone 내부 여부, 에러 정보)
 *
 * 📋 보안 처리:
 * 1. path.sep을 사용하여 /safe vs /safe2 오탐 방지
 * 2. symlink를 해결하여 symlink 기반 탈출 방지
 * 3. Windows 대소문자 무시 처리
 */
export async function validatePath(requestedPath: string, safeZonePath: string): Promise<PathValidationResult> {
  // 1. Normalize both paths (handles case on Windows, removes trailing slashes)
  const normalizedSafeZone = path.normalize(safeZonePath);
  const resolvedPath = path.resolve(requestedPath);

  // 2. Resolve symlinks to get canonical path (prevents symlink escapes)
  let realPath: string;

  try {
    realPath = await fs.realpath(resolvedPath);
  } catch {
    // File doesn't exist yet - use resolved path for validation
    // For new files, validate parent directory instead
    const parentDir = path.dirname(resolvedPath);

    try {
      const parentRealPath = await fs.realpath(parentDir);

      realPath = path.join(parentRealPath, path.basename(resolvedPath));
    } catch {
      // Parent also doesn't exist - use resolved path as-is
      realPath = resolvedPath;
    }
  }

  // 3. Normalize for comparison (handles Windows case-insensitivity)
  const normalizedRealPath = process.platform === "win32" ? realPath.toLowerCase() : realPath;
  const normalizedSafeZoneForCompare =
    process.platform === "win32" ? normalizedSafeZone.toLowerCase() : normalizedSafeZone;

  // 4. Check if inside Safe Zone (use path.sep to prevent /safe vs /safe2)
  const safeZoneWithSep = normalizedSafeZoneForCompare.endsWith(path.sep)
    ? normalizedSafeZoneForCompare
    : normalizedSafeZoneForCompare + path.sep;

  const isInsideSafeZone =
    normalizedRealPath === normalizedSafeZoneForCompare || normalizedRealPath.startsWith(safeZoneWithSep);

  // 5. Return result
  return {
    valid: true,
    isInsideSafeZone,
    resolvedPath: realPath,
  };
}

/**
 * 🎯 Path Traversal 탐지
 *
 * 경로에 path traversal 시도가 있는지 확인합니다.
 *
 * @param inputPath - 검사할 경로
 * @returns path traversal이 감지되면 true
 *
 * 📋 탐지 패턴:
 * - "../" 또는 "..\\"
 * - "/.." 또는 "\\.."
 * - 순수 ".." 경로
 */
export function detectPathTraversal(inputPath: string): boolean {
  // Normalize to handle both forward and backward slashes
  const normalized = inputPath.replace(/\\/g, "/");

  // Check for common path traversal patterns
  const traversalPatterns = [
    /\.\.\//, // ../
    /\/\.\./, // /..
    /^\.\.$/, // pure ..
    /^\.\.\/|\/\.\.$/, // starts or ends with ../
  ];

  return traversalPatterns.some((pattern) => pattern.test(normalized));
}

// ============================================
// 🎯 File Operation Policy
// ============================================

/**
 * 파일 작업 정책 결과 타입
 */
export interface FileOperationPolicyResult {
  /** 작업 허용 여부 */
  allowed: boolean;
  /** HITL 승인 필요 여부 */
  requiresHitl: boolean;
  /** 추가 메시지 (경고 등) */
  message?: string;
}

/**
 * 🎯 파일 작업 정책 확인
 *
 * 스펙 4.2, 4.3절 정책에 따라 파일 작업 허용 여부를 결정합니다.
 *
 * @param operation - 작업 타입 ("read" | "write" | "delete")
 * @param isInsideSafeZone - Safe Zone 내부 여부
 * @param extension - 파일 확장자 (소문자, 점 포함)
 * @returns 작업 허용 여부, HITL 필요 여부, 메시지
 *
 * 📋 정책 매트릭스:
 * - Read Safe Zone 내부 + 허용 확장자 → 바로 허용
 * - Read Safe Zone 내부 + 기타 확장자 → HITL 필요
 * - Read Safe Zone 외부 + 허용 확장자 → HITL 필요
 * - Read Safe Zone 외부 + 기타 확장자 → 차단
 * - Write Safe Zone 내부 → HITL 필요 (기타 확장자 경고)
 * - Write Safe Zone 외부 → 항상 차단
 * - Delete Safe Zone 내부 → HITL 필요
 * - Delete Safe Zone 외부 → 차단
 */
export function checkFileOperationPolicy(
  operation: "read" | "write" | "delete",
  isInsideSafeZone: boolean,
  extension: string,
): FileOperationPolicyResult {
  const isAllowedExt = AI_ALLOWED_EXTENSIONS.includes(
    extension.toLowerCase() as (typeof AI_ALLOWED_EXTENSIONS)[number],
  );

  // Write 작업
  if (operation === "write") {
    // Write: Safe Zone 외부는 항상 차단
    if (!isInsideSafeZone) {
      return {
        allowed: false,
        requiresHitl: false,
        message: "Write outside Safe Zone is blocked",
      };
    }

    // Write: Safe Zone 내부는 HITL 필요 (기타 확장자는 경고 추가)
    return {
      allowed: true,
      requiresHitl: true,
      message: isAllowedExt ? undefined : "Non-standard file extension - proceed with caution",
    };
  }

  // Delete 작업 (Phase 2)
  if (operation === "delete") {
    // Delete: Safe Zone 외부는 항상 차단
    if (!isInsideSafeZone) {
      return {
        allowed: false,
        requiresHitl: false,
        message: "Delete outside Safe Zone is blocked",
      };
    }

    // Delete: Safe Zone 내부는 HITL 필요
    return {
      allowed: true,
      requiresHitl: true,
    };
  }

  // Read 작업
  if (isInsideSafeZone) {
    // Read: Safe Zone 내부 허용 확장자 → 바로 허용
    // Read: Safe Zone 내부 기타 확장자 → HITL 필요
    return {
      allowed: true,
      requiresHitl: !isAllowedExt,
      message: isAllowedExt ? undefined : "Non-standard file extension requires approval",
    };
  } else {
    // Read: Safe Zone 외부 허용 확장자 → HITL 필요
    // Read: Safe Zone 외부 기타 확장자 → 차단
    if (isAllowedExt) {
      return {
        allowed: true,
        requiresHitl: true,
        message: "Reading file outside Safe Zone requires approval",
      };
    }

    return {
      allowed: false,
      requiresHitl: false,
      message: "Read of non-standard extension outside Safe Zone is blocked",
    };
  }
}

/**
 * 🎯 확장자 분류
 *
 * 파일 확장자가 허용 목록에 있는지 확인합니다.
 *
 * @param extension - 파일 확장자 (점 포함)
 * @returns "allowed" 또는 "other"
 */
export function classifyExtension(extension: string): "allowed" | "other" {
  const normalizedExt = extension.toLowerCase();

  return AI_ALLOWED_EXTENSIONS.includes(normalizedExt as (typeof AI_ALLOWED_EXTENSIONS)[number]) ? "allowed" : "other";
}

// ============================================
// 🎯 Cluster Name Sanitization
// ============================================

/**
 * 🎯 클러스터 이름 Sanitize
 *
 * 클러스터 이름을 안전한 폴더명으로 변환합니다.
 *
 * @param name - 클러스터 표시 이름
 * @param clusterId - 고유 클러스터 ID (충돌 방지용)
 * @returns 안전한 폴더명 (유니크 suffix 포함)
 *
 * 📋 처리 규칙:
 * 1. 유효하지 않은 문자 → 하이픈으로 교체
 * 2. 공백 → 하이픈
 * 3. 연속 하이픈 → 단일 하이픈
 * 4. 앞뒤 하이픈 제거
 * 5. 소문자 변환
 * 6. clusterId hash suffix 추가 (충돌 방지)
 *
 * 📋 충돌 방지:
 * - 다른 클러스터가 sanitize 후 같은 이름이 되는 것을 방지
 * - Format: {sanitized-name}-{hash6}
 * - Example: "my-k8s-cluster-a1b2c3"
 */
export function sanitizeClusterName(name: string, clusterId?: string): string {
  // 1. Basic sanitization
  const sanitized = name
    .replace(/[/\\:*?"<>|]/g, "-") // Invalid chars → hyphen
    .replace(/\s+/g, "-") // Whitespace → hyphen
    .replace(/-+/g, "-") // Consecutive hyphens → single
    .replace(/^-|-$/g, "") // Trim leading/trailing hyphens
    .toLowerCase();

  // 2. Add uniqueness suffix if clusterId provided
  if (clusterId) {
    const hash = crypto.createHash("sha256").update(clusterId).digest("hex").slice(0, 6); // 6 chars = 16M combinations

    // Max length: 64 - 7 (hash + hyphen) = 57 for name part
    const namePart = sanitized.slice(0, 57);

    return `${namePart}-${hash}`;
  }

  // 3. Fallback: no clusterId (legacy)
  return sanitized.slice(0, 64);
}

// ============================================
// 🎯 Filename Utilities
// ============================================

/**
 * 🎯 파일명에 타임스탬프 추가
 *
 * 파일명 앞에 날짜+시간을 추가하여 중복을 방지합니다.
 *
 * @param filename - 원본 파일명 (확장자 포함)
 * @returns 타임스탬프가 추가된 파일명
 *
 * 📋 형식:
 * - Input: "pod-health-report.md"
 * - Output: "2026-01-29-143542-pod-health-report.md"
 */
export function addTimestampToFilename(filename: string): string {
  const iso = new Date().toISOString();
  const timestamp = `${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}`; // 2026-01-29-143542
  const ext = path.extname(filename); // .md, .yaml, .json
  const base = path.basename(filename, ext);

  // Sanitize the base name (without cluster ID)
  const slug = base
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${timestamp}-${slug}${ext}`;
}

/**
 * 🎯 클러스터 폴더 경로 생성
 *
 * Safe Zone 내 클러스터 폴더의 전체 경로를 생성합니다.
 *
 * @param safeZonePath - Safe Zone 루트 경로
 * @param clusterName - 클러스터 이름
 * @param clusterId - 클러스터 ID (충돌 방지용)
 * @param subDir - 하위 디렉토리 타입 (reports, plans, manifests, configs, misc)
 * @returns 전체 폴더 경로
 *
 * 📋 예시:
 * - /home/user/daive-documents/my-cluster-a1b2c3/reports
 */
export function getClusterFolderPath(
  safeZonePath: string,
  clusterName: string,
  clusterId?: string,
  subDir?: (typeof CLUSTER_SUBDIRS)[number],
): string {
  const sanitizedName = sanitizeClusterName(clusterName, clusterId);
  const basePath = path.join(safeZonePath, DAIVE_DOCUMENTS_ROOT, sanitizedName);

  if (subDir) {
    return path.join(basePath, subDir);
  }

  return basePath;
}

/**
 * 🎯 파일 저장 경로 생성
 *
 * 클러스터 폴더 내 파일의 전체 경로를 생성합니다.
 *
 * @param safeZonePath - Safe Zone 루트 경로
 * @param clusterName - 클러스터 이름
 * @param clusterId - 클러스터 ID
 * @param subDir - 하위 디렉토리 타입
 * @param filename - 파일명
 * @param addTimestamp - 타임스탬프 추가 여부 (기본 true)
 * @returns 전체 파일 경로
 */
export function getFileSavePath(
  safeZonePath: string,
  clusterName: string,
  clusterId: string | undefined,
  subDir: (typeof CLUSTER_SUBDIRS)[number],
  filename: string,
  addTimestamp = true,
): string {
  const folderPath = getClusterFolderPath(safeZonePath, clusterName, clusterId, subDir);
  const finalFilename = addTimestamp ? addTimestampToFilename(filename) : filename;

  return path.join(folderPath, finalFilename);
}

/**
 * 🎯 확장자 추출 (소문자 정규화)
 *
 * @param filePath - 파일 경로 또는 파일명
 * @returns 소문자로 정규화된 확장자 (점 포함)
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * 🎯 MIME 타입 추정
 *
 * 확장자를 기반으로 MIME 타입을 추정합니다.
 *
 * @param extension - 파일 확장자 (점 포함)
 * @returns MIME 타입 문자열
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".json": "application/json",
    ".txt": "text/plain",
  };

  return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}
