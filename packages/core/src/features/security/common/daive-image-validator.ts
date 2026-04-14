/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 유효한 컨테이너 이미지 URI 판별 유틸리티
 * daive-fix-channel.ts / daive-tier-classifier.ts 양쪽에서 import
 * 순환 참조 방지를 위해 별도 파일로 분리
 */

/**
 * trivy Target에서 OS 정보 suffix 제거 (export — daive-fix-channel에서 clean URI 저장에 사용)
 *
 * e.g. "quay.io/argoproj/argocd:v2.13.2 (ubuntu 24.04)" → "quay.io/argoproj/argocd:v2.13.2"
 *      "grafana/loki:2.9.4 (alpine 3.18.5)"              → "grafana/loki:2.9.4"
 *      "longhornio/longhorn-manager:v1.7.2 (sles 15.6)"  → "longhornio/longhorn-manager:v1.7.2"
 *      "postgres:16-alpine (alpine 3.23.3)"               → "postgres:16-alpine"
 */
export function stripOsSuffix(t: string): string {
  return t.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * 알려진 바이너리/시스템 경로 첫 세그먼트 블랙리스트
 * trivy k8s 스캔 결과에서 실행 파일 경로가 Target으로 노출되는 케이스를 차단
 *
 * e.g. bin/alertmanager, cni/loopback, opt/cni/bin/cilium-cni, usr/local/bin/argocd
 */
const BINARY_PATH_PREFIXES = new Set(["bin", "sbin", "usr", "opt", "app", "lib", "etc", "cni", "csi"]);

/**
 * 유효한 컨테이너 이미지 URI 판별
 *
 * 판별 순서:
 *   1. OS suffix strip ("(alpine 3.18.4)" 등 제거)
 *   2. 공백 포함 → 무효
 *   3. sha256 다이제스트 → 무효
 *   4. 슬래시 있음:
 *      a. 첫 세그먼트에 . 또는 : → FQDN 레지스트리 → 유효
 *      b. 첫 세그먼트가 바이너리 경로 prefix → 무효
 *      c. 2세그먼트 → Docker Hub org/image → 유효
 *      d. 3세그먼트+ → 파일 경로 → 무효
 *   5. 슬래시 없음:
 *      a. : 포함 → name:tag → 유효
 *      b. 숫자로 시작 → 버전 문자열 → 무효
 *      c. 그 외 → 단순 이름 → 유효
 */
export function isValidImageTarget(t: string): boolean {
  if (!t) return false;

  // 1. OS suffix strip
  const cleaned = stripOsSuffix(t);

  // 2. 공백 있으면 무효 (strip 후에도 남아있으면)
  if (cleaned.includes(" ")) return false;

  // 3. sha256 다이제스트만 있는 경우 제외
  if (/^sha256:[a-f0-9]{64}$/.test(cleaned)) return false;

  // 4. 슬래시 있는 경우
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/");
    const firstPart = parts[0] ?? "";

    // 4a. 첫 세그먼트가 레지스트리 호스트 (. 또는 : 포함, 또는 localhost)
    const isRegistryHost = firstPart.includes(".") || firstPart.includes(":") || firstPart === "localhost";

    if (isRegistryHost) return true;

    // 4b. 알려진 바이너리 경로 prefix 차단
    if (BINARY_PATH_PREFIXES.has(firstPart)) return false;

    // 4c. 2세그먼트 → Docker Hub org/image (longhornio/longhorn-manager, grafana/loki 등)
    if (parts.length === 2) return true;

    // 4d. 3세그먼트 이상 → 파일 경로 (app/cmd/controller/controller 등)
    return false;
  }

  // 5. 슬래시 없음
  // 5a. name:tag → 유효 (nginx:latest, redis:7, postgres:16-alpine)
  if (cleaned.includes(":")) return true;

  // 5b. 숫자로 시작 → 버전 문자열 (8.5.0-2ubuntu10.7) → 무효
  if (/^\d/.test(cleaned)) return false;

  // 5c. 단순 이름 (coredns, nginx 등) → 유효
  return true;
}
