/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { K8sEvent, MonitorClusterConfig, MonitorRule } from "../../common/monitor-types";

/**
 * 목적: 프리셋 레벨별 이벤트 필터링
 */
export function filterByPreset(level: MonitorClusterConfig["presetLevel"], events: K8sEvent[]): K8sEvent[] {
  if (level === "strict") {
    return events;
  }

  if (level === "standard") {
    return events.filter((e) => e.severity !== "info");
  }

  // basic: 핵심 리소스만, critical/warning만
  const basicKinds = new Set(["event", "pod", "node", "deployment", "statefulset", "pvc"]);
  return events.filter((e) => basicKinds.has(e.kind) && e.severity !== "info");
}

/**
 * 목적: 커스텀 룰 매칭 결과를 이벤트로 변환
 *
 * 📝 커스텀 룰은 프리셋 필터와 독립적으로 동작해야 하므로,
 *    호출 시 필터링 전의 전체 이벤트를 전달할 것
 */
export function applyCustomRules(rules: MonitorRule[], events: K8sEvent[]): K8sEvent[] {
  const matched: K8sEvent[] = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    for (const event of events) {
      if (!matchesRule(rule, event)) {
        continue;
      }

      matched.push({
        kind: "rule",
        name: `${event.name}:${rule.id}`,
        namespace: event.namespace,
        message: `Rule matched: ${rule.description}`,
        source: "custom-rule",
        severity: rule.severity,
        timestamp: Date.now(),
        raw: {
          event,
          rule,
        },
      });
    }
  }

  return matched;
}

/**
 * 목적: 단일 룰 조건 매칭
 *
 * 📝 2026-02-27: resource 타입 필터 + field별 퍼센트 추출 추가
 */
function matchesRule(rule: MonitorRule, event: K8sEvent): boolean {
  // resource 타입이 지정된 경우, 이벤트 kind와 비교
  if (rule.condition.resource && rule.condition.resource !== "event") {
    if (event.kind !== rule.condition.resource) {
      return false;
    }
  }

  const target = `${event.message} ${event.reason ?? ""} ${event.name}`.toLowerCase();
  const value = rule.condition.value.toLowerCase();

  switch (rule.condition.operator) {
    case "contains":
      return target.includes(value);
    case "eq":
      return target.trim() === value.trim();
    case "regex": {
      try {
        return new RegExp(rule.condition.value, "i").test(target);
      } catch {
        return false;
      }
    }
    case "gt":
    case "lt": {
      const lhs = extractFieldPercent(target, rule.condition.field);
      const rhs = Number(rule.condition.value);
      if (Number.isNaN(lhs) || Number.isNaN(rhs)) {
        return false;
      }
      return rule.condition.operator === "gt" ? lhs > rhs : lhs < rhs;
    }
    default:
      return false;
  }
}

/**
 * 목적: 특정 필드의 퍼센트 값을 추출
 *
 * 📝 2026-02-27: field 지정 시 해당 필드 값만 추출
 * - field=memory_percent → "memory=XX%" 에서 XX 추출
 * - field=cpu_percent → "cpu=XX%" 에서 XX 추출
 * - field 없으면 모든 퍼센트 중 최댓값 반환
 */
function extractFieldPercent(text: string, field?: string): number {
  if (field === "memory_percent") {
    const match = text.match(/memory\s*=?\s*(\d{1,3})\s*%/i);
    return match ? Number(match[1]) : Number.NaN;
  }

  if (field === "cpu_percent") {
    const match = text.match(/cpu\s*=?\s*(\d{1,3})\s*%/i);
    return match ? Number(match[1]) : Number.NaN;
  }

  // field 미지정: 모든 퍼센트 값 중 최댓값
  const matches = [...text.matchAll(/(\d{1,3})\s*%/g)];
  if (matches.length === 0) return Number.NaN;
  return Math.max(...matches.map((m) => Number(m[1])));
}
