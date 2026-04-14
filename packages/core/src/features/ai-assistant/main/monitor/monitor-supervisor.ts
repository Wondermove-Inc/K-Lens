/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Notification, utilityProcess } from "electron";
import path from "path";

import type { UtilityProcess } from "electron";

import type { MonitorCommand, MonitorEvent } from "../../common/monitor-ipc-protocol";
import type { MonitorAlert, MonitorConfig, MonitorRule, MonitorStatus } from "../../common/monitor-types";

/**
 * 목적: MonitorSupervisor 의존성 타입
 */
export interface MonitorSupervisorDependencies {
  workerPath: string;
  onAlert(alert: MonitorAlert): void;
  onStatus(status: MonitorStatus): void;
  onStatusIcon(severity: "critical" | "warning" | "info" | "normal"): void;
  onStatusMessage(message: string): void;
}

/**
 * 목적: utility process 워커 생명주기 관리자
 */
export class MonitorSupervisor {
  private worker: UtilityProcess | null = null;
  private restartCount = 0;
  private currentConfig: MonitorConfig | null = null;
  private statuses = new Map<string, MonitorStatus>();
  private readonly maxRestarts = 5;
  private readonly restartDelayMs = 3000;

  constructor(private readonly dependencies: MonitorSupervisorDependencies) {}

  /**
   * 목적: 감시 워커 시작
   */
  start(config: MonitorConfig): void {
    this.currentConfig = config;

    if (this.worker) {
      this.stop();
    }

    const resolvedPath = path.resolve(this.dependencies.workerPath);
    console.log("[MonitorSupervisor] Starting worker:", resolvedPath);
    console.log(
      "[MonitorSupervisor] Config:",
      JSON.stringify({
        enabled: config.enabled,
        provider: config.provider,
        clusterCount: config.clusters.length,
        intervalMs: config.intervalMs,
        hasApiKey: !!config.apiKey,
        kubectlPath: config.kubectlPath,
      }),
    );

    this.worker = utilityProcess.fork(resolvedPath, [], {
      serviceName: "Cluster Monitor",
    });

    this.worker.on("message", (message: MonitorEvent) => {
      console.log("[MonitorSupervisor] Worker message received:", JSON.stringify(message).slice(0, 200));
      this.handleEvent(message);
    });
    this.worker.on("exit", (code) => {
      console.log("[MonitorSupervisor] Worker exited with code:", code);
      this.handleExit(code);
    });
  }

  /**
   * 목적: 감시 워커 중단
   */
  stop(): void {
    this.send({ type: "stop" });
    this.worker?.kill();
    this.worker = null;
    this.restartCount = 0;
  }

  /**
   * 목적: 워커 설정 갱신
   */
  updateConfig(config: MonitorConfig): void {
    this.currentConfig = config;
    this.send({ type: "configure", config });
  }

  /**
   * 목적: 단일 클러스터 즉시 점검 트리거
   */
  triggerCheck(clusterId: string): void {
    this.send({ type: "check-now", clusterId });
  }

  /**
   * 목적: 실행 중인 워커에 커스텀 룰 추가
   *
   * 📝 2026-02-27: currentConfig도 갱신하여 워커 재시작 시 룰 보존
   */
  addRule(clusterId: string, rule: MonitorRule): void {
    if (this.currentConfig) {
      const cluster = this.currentConfig.clusters.find((c) => c.id === clusterId);
      if (cluster) {
        cluster.customRules = [...(cluster.customRules ?? []), rule];
      }
    }
    this.send({ type: "add-rule", clusterId, rule });
  }

  /**
   * 목적: 워커 프로세스 활성 여부
   */
  isRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * 목적: 마지막 상태 목록 반환
   */
  getStatuses(): MonitorStatus[] {
    return [...this.statuses.values()];
  }

  /**
   * 목적: 워커 메시지 전송
   */
  private send(command: MonitorCommand): void {
    if (!this.worker) {
      console.log("[MonitorSupervisor] send() called but no worker");
      return;
    }

    console.log("[MonitorSupervisor] Sending command to worker:", command.type);
    this.worker.postMessage(command);
  }

  /**
   * 목적: 워커 이벤트 처리
   */
  private handleEvent(event: MonitorEvent): void {
    switch (event.type) {
      case "ready":
        if (this.currentConfig) {
          this.send({ type: "configure", config: this.currentConfig });
          this.restartCount = 0;
        }
        break;
      case "alert":
        if (!event.alert) break;
        this.showNotification(event.alert);
        this.dependencies.onAlert(event.alert);
        this.dependencies.onStatusIcon(event.alert.severity);
        break;
      case "status":
        if (!event.status) break;
        this.statuses.set(event.status.clusterId, event.status);
        this.dependencies.onStatus(event.status);
        this.dependencies.onStatusIcon(
          event.status.health === "critical" ? "critical" : event.status.health === "degraded" ? "warning" : "normal",
        );
        break;
      case "error":
        if (!event.error) break;
        this.dependencies.onStatusMessage(event.error);
        break;
      case "check-complete":
        this.dependencies.onStatusMessage(`Monitor check complete: ${event.clusterId} (${event.findingCount})`);
        break;
      case "rule-added":
        this.dependencies.onStatusMessage(`Custom rule added: ${event.rule.id} for cluster ${event.clusterId}`);
        break;
      default:
        this.dependencies.onStatusMessage("Unknown monitor worker event");
    }
  }

  /**
   * 목적: 워커 종료 처리 및 자동 재시작
   */
  private handleExit(code: number): void {
    this.worker = null;

    if (code === 0 || !this.currentConfig) {
      return;
    }

    if (this.restartCount >= this.maxRestarts) {
      this.dependencies.onStatusMessage("감시 에이전트가 반복 실패하여 중단되었습니다.");
      return;
    }

    this.restartCount += 1;
    setTimeout(() => {
      if (this.currentConfig) {
        this.start(this.currentConfig);
      }
    }, this.restartDelayMs);
  }

  /**
   * 목적: OS 네이티브 알림 표시
   */
  private showNotification(alert: MonitorAlert): void {
    if (!Notification.isSupported()) {
      return;
    }

    const first = alert.findings?.[0];
    const body = first ? `${alert.summary}\n${first.title}\n${first.suggestedCommands?.[0] ?? ""}` : alert.summary;

    const notification = new Notification({
      title: `[${alert.clusterName}] ${alert.severity.toUpperCase()}`,
      body,
      silent: false,
    });

    notification.show();
  }
}
