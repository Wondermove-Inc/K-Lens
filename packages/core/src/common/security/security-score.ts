/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Kubernetes cluster security score calculation
 * Security score formula implementation
 *
 * Algorithm (ratio-based with minimum baseline correction):
 * - weightedSum     = CRITICAL×10 + HIGH×5 + MEDIUM×2 + LOW×1 + UNKNOWN×0.5
 * - effectiveTotal  = max(totalFindings, MIN_FINDING_BASELINE)
 * - maxWeightedSum  = effectiveTotal × 10 (assumes all findings are CRITICAL)
 * - score           = round((1 - weightedSum / maxWeightedSum) × 100, 1)  ← 1 decimal
 * - score is capped at 99.9 when findings > 0 (distinguishes from a perfect 100)
 * - score is 100 when no findings are present
 *
 * 📊 Grade thresholds:
 * - A (Perfect):        score = 100      — No findings at all
 * - B (Action Required): score 85~99.9  — High score but findings require attention
 * - C (Moderate Risk):  score 70~84
 * - D (High Risk):      score 50~69      — Immediate action recommended
 * - F (Critical Risk):  score 0~49       — Severe vulnerabilities present
 *
 * @packageDocumentation
 */

import { type AnySecurityFinding, Severity } from "./security-finding";

// ============================================
// 점수 가중치 상수
// ============================================

const SEVERITY_WEIGHT: Record<Severity, number> = {
  [Severity.Critical]: 10,
  [Severity.High]: 5,
  [Severity.Medium]: 2,
  [Severity.Low]: 1,
  [Severity.Unknown]: 0.5,
};

/** Finding 1개당 최대 가중치 (모두 CRITICAL인 경우 기준) */
const MAX_WEIGHT_PER_FINDING = 10;

/**
 * 점수 계산 시 사용할 최소 Finding 기준선.
 * Finding 수가 이 값보다 적으면 이 값을 분모 기준으로 사용하여
 * 소규모 클러스터에서 단일 Finding의 영향을 완화한다.
 */
const MIN_FINDING_BASELINE = 10;

// ============================================
// 보안 등급 열거형
// ============================================

export enum SecurityGrade {
  A = "A", // 100       — Perfect: no findings
  B = "B", // 85 ~ 99.9 — Action Required: findings present but score is high
  C = "C", // 70 ~ 84   — Moderate Risk
  D = "D", // 50 ~ 69   — High Risk: immediate action recommended
  F = "F", // 0  ~ 49   — Critical Risk: severe vulnerabilities
}

// ============================================
// 보안 점수 결과
// ============================================

export interface SecurityScore {
  /** 0 ~ 100 점수 (소수점 1자리, finding 없으면 100 / finding 있으면 최대 99.9) */
  score: number;

  /** 등급 A ~ F */
  grade: SecurityGrade;

  /** Severity 별 Finding 개수 */
  breakdown: Record<Severity, number>;

  /** 총 Finding 개수 */
  totalFindings: number;
}

// ============================================
// 점수 계산
// ============================================

/**
 * Finding 목록에서 보안 점수를 계산합니다.
 *
 * 비율 기반 공식 (최소 기준선 보정 포함):
 *   weightedSum      = Σ(severity_weight × count)
 *   effectiveTotal   = max(totalFindings, MIN_FINDING_BASELINE)
 *   maxWeightedSum   = effectiveTotal × MAX_WEIGHT_PER_FINDING
 *   score            = (1 - weightedSum / maxWeightedSum) × 100
 *
 * Finding이 없으면 100점(만점)을 반환합니다.
 *
 * @param findings - 스캔 결과 Finding 배열
 * @returns SecurityScore 객체
 *
 * @example
 * ```ts
 * const score = calculateSecurityScore(findings);
 * console.log(score.score); // 71.0
 * console.log(score.grade); // "C"
 * ```
 */
export function calculateSecurityScore(findings: AnySecurityFinding[]): SecurityScore {
  const breakdown: Record<Severity, number> = {
    [Severity.Critical]: 0,
    [Severity.High]: 0,
    [Severity.Medium]: 0,
    [Severity.Low]: 0,
    [Severity.Unknown]: 0,
  };

  if (findings.length === 0) {
    return {
      score: 100,
      grade: SecurityGrade.A,
      breakdown,
      totalFindings: 0,
    };
  }

  let weightedSum = 0;

  for (const finding of findings) {
    const sev = finding.severity;
    breakdown[sev] += 1;
    weightedSum += SEVERITY_WEIGHT[sev];
  }

  const effectiveTotal = Math.max(findings.length, MIN_FINDING_BASELINE);
  const maxWeightedSum = effectiveTotal * MAX_WEIGHT_PER_FINDING;
  const raw = (1 - weightedSum / maxWeightedSum) * 100;
  // 소수점 1자리 반올림, finding이 있으면 최대 99.9 (finding 없는 100점과 구분)
  const score = Math.max(0, Math.min(99.9, Math.round(raw * 10) / 10));

  return {
    score,
    grade: toGrade(score),
    breakdown,
    totalFindings: findings.length,
  };
}

/**
 * Converts a numeric score to a security grade.
 *
 * Grade thresholds:
 * - A (Perfect):         score = 100      — No findings
 * - B (Action Required): score 85 ~ 99.9  — Findings exist but score is high
 * - C (Moderate Risk):   score 70 ~ 84
 * - D (High Risk):       score 50 ~ 69
 * - F (Critical Risk):   score 0  ~ 49
 *
 * Note: score=100 only occurs when totalFindings=0 (see calculateSecurityScore).
 * Any cluster with at least one finding is capped at 99.9, which maps to grade B.
 * This ensures that grade A exclusively represents a clean, finding-free cluster.
 */
export function toGrade(score: number): SecurityGrade {
  if (score >= 100) return SecurityGrade.A;
  if (score >= 85) return SecurityGrade.B; // 85~99.9: Needs Attention
  if (score >= 70) return SecurityGrade.C; // 70~84: Moderate Risk
  if (score >= 50) return SecurityGrade.D; // 50~69: High Risk
  return SecurityGrade.F; // 0~49: Critical Risk
}

// ============================================
// 가중 평균 Overall Score
// ============================================

/**
 * Kubescape(Platform) 60% + Trivy(Workload) 40% 가중 평균으로 Overall Score를 계산합니다.
 *
 * 근거:
 * - CISA/NSA K8s Hardening Guide: 클러스터 설정 보안(RBAC, Pod Security, NetworkPolicy)을 최우선으로 정의
 * - Sysdig 2023 Cloud-Native Security Report: K8s 침해의 67%가 misconfiguration 기인 (이미지 CVE는 33%)
 * - min() 방식 대비 이점: CVE 1건으로 Overall 급락하는 노이즈 방지, 실질 위험 비중 반영
 *
 * @param platformScore - Kubescape 스캔 결과 점수 (null이면 100점으로 간주)
 * @param workloadScore - Trivy 스캔 결과 점수 (null이면 100점으로 간주)
 * @param workloadTimedOut - Trivy 타임아웃 시 true. workloadScore를 가중치 계산에서 제외하고 platform 단독으로 계산
 */
export function calculateWeightedOverallScore(
  platformScore: SecurityScore | null,
  workloadScore: SecurityScore | null,
  workloadTimedOut = false,
): SecurityScore {
  const PLATFORM_WEIGHT = 0.6;
  const WORKLOAD_WEIGHT = 0.4;

  const ps = platformScore?.score ?? 100;
  const ws = workloadScore?.score ?? 100;

  // Trivy 타임아웃 시 workload 제외 → platform 단독 점수로 표시 (100점 부풀림 방지)
  const weighted = workloadTimedOut ? ps : Math.round((ps * PLATFORM_WEIGHT + ws * WORKLOAD_WEIGHT) * 10) / 10;

  // breakdown 합산
  const breakdown: Record<Severity, number> = {
    [Severity.Critical]:
      (platformScore?.breakdown[Severity.Critical] ?? 0) + (workloadScore?.breakdown[Severity.Critical] ?? 0),
    [Severity.High]: (platformScore?.breakdown[Severity.High] ?? 0) + (workloadScore?.breakdown[Severity.High] ?? 0),
    [Severity.Medium]:
      (platformScore?.breakdown[Severity.Medium] ?? 0) + (workloadScore?.breakdown[Severity.Medium] ?? 0),
    [Severity.Low]: (platformScore?.breakdown[Severity.Low] ?? 0) + (workloadScore?.breakdown[Severity.Low] ?? 0),
    [Severity.Unknown]:
      (platformScore?.breakdown[Severity.Unknown] ?? 0) + (workloadScore?.breakdown[Severity.Unknown] ?? 0),
  };

  return {
    score: weighted,
    grade: toGrade(weighted),
    breakdown,
    totalFindings: (platformScore?.totalFindings ?? 0) + (workloadScore?.totalFindings ?? 0),
  };
}
