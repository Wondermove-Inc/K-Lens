/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { execFile } from "child_process";
import pLimit from "p-limit";
import { promisify } from "util";
import { validateEvalCommand } from "./natural-language-rule-parser";

import type { CustomRuleEvalResult, K8sEvent, MonitorClusterConfig, MonitorRule } from "../../common/monitor-types";

const execFileAsync = promisify(execFile);

/**
 * 목적: kubectl 기반 감시 데이터 수집기
 */
export class MonitorCollector {
  private readonly processLimit = pLimit(5);

  constructor(private readonly kubectlPath: string) {}

  /**
   * 목적: 단일 클러스터 이벤트 수집
   *
   * @param cluster - 클러스터 설정
   * @param maxAgeMs - 이벤트 최대 연령 (ms). 이보다 오래된 이벤트는 제외. 기본 10분.
   */
  async collect(cluster: MonitorClusterConfig, maxAgeMs = 10 * 60 * 1000): Promise<K8sEvent[]> {
    console.log(
      "[MonitorCollector] Collecting from cluster:",
      cluster.name,
      "kubeconfig:",
      cluster.kubeconfigPath,
      "kubectl:",
      this.kubectlPath,
    );
    const kp = cluster.kubeconfigPath;
    const commands = [
      // 기존 5개
      this.run(kp, ["get", "events", "-A", "--field-selector=type!=Normal", "--sort-by=.lastTimestamp", "-o", "json"]),
      this.run(kp, [
        "get",
        "pods",
        "-A",
        "--field-selector=status.phase!=Running,status.phase!=Succeeded",
        "-o",
        "json",
      ]),
      this.run(kp, ["top", "nodes", "--no-headers"]),
      this.run(kp, ["get", "nodes", "-o", "json"]),
      this.run(kp, ["get", "endpoints", "-A", "-o", "json"]),
      // 추가 6개
      this.run(kp, ["get", "deployments", "-A", "-o", "json"]),
      this.run(kp, ["get", "statefulsets", "-A", "-o", "json"]),
      this.run(kp, ["get", "pvc", "-A", "-o", "json"]),
      this.run(kp, ["get", "ingress", "-A", "-o", "json"]),
      this.run(kp, ["get", "services", "-A", "-o", "json"]),
      this.run(kp, ["get", "jobs", "-A", "-o", "json"]),
    ];

    const results = await Promise.allSettled(commands);
    // 0=events, 1=pods, 2=nodesTop, 3=nodes, 4=endpoints,
    // 5=deployments, 6=statefulsets, 7=pvc, 8=ingress, 9=services, 10=jobs
    console.log("[MonitorCollector] Results —", results.map((r, i) => `${i}:${r.status}`).join(", "));

    const events = this.parseEvents(results[0]);
    const pods = this.parsePods(results[1]);
    const nodesTop = this.parseNodeTop(results[2]);
    const nodeConditions = this.parseNodeConditions(results[3]);
    const endpoints = this.parseEndpoints(results[4]);
    const serviceNames = this.parseServiceNames(results[9]);
    const deployments = this.parseDeployments(results[5]);
    const statefulsets = this.parseStatefulSets(results[6]);
    const pvcs = this.parsePVCs(results[7], results[0]);
    const ingresses = this.parseIngresses(results[8], serviceNames);
    const jobs = this.parseJobs(results[10]);
    console.log(
      "[MonitorCollector] Parsed — events:",
      events.length,
      "pods:",
      pods.length,
      "nodesTop:",
      nodesTop.length,
      "nodeConditions:",
      nodeConditions.length,
      "endpoints:",
      endpoints.length,
      "deployments:",
      deployments.length,
      "statefulsets:",
      statefulsets.length,
      "pvcs:",
      pvcs.length,
      "ingresses:",
      ingresses.length,
      "jobs:",
      jobs.length,
    );

    const cutoff = Date.now() - maxAgeMs;
    const all = [
      ...events,
      ...pods,
      ...nodesTop,
      ...nodeConditions,
      ...endpoints,
      ...deployments,
      ...statefulsets,
      ...pvcs,
      ...ingresses,
      ...jobs,
    ];
    const fresh = all.filter((e) => e.timestamp >= cutoff);
    console.log("[MonitorCollector] After age filter (max:", maxAgeMs, "ms):", fresh.length, "of", all.length);

    return fresh;
  }

  /**
   * 목적: evalCommand가 있는 커스텀 룰의 kubectl 결과 사전 수집
   */
  async collectCustomRuleResults(cluster: MonitorClusterConfig, rules: MonitorRule[]): Promise<CustomRuleEvalResult[]> {
    const evalRules = rules.filter((r) => r.enabled && r.evalCommand);
    if (evalRules.length === 0) return [];

    // 동일 evalCommand 중복 제거
    const uniqueCommands = new Map<string, MonitorRule[]>();
    for (const rule of evalRules) {
      const validation = validateEvalCommand(rule.evalCommand!);
      if (!validation.valid) {
        console.warn(`[MonitorCollector] evalCommand rejected at runtime: ${validation.error}`);
        continue;
      }
      const existing = uniqueCommands.get(rule.evalCommand!) ?? [];
      existing.push(rule);
      uniqueCommands.set(rule.evalCommand!, existing);
    }

    const commandEntries = [...uniqueCommands.entries()];
    const results = await Promise.allSettled(
      commandEntries.map(([cmd]) => this.run(cluster.kubeconfigPath, cmd.split(/\s+/))),
    );

    const evalResults: CustomRuleEvalResult[] = [];
    commandEntries.forEach(([cmd, cmdRules], idx) => {
      const result = results[idx];
      const output =
        result.status === "fulfilled"
          ? result.value.length > 4000
            ? result.value.slice(0, 4000) + "\n...(truncated)"
            : result.value
          : "";
      const error = result.status === "rejected" ? String(result.reason) : undefined;

      for (const rule of cmdRules) {
        evalResults.push({
          ruleId: rule.id,
          ruleDescription: rule.description,
          evalCommand: cmd,
          output,
          error,
          severity: rule.severity,
          interpretHint: rule.evalInterpretHint,
        });
      }
    });

    return evalResults;
  }

  /**
   * 목적: kubectl 커맨드 실행
   */
  private async run(kubeconfigPath: string, args: string[]): Promise<string> {
    return this.processLimit(async () => {
      const { stdout } = await execFileAsync(this.kubectlPath, [...args, "--kubeconfig", kubeconfigPath], {
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      });

      return stdout || "";
    });
  }

  /**
   * 목적: 이벤트 목록 파싱
   */
  private parseEvents(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") {
      return [];
    }

    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    return items.map((item: any) => ({
      kind: "event" as const,
      uid: item?.metadata?.uid,
      namespace: item?.metadata?.namespace,
      name: item?.involvedObject?.name ?? item?.metadata?.name ?? "unknown",
      reason: item?.reason,
      message: item?.message ?? "unknown event",
      severity: this.inferSeverity(item?.type, item?.reason),
      source: "k8s-event",
      timestamp: this.toTimestamp(item?.lastTimestamp ?? item?.eventTime),
      raw: item,
    }));
  }

  /**
   * 목적: 비정상 Pod 파싱 (컨테이너 레벨 상태 세분화)
   */
  private parsePods(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") {
      return [];
    }

    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const item of items) {
      const containers = item?.status?.containerStatuses ?? [];
      const initContainers = item?.status?.initContainerStatuses ?? [];
      const allContainers = [...initContainers, ...containers];
      const ns = item?.metadata?.namespace;
      const podName = item?.metadata?.name ?? "unknown-pod";
      const uid = item?.metadata?.uid;

      // 컨테이너별 상태 체크 (Pod별 카운터로 폴백 판정)
      let containerIssueCount = 0;

      for (const cs of allContainers) {
        const waiting = cs?.state?.waiting;
        const terminated = cs?.lastState?.terminated;

        if (waiting?.reason) {
          containerIssueCount++;
          events.push({
            kind: "pod",
            uid,
            namespace: ns,
            name: podName,
            reason: waiting.reason,
            message: `Container ${cs?.name ?? "unknown"}: ${waiting.reason}${waiting.message ? ` — ${waiting.message}` : ""}`,
            severity: this.inferPodSeverity(waiting.reason),
            source: "k8s-pod",
            timestamp: Date.now(),
            containerName: cs?.name,
            restartCount: cs.restartCount ?? 0,
            raw: item,
          });
          continue;
        }

        if (terminated?.reason === "OOMKilled") {
          containerIssueCount++;
          events.push({
            kind: "pod",
            uid,
            namespace: ns,
            name: podName,
            reason: "OOMKilled",
            message: `Container ${cs?.name ?? "unknown"}: OOMKilled (exitCode=${terminated.exitCode})`,
            severity: "critical",
            source: "k8s-pod",
            timestamp: Date.now(),
            containerName: cs?.name,
            restartCount: cs.restartCount ?? 0,
            raw: item,
          });
          continue;
        }

        // restartCount 높으면 경고 (waiting.reason 없어도)
        if ((cs.restartCount ?? 0) >= 5 && cs.ready === false) {
          containerIssueCount++;
          events.push({
            kind: "pod",
            uid,
            namespace: ns,
            name: podName,
            reason: "HighRestartCount",
            message: `Container ${cs?.name ?? "unknown"}: ${cs.restartCount} restarts, not ready`,
            severity: "warning",
            source: "k8s-pod",
            timestamp: Date.now(),
            containerName: cs?.name,
            restartCount: cs.restartCount ?? 0,
            raw: item,
          });
        }
      }

      // 컨테이너 레벨에서 아무것도 안 잡혔으면 기존 phase 기반 폴백
      if (containerIssueCount === 0) {
        events.push({
          kind: "pod",
          uid,
          namespace: ns,
          name: podName,
          reason: item?.status?.phase,
          message: `Pod phase=${item?.status?.phase ?? "Unknown"}`,
          severity: item?.status?.phase === "Failed" ? "critical" : "warning",
          source: "k8s-pod",
          timestamp: Date.now(),
          raw: item,
        });
      }
    }

    return events;
  }

  /**
   * 목적: 노드 top 출력 파싱
   */
  private parseNodeTop(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") {
      return [];
    }

    const lines = result.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const events: K8sEvent[] = [];

    for (const line of lines) {
      const fields = line.split(/\s+/);
      if (fields.length < 5) {
        continue;
      }

      const nodeName = fields[0];
      const cpuPercent = Number((fields[2] || "0%").replace("%", ""));
      const memoryPercent = Number((fields[4] || "0%").replace("%", ""));
      const maxPercent = Math.max(cpuPercent, memoryPercent);

      if (maxPercent < 80) {
        continue;
      }

      events.push({
        kind: "node",
        name: nodeName,
        message: `Node resource usage high cpu=${cpuPercent}% memory=${memoryPercent}%`,
        severity: maxPercent >= 90 ? "critical" : "warning",
        source: "k8s-top",
        timestamp: Date.now(),
        raw: { line },
      });
    }

    return events;
  }

  /**
   * 목적: 노드 conditions 파싱 (NotReady, Pressure 등)
   */
  private parseNodeConditions(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") return [];

    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const node of items) {
      const conditions = node?.status?.conditions ?? [];
      const nodeName = node?.metadata?.name ?? "unknown-node";

      for (const cond of conditions) {
        // Ready=False or Unknown → 노드 비정상
        if (cond.type === "Ready" && cond.status !== "True") {
          events.push({
            kind: "node",
            name: nodeName,
            reason: "NotReady",
            message: `Node ${nodeName}: Ready=${cond.status} — ${cond.message ?? ""}`,
            severity: "critical",
            source: "k8s-node-condition",
            timestamp: this.toTimestamp(cond.lastTransitionTime),
          });
        }

        // Pressure 조건 = True → 문제
        if (
          ["MemoryPressure", "DiskPressure", "PIDPressure", "NetworkUnavailable"].includes(cond.type) &&
          cond.status === "True"
        ) {
          events.push({
            kind: "node",
            name: nodeName,
            reason: cond.type,
            message: `Node ${nodeName}: ${cond.type}=True — ${cond.message ?? ""}`,
            severity: "critical",
            source: "k8s-node-condition",
            timestamp: this.toTimestamp(cond.lastTransitionTime),
          });
        }
      }
    }

    return events;
  }

  /**
   * 목적: Service endpoint 부재 감지
   */
  private parseEndpoints(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") return [];

    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const ep of items) {
      const ns = ep?.metadata?.namespace;
      const name = ep?.metadata?.name ?? "unknown";

      // Leader election endpoints 스킵 (k8sgpt 패턴)
      if (ep?.metadata?.annotations?.["control-plane.alpha.kubernetes.io/leader"]) continue;

      // kube-system 기본 서비스 스킵
      if (ns === "kube-system") continue;

      const subsets = ep?.subsets ?? [];
      const hasAddresses = subsets.some((s: any) => Array.isArray(s.addresses) && s.addresses.length > 0);

      if (!hasAddresses) {
        events.push({
          kind: "event",
          namespace: ns,
          name,
          reason: "NoEndpoints",
          message: `Service ${ns}/${name} has no ready endpoints`,
          severity: "warning",
          source: "k8s-endpoint",
          timestamp: Date.now(),
        });
      }

      // notReadyAddresses 체크
      const notReadyCount = subsets.reduce((sum: number, s: any) => sum + (s.notReadyAddresses?.length ?? 0), 0);
      if (notReadyCount > 0 && hasAddresses) {
        events.push({
          kind: "event",
          namespace: ns,
          name,
          reason: "EndpointsNotReady",
          message: `Service ${ns}/${name}: ${notReadyCount} endpoints not ready`,
          severity: "info",
          source: "k8s-endpoint",
          timestamp: Date.now(),
        });
      }
    }

    return events;
  }

  /**
   * 목적: Deployment 상태 파싱 (롤링 업데이트 감지)
   */
  private parseDeployments(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") return [];
    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const item of items) {
      const ns = item?.metadata?.namespace;
      const name = item?.metadata?.name ?? "unknown";
      const specReplicas = item?.spec?.replicas ?? 1;
      const readyReplicas = item?.status?.readyReplicas ?? 0;

      if (specReplicas === 0) continue;
      if (readyReplicas >= specReplicas) continue;

      // 롤링 업데이트 감지 (k8sgpt는 이 체크 없음 → false positive)
      const conditions = item?.status?.conditions ?? [];
      const progressing = conditions.find((c: any) => c.type === "Progressing");
      const isRolling = progressing?.status === "True" && progressing?.reason === "ReplicaSetUpdated";

      const severity = readyReplicas === 0 && !isRolling ? "critical" : isRolling ? "info" : "warning";

      events.push({
        kind: "deployment",
        namespace: ns,
        name,
        reason: isRolling ? "RollingUpdate" : "ReplicasMismatch",
        message: `Deployment ${ns}/${name}: ${readyReplicas}/${specReplicas} replicas ready${isRolling ? " (rolling update)" : ""}`,
        severity,
        source: "k8s-deployment",
        timestamp: Date.now(),
      });
    }
    return events;
  }

  /**
   * 목적: StatefulSet 상태 파싱 (업데이트 진행 중 감지)
   */
  private parseStatefulSets(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") return [];
    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const item of items) {
      const ns = item?.metadata?.namespace;
      const name = item?.metadata?.name ?? "unknown";
      const specReplicas = item?.spec?.replicas ?? 1;
      const readyReplicas = item?.status?.readyReplicas ?? 0;

      if (specReplicas === 0) continue;
      if (readyReplicas >= specReplicas) continue;

      const isUpdating = item?.status?.updateRevision && item.status.updateRevision !== item.status.currentRevision;

      const severity = readyReplicas === 0 && !isUpdating ? "critical" : isUpdating ? "info" : "warning";

      events.push({
        kind: "statefulset",
        namespace: ns,
        name,
        reason: isUpdating ? "Updating" : "ReplicasMismatch",
        message: `StatefulSet ${ns}/${name}: ${readyReplicas}/${specReplicas} replicas ready${isUpdating ? " (updating)" : ""}`,
        severity,
        source: "k8s-statefulset",
        timestamp: Date.now(),
      });
    }
    return events;
  }

  /**
   * 목적: PVC 상태 파싱 (ProvisioningFailed event 기반 필터링)
   */
  private parsePVCs(result: PromiseSettledResult<string>, eventsResult: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") return [];
    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    // 이미 수집한 events에서 PVC 관련 ProvisioningFailed 추출
    const provisionFailedPVCs = new Set<string>();
    if (eventsResult.status === "fulfilled") {
      const evtParsed = this.safeJson(eventsResult.value);
      for (const evt of evtParsed?.items ?? []) {
        if (evt?.reason === "ProvisioningFailed" && evt?.involvedObject?.kind === "PersistentVolumeClaim") {
          provisionFailedPVCs.add(`${evt.involvedObject.namespace}/${evt.involvedObject.name}`);
        }
      }
    }

    const events: K8sEvent[] = [];
    for (const item of items) {
      const ns = item?.metadata?.namespace;
      const name = item?.metadata?.name ?? "unknown";
      const phase = item?.status?.phase;

      if (phase === "Bound") continue;

      if (phase === "Lost") {
        events.push({
          kind: "pvc",
          namespace: ns,
          name,
          reason: "Lost",
          message: `PVC ${ns}/${name}: phase=Lost`,
          severity: "critical",
          source: "k8s-pvc",
          timestamp: Date.now(),
        });
        continue;
      }

      if (phase === "Pending") {
        if (!provisionFailedPVCs.has(`${ns}/${name}`)) continue;

        const storageClass = item?.spec?.storageClassName;
        events.push({
          kind: "pvc",
          namespace: ns,
          name,
          reason: "ProvisioningFailed",
          message: `PVC ${ns}/${name}: Pending (ProvisioningFailed)${storageClass ? ` storageClass=${storageClass}` : ""}`,
          severity: "warning",
          source: "k8s-pvc",
          timestamp: Date.now(),
        });
      }
    }
    return events;
  }

  /**
   * 목적: Ingress 백엔드 Service 존재 검증
   */
  private parseIngresses(result: PromiseSettledResult<string>, serviceNames: Set<string>): K8sEvent[] {
    if (result.status === "rejected") return [];
    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const item of items) {
      const ns = item?.metadata?.namespace;
      const ingressName = item?.metadata?.name ?? "unknown";
      const rules = item?.spec?.rules ?? [];

      for (const rule of rules) {
        for (const path of rule?.http?.paths ?? []) {
          // networking.k8s.io/v1 + v1beta1 폴백
          const svcName = path?.backend?.service?.name ?? path?.backend?.serviceName;
          if (!svcName) continue;

          if (!serviceNames.has(`${ns}/${svcName}`)) {
            events.push({
              kind: "ingress",
              namespace: ns,
              name: ingressName,
              reason: "BackendServiceNotFound",
              message: `Ingress ${ns}/${ingressName}: backend service "${svcName}" not found`,
              severity: "warning",
              source: "k8s-ingress",
              timestamp: Date.now(),
            });
          }
        }
      }
    }
    return events;
  }

  /**
   * 목적: Job 실패 감지 (완료/suspend 제외)
   */
  private parseJobs(result: PromiseSettledResult<string>): K8sEvent[] {
    if (result.status === "rejected") return [];
    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const events: K8sEvent[] = [];

    for (const item of items) {
      const ns = item?.metadata?.namespace;
      const name = item?.metadata?.name ?? "unknown";

      if (item?.spec?.suspend) continue;
      if (item?.status?.completionTime) continue;

      const failed = item?.status?.failed ?? 0;
      if (failed > 0) {
        events.push({
          kind: "job",
          namespace: ns,
          name,
          reason: "Failed",
          message: `Job ${ns}/${name}: ${failed} pod(s) failed`,
          severity: "warning",
          source: "k8s-job",
          timestamp: Date.now(),
        });
      }
    }
    return events;
  }

  /**
   * 목적: Service 이름 Set 추출 (Ingress 백엔드 검증용)
   */
  private parseServiceNames(result: PromiseSettledResult<string>): Set<string> {
    if (result.status === "rejected") return new Set();
    const parsed = this.safeJson(result.value);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return new Set(items.map((s: any) => `${s?.metadata?.namespace}/${s?.metadata?.name}`).filter(Boolean));
  }

  /**
   * 목적: 안전한 JSON 파싱
   */
  private safeJson(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * 목적: K8s 이벤트 타입에서 심각도 추론
   */
  private inferSeverity(type: string | undefined, reason: string | undefined): K8sEvent["severity"] {
    const text = `${type ?? ""} ${reason ?? ""}`.toLowerCase();

    if (text.includes("failed") || text.includes("backoff") || text.includes("oom")) {
      return "critical";
    }

    if (text.includes("warning")) {
      return "warning";
    }

    return "info";
  }

  /**
   * 목적: k8sgpt 스타일 Pod severity 추론
   */
  private inferPodSeverity(reason: string): K8sEvent["severity"] {
    const critical = [
      "CrashLoopBackOff",
      "ImagePullBackOff",
      "CreateContainerConfigError",
      "CreateContainerError",
      "InvalidImageName",
      "OOMKilled",
      "ErrImagePull",
    ];
    return critical.includes(reason) ? "critical" : "warning";
  }

  /**
   * 목적: timestamp 문자열을 epoch로 변환
   */
  private toTimestamp(value: string | undefined): number {
    if (!value) {
      return Date.now();
    }

    const time = Date.parse(value);
    return Number.isNaN(time) ? Date.now() : time;
  }
}
