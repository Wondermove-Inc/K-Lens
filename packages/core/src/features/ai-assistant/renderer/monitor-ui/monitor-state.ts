/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed, makeAutoObservable } from "mobx";

import type { MonitorAlert, MonitorStatus } from "../../common/monitor-types";

export type SeverityFilter = "all" | "critical" | "warning" | "info";

/**
 * 목적: Monitor UI 상태 저장소
 */
export class MonitorState {
  alerts: MonitorAlert[] = [];
  statuses = new Map<string, MonitorStatus>();
  acknowledgedFindingIds: Set<string> = new Set();
  severityFilter: SeverityFilter = "all";

  constructor() {
    makeAutoObservable(this, {
      unacknowledgedCount: computed,
      filteredAlerts: computed,
    });
  }

  /**
   * 목적: 알림 추가 (동일 클러스터+요약+심각도 중복 방지)
   */
  pushAlert(alert: MonitorAlert): void {
    const isDuplicate = this.alerts.some(
      (a) =>
        a.clusterId === alert.clusterId &&
        a.severity === alert.severity &&
        a.summary === alert.summary &&
        Math.abs(a.timestamp - alert.timestamp) < 60_000,
    );

    if (isDuplicate) {
      console.log("[MonitorState] Duplicate alert suppressed:", alert.summary);
      return;
    }

    this.alerts.unshift(alert);
    this.alerts = this.alerts.slice(0, 50);
  }

  /**
   * 목적: 상태 업데이트
   */
  setStatus(status: MonitorStatus): void {
    this.statuses.set(status.clusterId, status);
  }

  /**
   * 목적: 마지막 알림 반환
   */
  get latestAlert(): MonitorAlert | undefined {
    return this.alerts[0];
  }

  /**
   * 목적: finding을 확인 처리
   */
  acknowledgeFinding(findingId: string): void {
    this.acknowledgedFindingIds.add(findingId);
  }

  /**
   * 목적: severity 필터 변경
   */
  setSeverityFilter(filter: SeverityFilter): void {
    this.severityFilter = filter;
  }

  /**
   * 목적: 미확인 finding 개수
   */
  get unacknowledgedCount(): number {
    let count = 0;
    for (const alert of this.alerts) {
      for (const finding of alert.findings) {
        if (!this.acknowledgedFindingIds.has(finding.id)) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * 목적: severity 필터 적용된 알림 목록
   */
  get filteredAlerts(): MonitorAlert[] {
    if (this.severityFilter === "all") {
      return this.alerts;
    }
    return this.alerts.filter((a) => a.severity === this.severityFilter);
  }

  /**
   * 목적: 모든 알림 클리어
   */
  clearAll(): void {
    this.alerts = [];
    this.acknowledgedFindingIds.clear();
  }
}

/**
 * 목적: 싱글톤 monitor 상태
 */
export const monitorState = new MonitorState();
