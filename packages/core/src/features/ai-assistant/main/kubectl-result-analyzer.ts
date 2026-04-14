/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: kubectl 결과를 분석하여 LLM 친화적 요약 생성
 *
 * K8sGPT/HolmesGPT 패턴 적용:
 * - 정상 리소스: 카운트만
 * - 문제 리소스: 상세 정보
 * - 컨텍스트 폭발 방지
 *
 * 📝 주의사항:
 * - LLM에게 모든 데이터를 주지 말고, 문제만 전달
 * - 요약은 10줄 이내로 유지
 *
 * 🔄 변경이력:
 * - 2026-01-31: 초기 생성 (Phase 3: 성능 최적화)
 */

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 문제 심각도
 */
export type ProblemSeverity = "critical" | "warning" | "info";

/**
 * 감지된 문제
 */
export interface DetectedProblem {
  /** 리소스 이름 (예: pod/nginx-abc123) */
  resource: string;
  /** 네임스페이스 */
  namespace: string;
  /** 문제 설명 */
  issue: string;
  /** 심각도 */
  severity: ProblemSeverity;
}

/**
 * kubectl 분석 결과
 */
export interface KubectlAnalysisResult {
  /** 총 리소스 수 */
  totalResources: number;
  /** 정상 리소스 수 */
  healthyCount: number;
  /** 감지된 문제 목록 */
  problems: DetectedProblem[];
  /** 5-10줄 요약 */
  summary: string;
  /** 원본 데이터가 잘렸는지 여부 */
  rawDataTruncated: boolean;
  /** 분석된 리소스 타입 */
  resourceType: string;
}

// ============================================
// 🎯 상수 정의
// ============================================

/** 요약에 표시할 최대 문제 개수 */
const MAX_PROBLEMS_IN_SUMMARY = 10;

/** 문제로 간주하는 Pod 상태 (Critical) */
const CRITICAL_POD_STATUSES = ["CrashLoopBackOff", "Error", "OOMKilled", "ImagePullBackOff", "ErrImagePull"];

/** 문제로 간주하는 Pod 상태 (Warning) */
const WARNING_POD_STATUSES = ["Pending", "ContainerCreating", "Terminating", "Unknown"];

/** 높은 재시작 횟수 임계값 */
const HIGH_RESTART_THRESHOLD = 5;

// ============================================
// 🎯 Pod 분석기
// ============================================

/**
 * 🎯 kubectl get pods 결과 분석
 *
 * @param stdout - kubectl get pods 결과 (텍스트)
 * @param maxOutputChars - 원본 데이터 최대 크기 (truncation 판단용)
 * @returns 분석 결과
 *
 * 📝 입력 예시:
 * NAMESPACE     NAME                    READY   STATUS    RESTARTS   AGE
 * default       nginx-abc123            1/1     Running   0          10d
 * kube-system   coredns-def456          0/1     CrashLoopBackOff   5   1h
 */
export function analyzeKubectlPods(stdout: string, maxOutputChars = 100000): KubectlAnalysisResult {
  const lines = stdout.split("\n").filter((line) => line.trim() !== "");

  // 헤더 행 분석
  const headerLine = lines[0] || "";
  const hasNamespaceColumn = headerLine.includes("NAMESPACE");

  // 데이터 행만 추출 (헤더 제외)
  const dataLines = lines.slice(1);
  const problems: DetectedProblem[] = [];
  let healthyCount = 0;

  for (const line of dataLines) {
    const columns = line.trim().split(/\s+/);

    // 컬럼 인덱스 (NAMESPACE 포함 여부에 따라 다름)
    const namespaceIdx = hasNamespaceColumn ? 0 : -1;
    const nameIdx = hasNamespaceColumn ? 1 : 0;
    // readyIdx는 현재 사용하지 않음 (추후 확장용)
    // const readyIdx = hasNamespaceColumn ? 2 : 1;
    const statusIdx = hasNamespaceColumn ? 3 : 2;
    const restartsIdx = hasNamespaceColumn ? 4 : 3;

    const namespace = hasNamespaceColumn ? columns[namespaceIdx] : "default";
    const name = columns[nameIdx] || "unknown";
    const status = columns[statusIdx] || "Unknown";
    const restarts = parseInt(columns[restartsIdx] || "0", 10);

    // 🎯 K8sGPT 패턴: 문제 감지
    if (CRITICAL_POD_STATUSES.includes(status)) {
      problems.push({
        resource: `pod/${name}`,
        namespace,
        issue: `Status: ${status}, Restarts: ${restarts}`,
        severity: "critical",
      });
    } else if (WARNING_POD_STATUSES.includes(status)) {
      problems.push({
        resource: `pod/${name}`,
        namespace,
        issue: `Status: ${status}`,
        severity: "warning",
      });
    } else if (restarts > HIGH_RESTART_THRESHOLD) {
      problems.push({
        resource: `pod/${name}`,
        namespace,
        issue: `High restart count: ${restarts}`,
        severity: "info",
      });
    } else {
      healthyCount++;
    }
  }

  // 심각도별 카운트
  const criticalCount = problems.filter((p) => p.severity === "critical").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;
  const infoCount = problems.filter((p) => p.severity === "info").length;

  // 요약 생성
  const summary = buildPodSummary(dataLines.length, healthyCount, problems, criticalCount, warningCount, infoCount);

  return {
    totalResources: dataLines.length,
    healthyCount,
    problems,
    summary,
    rawDataTruncated: stdout.length >= maxOutputChars,
    resourceType: "pods",
  };
}

/**
 * 🎯 Pod 요약 문자열 생성
 */
function buildPodSummary(
  total: number,
  healthy: number,
  problems: DetectedProblem[],
  critical: number,
  warning: number,
  info: number,
): string {
  const lines: string[] = [];

  // 헤더
  lines.push(`📊 Pod 분석 결과: 총 ${total}개`);
  lines.push(`✅ 정상: ${healthy}개`);

  if (problems.length > 0) {
    lines.push(`⚠️ 문제: ${problems.length}개 (Critical: ${critical}, Warning: ${warning}, Info: ${info})`);
    lines.push("");
    lines.push("🔴 주요 문제:");

    // 심각도 순 정렬 후 상위 N개만 표시
    const sortedProblems = [...problems].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const problem of sortedProblems.slice(0, MAX_PROBLEMS_IN_SUMMARY)) {
      const icon = problem.severity === "critical" ? "🔴" : problem.severity === "warning" ? "🟠" : "🔵";
      lines.push(`  ${icon} [${problem.namespace}] ${problem.resource}: ${problem.issue}`);
    }

    if (problems.length > MAX_PROBLEMS_IN_SUMMARY) {
      lines.push(`  ... 외 ${problems.length - MAX_PROBLEMS_IN_SUMMARY}개 문제`);
    }
  } else {
    lines.push("🎉 문제 없음 - 모든 Pod가 정상 상태입니다.");
  }

  return lines.join("\n");
}

// ============================================
// 🎯 Deployment 분석기
// ============================================

/**
 * 🎯 kubectl get deployments 결과 분석
 *
 * @param stdout - kubectl get deployments 결과 (텍스트)
 * @param maxOutputChars - 원본 데이터 최대 크기
 * @returns 분석 결과
 */
export function analyzeKubectlDeployments(stdout: string, maxOutputChars = 100000): KubectlAnalysisResult {
  const lines = stdout.split("\n").filter((line) => line.trim() !== "");
  const headerLine = lines[0] || "";
  const hasNamespaceColumn = headerLine.includes("NAMESPACE");
  const dataLines = lines.slice(1);
  const problems: DetectedProblem[] = [];
  let healthyCount = 0;

  for (const line of dataLines) {
    const columns = line.trim().split(/\s+/);

    const namespaceIdx = hasNamespaceColumn ? 0 : -1;
    const nameIdx = hasNamespaceColumn ? 1 : 0;
    const readyIdx = hasNamespaceColumn ? 2 : 1;
    const availableIdx = hasNamespaceColumn ? 4 : 3;

    const namespace = hasNamespaceColumn ? columns[namespaceIdx] : "default";
    const name = columns[nameIdx] || "unknown";
    const ready = columns[readyIdx] || "0/0";
    const available = parseInt(columns[availableIdx] || "0", 10);

    // Ready 파싱 (예: "2/3")
    const [currentReady, desiredReady] = ready.split("/").map((n) => parseInt(n, 10));

    // 🎯 문제 감지: Ready < Desired 또는 Available = 0
    if (currentReady < desiredReady) {
      const severity = available === 0 ? "critical" : "warning";
      problems.push({
        resource: `deployment/${name}`,
        namespace,
        issue: `Ready: ${ready}, Available: ${available}`,
        severity,
      });
    } else {
      healthyCount++;
    }
  }

  const criticalCount = problems.filter((p) => p.severity === "critical").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  const summary = buildDeploymentSummary(dataLines.length, healthyCount, problems, criticalCount, warningCount);

  return {
    totalResources: dataLines.length,
    healthyCount,
    problems,
    summary,
    rawDataTruncated: stdout.length >= maxOutputChars,
    resourceType: "deployments",
  };
}

/**
 * 🎯 Deployment 요약 문자열 생성
 */
function buildDeploymentSummary(
  total: number,
  healthy: number,
  problems: DetectedProblem[],
  critical: number,
  warning: number,
): string {
  const lines: string[] = [];

  lines.push(`📊 Deployment 분석 결과: 총 ${total}개`);
  lines.push(`✅ 정상: ${healthy}개`);

  if (problems.length > 0) {
    lines.push(`⚠️ 문제: ${problems.length}개 (Critical: ${critical}, Warning: ${warning})`);
    lines.push("");
    lines.push("🔴 주요 문제:");

    const sortedProblems = [...problems].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const problem of sortedProblems.slice(0, MAX_PROBLEMS_IN_SUMMARY)) {
      const icon = problem.severity === "critical" ? "🔴" : "🟠";
      lines.push(`  ${icon} [${problem.namespace}] ${problem.resource}: ${problem.issue}`);
    }

    if (problems.length > MAX_PROBLEMS_IN_SUMMARY) {
      lines.push(`  ... 외 ${problems.length - MAX_PROBLEMS_IN_SUMMARY}개 문제`);
    }
  } else {
    lines.push("🎉 문제 없음 - 모든 Deployment가 정상 상태입니다.");
  }

  return lines.join("\n");
}

// ============================================
// 🎯 Service 분석기
// ============================================

/**
 * 🎯 kubectl get services 결과 분석
 *
 * Service는 대부분 정상 상태이므로 간단한 요약만 제공
 *
 * @param stdout - kubectl get services 결과 (텍스트)
 * @param maxOutputChars - 원본 데이터 최대 크기
 * @returns 분석 결과
 */
export function analyzeKubectlServices(stdout: string, maxOutputChars = 100000): KubectlAnalysisResult {
  const lines = stdout.split("\n").filter((line) => line.trim() !== "");
  const headerLine = lines[0] || "";
  const hasNamespaceColumn = headerLine.includes("NAMESPACE");
  const dataLines = lines.slice(1);
  const problems: DetectedProblem[] = [];

  // Service 타입별 카운트
  const typeCounts: Record<string, number> = {};

  for (const line of dataLines) {
    const columns = line.trim().split(/\s+/);

    const typeIdx = hasNamespaceColumn ? 2 : 1;
    const serviceType = columns[typeIdx] || "Unknown";

    typeCounts[serviceType] = (typeCounts[serviceType] || 0) + 1;

    // Service는 특별한 문제 감지 로직 없음 (대부분 정상)
    // 필요시 ExternalIP 누락 등 체크 가능
  }

  const typeBreakdown = Object.entries(typeCounts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const summary = [
    `📊 Service 분석 결과: 총 ${dataLines.length}개`,
    `📋 타입별: ${typeBreakdown}`,
    "✅ Service는 문제 감지 대상이 아닙니다.",
  ].join("\n");

  return {
    totalResources: dataLines.length,
    healthyCount: dataLines.length,
    problems,
    summary,
    rawDataTruncated: stdout.length >= maxOutputChars,
    resourceType: "services",
  };
}

// ============================================
// 🎯 범용 Analyzer 라우터
// ============================================

/**
 * 🎯 kubectl 명령과 리소스 타입에 따라 적절한 Analyzer 호출
 *
 * @param command - kubectl 명령 (get, describe 등)
 * @param resourceType - 리소스 타입 (pods, deployments, services 등)
 * @param stdout - kubectl 결과
 * @returns 분석 결과 또는 null (지원하지 않는 리소스)
 */
export function analyzeKubectlResult(
  command: string,
  resourceType: string,
  stdout: string,
): KubectlAnalysisResult | null {
  // get 명령만 분석 (describe, logs 등은 패스)
  if (command !== "get") {
    return null;
  }

  // 리소스 타입 정규화 (복수형/단수형 통일)
  const normalizedType = resourceType.toLowerCase().replace(/s$/, "");

  switch (normalizedType) {
    case "pod":
      return analyzeKubectlPods(stdout);
    case "deployment":
      return analyzeKubectlDeployments(stdout);
    case "service":
      return analyzeKubectlServices(stdout);
    default:
      // 지원하지 않는 리소스는 null 반환 (원본 유지)
      return null;
  }
}

// ============================================
// 🎯 대규모 클러스터 감지
// ============================================

/**
 * 🎯 대규모 클러스터 여부 확인
 *
 * @param namespaceCount - 네임스페이스 개수
 * @returns 대규모 클러스터 여부
 *
 * 📝 기준:
 * - 20개 이상 네임스페이스 = 대규모 클러스터
 * - 50개 이상 = 엔터프라이즈급
 */
export function isLargeCluster(namespaceCount: number): boolean {
  return namespaceCount >= 20;
}

/**
 * 🎯 대규모 클러스터 경고 메시지 생성
 *
 * @param namespaceCount - 네임스페이스 개수
 * @returns 경고 메시지
 */
export function buildLargeClusterWarning(namespaceCount: number): string {
  return `⚠️ 대규모 클러스터 감지: ${namespaceCount}개 네임스페이스

전체 클러스터 조회 시 응답 시간이 길어질 수 있습니다.
특정 네임스페이스를 지정해주세요:
  /finops -n production
  /pods -n default
  kubectl get pods -n <namespace>`;
}
