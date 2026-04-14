/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { MonitorAgent } from "./monitor-agent";

import type { MonitorCommand, MonitorEvent } from "../../common/monitor-ipc-protocol";

/**
 * 목적: utility process parentPort 안전 접근
 */
function getParentPort(): {
  on: (event: string, cb: (arg: any) => void) => void;
  postMessage: (msg: any) => void;
} | null {
  return (process as any).parentPort ?? null;
}

let monitorAgent: MonitorAgent | null = null;

/**
 * 목적: 워커 이벤트 전송 헬퍼
 */
function emit(event: MonitorEvent): void {
  console.log("[MonitorWorker] Emitting event:", event.type);
  getParentPort()?.postMessage(event);
}

/**
 * 목적: 워커 명령 핸들러 등록
 */
function setupWorker(): void {
  console.log("[MonitorWorker] setupWorker() called");
  const parentPort = getParentPort();
  if (!parentPort) {
    console.log("[MonitorWorker] No parentPort available — not running as utility process");
    return;
  }

  parentPort.on("message", ({ data }: { data: MonitorCommand }) => {
    if (!data) {
      console.log("[MonitorWorker] Received empty message");
      return;
    }

    console.log("[MonitorWorker] Received command:", data.type);

    switch (data.type) {
      case "configure":
        console.log(
          "[MonitorWorker] Configuring agent:",
          JSON.stringify({
            enabled: data.config.enabled,
            clusterCount: data.config.clusters.length,
            clusters: data.config.clusters.map((c) => ({ id: c.id, name: c.name, preset: c.presetLevel })),
            intervalMs: data.config.intervalMs,
            provider: data.config.provider,
            hasApiKey: !!data.config.apiKey,
            kubectlPath: data.config.kubectlPath,
          }),
        );
        if (monitorAgent) {
          monitorAgent.stop();
        }

        monitorAgent = new MonitorAgent(data.config, {
          onAlert: (alert) => {
            console.log("[MonitorWorker] Alert generated:", alert.severity, alert.summary);
            emit({ type: "alert", alert });
          },
          onStatus: (status) => {
            console.log("[MonitorWorker] Status:", status.clusterId, status.health, "findings:", status.findingCount);
            emit({ type: "status", status });
          },
          onCheckComplete: (clusterId, findingCount) => {
            console.log("[MonitorWorker] Check complete:", clusterId, "findings:", findingCount);
            emit({ type: "check-complete", clusterId, findingCount });
          },
          onError: (error, clusterId) => {
            console.log("[MonitorWorker] Error:", error, "cluster:", clusterId);
            emit({ type: "error", error, clusterId });
          },
        });
        monitorAgent.start();
        console.log("[MonitorWorker] Agent started");
        break;
      case "check-now":
        console.log("[MonitorWorker] Check-now for cluster:", data.clusterId);
        monitorAgent?.checkCluster(data.clusterId).catch((error) => {
          emit({ type: "error", error: String(error), clusterId: data.clusterId });
        });
        break;
      case "add-rule": {
        // 📝 2026-02-27: 이미 파싱된 rule 객체를 그대로 사용 (재파싱 제거)
        const rule = data.rule;
        if (monitorAgent) {
          monitorAgent.addCustomRule(data.clusterId, rule);
          emit({ type: "rule-added", clusterId: data.clusterId, rule });
        } else {
          emit({ type: "error", error: "Monitor agent not running", clusterId: data.clusterId });
        }
        break;
      }
      case "stop":
        console.log("[MonitorWorker] Stopping agent");
        monitorAgent?.stop();
        monitorAgent = null;
        break;
      default:
        emit({ type: "error", error: "Unsupported worker command" });
    }
  });

  console.log("[MonitorWorker] Emitting ready");
  emit({ type: "ready" });
}

setupWorker();
