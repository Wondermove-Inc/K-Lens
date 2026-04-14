/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * (updated): DAIVE 그룹 상태 머신 타입 정의
 *
 * 위험도 × 조치 유형 기반 분류
 * 기존 5-상태 탭 (Fixed/Review/Risk/Upgrade/Manual) 폐기.
 *
 * @packageDocumentation
 */

import type { DaiveFixFindingSummary } from "../../../features/security/common/daive-fix-channel";

// ============================================
// GroupStatus — 그룹별 독립 상태
// ============================================

/**
 * 개별 DAIVE 그룹의 상태
 *
 * - pending:     아직 대화 시작 전 (기본값)
 * - conversing:  사용자가 DAIVE와 대화 중 (채팅 패널 활성)
 * - applied:     apply 완료 (성공)
 * - rolledBack:  롤백 완료
 * - error:       apply 실패
 */
export type GroupStatus = "pending" | "conversing" | "applied" | "rolledBack" | "error";

// ============================================
// GroupCategory — 위험도 기반 3단계
// ============================================

/**
 * 위험도 기반 그룹 카테고리
 *
 * - critical: 즉시 조치 권장 (🔴)
 * - warning:  조치 권장 (🟡)
 * - info:     낮은 위험, 참고 (🟢)
 */
export type GroupCategory = "critical" | "warning" | "info";

// ============================================
// ActionType — 조치 유형 태그
// ============================================

/**
 * 조치 유형 태그
 *
 * - config-fix:     SecurityContext, RBAC, SA token 등 설정 수정 ()
 * - image-upgrade:  컨테이너 이미지 업데이트 필요 ()
 * - manual-review:  환경별 판단 필요, 자동화 불가 ()
 */
export type ActionType = "config-fix" | "image-upgrade" | "manual-review";

// ============================================
// DaiveGroup — 그룹 인터페이스
// ============================================

/**
 * DAIVE 수정 그룹
 *
 * 위험도 (category) + 조치 유형 (actionType) 기반 분류.
 * 그룹핑 전략:
 *   [A] Image 그룹  — 동일 imageUri 기준 (이미지별, NS 무관 통합)
 *   [B] CVE 그룹    — imageUri 없는 CVE를 cveId 기준으로 전체 NS 통합
 *   [C] Config 그룹 — KSV/RBAC checkId를 전체 NS 통합 (NS별 분리 X)
 */
export interface DaiveGroup {
  /** 그룹 고유 ID ("image:{uri}" | "cve:{cveId}" | "ksv:{checkId}") */
  groupId: string;
  /** 표시 레이블 (이미지명:태그 / CVE ID / checkId) */
  label: string;
  /** 위험도 (critical/warning/info) */
  category: GroupCategory;
  /** 조치 유형 태그 */
  actionType: ActionType;
  /**
   * 영향받는 네임스페이스 목록 (중복 제거).
   * 이미지/CVE/Config 그룹 모두 여러 NS에 걸칠 수 있으므로 배열로 관리.
   */
  namespaces: string[];
  /**
   * @deprecated namespace 단수형 — 하위 호환성 유지용 (namespaces[0])
   */
  namespace?: string;
  /** 포함된 finding 목록 */
  findings: DaiveFixFindingSummary[];
  /** 현재 상태 */
  status: GroupStatus;
  /** 적용된 리소스 수 (applied 상태에서만) */
  appliedCount?: number;
  /** 에러 메시지 (error 상태에서만) */
  errorMessage?: string;
  /** 그룹 입장 시 자동 주입할 컨텍스트 (buildFindingContext 결과) */
  initialContext?: string;
  /** autoFixKsv 항목 포함 여부 */
  isAutoFixable?: boolean;
}

// ============================================
// ChatMessage — 그룹별 대화 기록
// ============================================

export type ChatMessageRole = "user" | "assistant";

/**
 * 그룹별 대화 메시지
 */
export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
}

/**
 * 그룹별 대화 상태 맵
 * groupId → ChatMessage[] (대화 이력 보존)
 */
export type GroupChatState = Map<string, ChatMessage[]>;

// ============================================
// 위험도 분류 헬퍼
// ============================================

/**
 * finding severity → GroupCategory 변환
 *
 * CRITICAL/HIGH → critical
 * MEDIUM        → warning
 * LOW/UNKNOWN   → info
 */
export function severityToCategory(severity: string): GroupCategory {
  const s = severity.toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "critical";
  if (s === "MEDIUM") return "warning";
  return "info";
}

/**
 * finding type → ActionType 변환
 *
 * CVE + fixedVersion → image-upgrade
 * KSV-* / RBAC     → config-fix
 * 나머지            → manual-review
 */
export function findingToActionType(finding: {
  type?: string;
  checkId?: string;
  cveId?: string;
  fixedVersion?: string;
}): ActionType {
  const cveId = finding.cveId ?? "";
  const checkId = (finding.checkId ?? "").replace(/^AVD-/, "").toUpperCase();
  const type = String(finding.type ?? "").toLowerCase();

  if (cveId.startsWith("CVE-") || type.includes("cve") || type.includes("vulnerability")) {
    return finding.fixedVersion ? "image-upgrade" : "manual-review";
  }
  if (checkId.startsWith("KSV-") || checkId.startsWith("RBAC-")) {
    return "config-fix";
  }
  return "manual-review";
}

// ============================================
// buildDaiveGroups — 이미지/CVE/Config 3계층 그룹 빌더
// ============================================

/**
 * 이미지 URI에서 레지스트리 프리픽스를 제거해 짧은 레이블 반환.
 * docker.io/library/nginx:1.25 → nginx:1.25
 * ghcr.io/org/app:v1.0        → ghcr.io/org/app:v1.0 (그대로)
 */
function _shortImageLabel(imageUri: string): string {
  let s = imageUri.trim();
  // docker 공식 이미지 축약
  s = s.replace(/^(?:docker\.io\/library\/|index\.docker\.io\/library\/)/, "");
  s = s.replace(/^docker\.io\//, "");
  if (s.length > 64) s = s.slice(0, 61) + "...";
  return s;
}

/**
 * category 업그레이드 헬퍼 — 더 높은 위험도로만 승격.
 */
function _upgradeCategory(current: GroupCategory, incoming: GroupCategory): GroupCategory {
  const ord: GroupCategory[] = ["info", "warning", "critical"];
  return ord.indexOf(incoming) > ord.indexOf(current) ? incoming : current;
}

/**
 * DaiveFixFindingSummary[] → DaiveGroup[]
 *
 * 그룹핑 전략 (수천 → 수백 이하):
 *   [A] Image 그룹  — 동일 imageUri 의 모든 CVE를 하나로 통합 (NS 무관)
 *   [B] CVE 그룹    — imageUri 없는 CVE를 cveId 단위로 전체 NS 통합
 *   [C] Config 그룹 — KSV/RBAC checkId를 전체 NS 통합 (NS별 분리 제거)
 *
 * 정렬: critical → warning → info, 같은 카테고리 내에서 finding 수 내림차순.
 *
 * @param findings   finding 목록
 * @param autoFixSet 자동 수정 가능 항목 식별 키 집합 (checkId or "cve:{id}:{pkg}")
 */
export function buildDaiveGroups(findings: DaiveFixFindingSummary[], autoFixSet?: Set<string>): DaiveGroup[] {
  const map = new Map<string, DaiveGroup>();

  for (const f of findings) {
    const ns = f.resource?.namespace ?? "";
    const isCve = f.type === "CVE" || !!f.cveId;

    // ── 그룹 키/레이블/조치유형 결정 ──────────────────────────────
    let groupId: string;
    let label: string;
    let actionType: ActionType;

    if (isCve && f.imageUri) {
      // [A] Image 그룹 — imageUri 기준
      groupId = `image:${f.imageUri}`;
      label = _shortImageLabel(f.imageUri);
      actionType = "image-upgrade";
    } else if (isCve) {
      // [B] CVE 그룹 — cveId 기준 (imageUri 없음)
      const cveKey = f.cveId ?? `pkg:${f.packageName ?? "unknown"}`;
      groupId = `cve:${cveKey}`;
      label = f.cveId ? `${f.cveId}${f.packageName ? ` (${f.packageName})` : ""}` : (f.packageName ?? "CVE");
      actionType = f.fixedVersion ? "image-upgrade" : "manual-review";
    } else {
      // [C] Config/KSV 그룹 — checkId 기준, 전체 NS 통합
      const checkKey = f.checkId ?? f.title ?? "unknown";
      groupId = `ksv:${checkKey}`;
      label = f.checkId ?? f.title ?? groupId;
      actionType = findingToActionType(f);
    }

    // autoFix 키 (autoFixSet 조회용)
    const autoFixKey = isCve ? `cve:${f.cveId ?? ""}:${f.packageName ?? ""}` : (f.checkId ?? f.title ?? "");
    const isAutoFix = autoFixSet ? autoFixSet.has(autoFixKey) : false;

    // ── 그룹 누적 또는 신규 생성 ──────────────────────────────────
    const existing = map.get(groupId);
    if (existing) {
      existing.findings.push(f);
      existing.category = _upgradeCategory(existing.category, severityToCategory(f.severity));
      if (ns && !existing.namespaces.includes(ns)) existing.namespaces.push(ns);
      if (isAutoFix) existing.isAutoFixable = true;
    } else {
      const namespaces = ns ? [ns] : [];
      map.set(groupId, {
        groupId,
        label,
        category: severityToCategory(f.severity),
        actionType,
        namespaces,
        namespace: namespaces[0],
        findings: [f],
        status: "pending",
        isAutoFixable: isAutoFix,
      });
    }
  }

  // ── 정렬: critical → warning → info, finding 수 내림차순 ────────
  const catOrd: GroupCategory[] = ["critical", "warning", "info"];
  const groups = Array.from(map.values());
  groups.forEach((g) => {
    // namespace 단수 필드를 namespaces[0]으로 동기화
    g.namespace = g.namespaces[0];
  });
  return groups.sort((a, b) => {
    const catDiff = catOrd.indexOf(a.category) - catOrd.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return b.findings.length - a.findings.length;
  });
}
