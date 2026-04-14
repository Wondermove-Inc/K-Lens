/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import * as React from "react";
import { Button } from "../../../../renderer/components/shadcn-ui/button";
import { Input } from "../../../../renderer/components/shadcn-ui/input";
import { Label } from "../../../../renderer/components/shadcn-ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../renderer/components/shadcn-ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../renderer/components/shadcn-ui/select";
import { Switch } from "../../../../renderer/components/shadcn-ui/switch";
import { AI_MODELS } from "../provider/ai-models";

import type { AIProvider } from "../../../../common/features/user-preferences/encrypt-api-key-channel";
import type {
  MonitorClusterConfig,
  MonitorConfig,
  MonitorRule,
  MonitorUserPreferences,
} from "../../common/monitor-types";
import type { AgentIPCClient } from "../agent-ipc-client";

/**
 * 목적: 클러스터 렌더링 정보 타입
 */
export interface MonitorClusterOption {
  id: string;
  name: string;
  kubeconfigPath: string;
}

interface Props {
  clusters: MonitorClusterOption[];
  userPreferencesState: any;
  agentIPCClient: AgentIPCClient;
}

/**
 * 목적: description 기반으로 같은 룰을 그룹화한 구조
 */
interface RuleWithClusters {
  rule: MonitorRule;
  clusterAssignments: Map<string, string>; // clusterId -> per-cluster ruleId
}

function toPlainRules(rules: unknown): MonitorRule[] {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules.map((rule: any) => ({
    id: String(rule?.id ?? ""),
    description: String(rule?.description ?? ""),
    condition: {
      resource: String(rule?.condition?.resource ?? "event"),
      field: rule?.condition?.field ? String(rule.condition.field) : undefined,
      operator: rule?.condition?.operator ?? "contains",
      value: String(rule?.condition?.value ?? ""),
    },
    severity: rule?.severity === "critical" || rule?.severity === "info" ? rule.severity : "warning",
    enabled: Boolean(rule?.enabled),
    intervalMs: rule?.intervalMs ? Number(rule.intervalMs) : undefined,
    evalCommand: rule?.evalCommand ? String(rule.evalCommand) : undefined,
    evalInterpretHint: rule?.evalInterpretHint ? String(rule.evalInterpretHint) : undefined,
  }));
}

/**
 * 목적: monitor 기본 설정 생성
 */
function getDefaultPrefs(): MonitorUserPreferences {
  return {
    enabled: false,
    trayResident: false,
    intervalMs: 300_000,
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    customRules: [],
    clusters: [],
  };
}

function normalizeDescription(desc: string): string {
  return desc.trim().toLowerCase();
}

function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 목적: monitor 설정 패널
 */
export const MonitorSettingsPanel = observer(function MonitorSettingsPanel({
  clusters,
  userPreferencesState,
  agentIPCClient,
}: Props) {
  const prefs = (userPreferencesState.monitorConfig ?? getDefaultPrefs()) as MonitorUserPreferences;
  const [ruleText, setRuleText] = React.useState("");
  const [isStarting, setIsStarting] = React.useState(false);
  const [isStopping, setIsStopping] = React.useState(false);
  const [lastActionMessage, setLastActionMessage] = React.useState<string>("");
  const [statusSummary, setStatusSummary] = React.useState<string>("No recent checks yet.");
  const [runtimeState, setRuntimeState] = React.useState<"running" | "stopped">(prefs.enabled ? "running" : "stopped");
  const syncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const runtimeStateRef = React.useRef(runtimeState);
  runtimeStateRef.current = runtimeState;

  React.useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const provider = prefs.provider ?? "anthropic";
  const models = AI_MODELS.filter((model) => model.provider === provider && model.supportsTools).map(
    (model) => model.id,
  );

  // 클러스터별 orphan 룰 + 중복 description 자동 정리
  React.useEffect(() => {
    const masterDescs = new Set((prefs.customRules ?? []).map((r) => normalizeDescription(r.description)));
    let needsCleanup = false;

    for (const cluster of prefs.clusters) {
      const seen = new Set<string>();
      for (const rule of cluster.customRules ?? []) {
        const key = normalizeDescription(rule.description);
        if (!masterDescs.has(key) || seen.has(key)) {
          needsCleanup = true;
          break;
        }
        seen.add(key);
      }
      if (needsCleanup) break;
    }

    // 마스터 룰 자체의 중복도 체크
    const masterSeen = new Set<string>();
    const dedupedMaster = (prefs.customRules ?? []).filter((r) => {
      const key = normalizeDescription(r.description);
      if (masterSeen.has(key)) {
        needsCleanup = true;
        return false;
      }
      masterSeen.add(key);
      return true;
    });

    if (needsCleanup) {
      console.log("[MonitorSettings] Cleaning up orphan/duplicate rules");
      const cleanMasterDescs = new Set(dedupedMaster.map((r) => normalizeDescription(r.description)));
      userPreferencesState.monitorConfig = {
        ...prefs,
        customRules: dedupedMaster,
        clusters: prefs.clusters.map((c) => {
          const seen = new Set<string>();
          return {
            ...c,
            customRules: (c.customRules ?? []).filter((r) => {
              const key = normalizeDescription(r.description);
              if (!cleanMasterDescs.has(key) || seen.has(key)) return false;
              seen.add(key);
              return true;
            }),
          };
        }),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 활성화된 클러스터 목록
  const enabledClusters = React.useMemo(() => {
    const enabledIds = new Set(prefs.clusters.filter((c) => c.enabled).map((c) => c.id));
    return clusters.filter((c) => enabledIds.has(c.id));
  }, [clusters, prefs.clusters]);

  // 마스터 룰 목록 + 클러스터 할당 매핑
  const masterRules = prefs.customRules ?? [];

  const deduplicatedRules = React.useMemo((): RuleWithClusters[] => {
    // 클러스터별 할당 정보 수집
    const assignmentMap = new Map<string, Map<string, string>>();

    for (const clusterConf of prefs.clusters) {
      for (const rule of clusterConf.customRules ?? []) {
        const key = normalizeDescription(rule.description);
        if (!assignmentMap.has(key)) {
          assignmentMap.set(key, new Map());
        }
        assignmentMap.get(key)!.set(clusterConf.id, rule.id);
      }
    }

    // 마스터 룰 기준으로 그룹 생성
    return masterRules.map((rule) => ({
      rule,
      clusterAssignments: assignmentMap.get(normalizeDescription(rule.description)) ?? new Map(),
    }));
  }, [masterRules, prefs.clusters]);

  /**
   * 목적: 설정 저장 + 실행 중이면 워커에 자동 반영 (500ms debounce)
   */
  const commitPrefs = (next: MonitorUserPreferences): void => {
    userPreferencesState.monitorConfig = next;

    if (runtimeStateRef.current !== "running") return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const config = toRuntimeConfig(next);
      if (config.clusters.length > 0) {
        agentIPCClient.monitorSetConfig(config).catch((err) => {
          console.warn("[MonitorSettings] Auto-sync failed:", err);
        });
      }
    }, 500);
  };

  /**
   * 목적: 런타임 config 변환
   */
  const toRuntimeConfig = (nextPrefs: MonitorUserPreferences = prefs): MonitorConfig => {
    const enabledMap = new Map(nextPrefs.clusters.map((item) => [item.id, item]));
    const selected = clusters
      .filter((cluster) => enabledMap.get(cluster.id)?.enabled)
      .map((cluster): MonitorClusterConfig => {
        const state = enabledMap.get(cluster.id)!;
        return {
          id: cluster.id,
          name: cluster.name,
          kubeconfigPath: cluster.kubeconfigPath,
          presetLevel: state.presetLevel,
          customRules: toPlainRules(state.customRules),
          intervalOverrideMs: state.intervalOverrideMs,
        };
      });

    return {
      enabled: nextPrefs.enabled,
      trayResident: nextPrefs.trayResident,
      clusters: selected,
      intervalMs: nextPrefs.intervalMs,
      provider: nextPrefs.provider ?? "anthropic",
      apiKey: "",
      modelId:
        nextPrefs.modelId ??
        ((nextPrefs.provider ?? "anthropic") === "openai"
          ? "gpt-5.2"
          : (nextPrefs.provider ?? "anthropic") === "google"
            ? "gemini-2.0-flash-exp"
            : (nextPrefs.provider ?? "anthropic") === "ollama"
              ? "gemma3:4b"
              : (nextPrefs.provider ?? "anthropic") === "openrouter"
                ? // Free 모델은 수시로 변경되므로 유료 모델 사용
                  "xiaomi/mimo-v2-pro"
                : "claude-sonnet-4-6"),
      kubectlPath: "kubectl",
      helmPath: "helm",
    };
  };

  /**
   * 목적: 클러스터 토글
   */
  const toggleCluster = (clusterId: string, checked: boolean): void => {
    const current = prefs.clusters.find((item) => item.id === clusterId);

    if (current) {
      commitPrefs({
        ...prefs,
        clusters: prefs.clusters.map((item) => (item.id === clusterId ? { ...item, enabled: checked } : item)),
      });
      return;
    }

    commitPrefs({
      ...prefs,
      clusters: [
        ...prefs.clusters,
        {
          id: clusterId,
          enabled: checked,
          presetLevel: "standard",
          customRules: [],
        },
      ],
    });
  };

  /**
   * 목적: 감시 시작
   */
  const startMonitor = async (): Promise<void> => {
    const nextPrefs = prefs.enabled ? prefs : { ...prefs, enabled: true };
    const config = toRuntimeConfig(nextPrefs);

    if (!config.clusters.length) {
      setLastActionMessage("Select at least one cluster before starting monitor.");
      return;
    }

    setIsStarting(true);
    setLastActionMessage("");

    try {
      if (!prefs.enabled) {
        commitPrefs(nextPrefs);
      }

      await agentIPCClient.monitorSetConfig(config);
      setRuntimeState("running");
      setLastActionMessage(`Monitor started for ${config.clusters.length} cluster(s).`);
      await refreshStatuses();
    } catch (error) {
      setLastActionMessage(`Failed to start monitor: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * 목적: 감시 중지
   */
  const stopMonitor = async (): Promise<void> => {
    setIsStopping(true);
    setLastActionMessage("");

    try {
      await agentIPCClient.monitorStop();
      commitPrefs({ ...prefs, enabled: false });
      setRuntimeState("stopped");
      setStatusSummary("Monitor stopped.");
      setLastActionMessage("Monitor stopped.");
    } catch (error) {
      setLastActionMessage(`Failed to stop monitor: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStopping(false);
    }
  };

  /**
   * 목적: 커스텀 룰 추가 — 마스터 목록에만 추가 (클러스터 할당은 사용자가 직접)
   */
  const addRule = async (): Promise<void> => {
    if (!ruleText.trim()) {
      return;
    }

    const parsedRule = await agentIPCClient.monitorAddRule(ruleText.trim());
    const newKey = normalizeDescription(parsedRule.description);

    // 마스터 룰에 같은 description이 이미 있으면 중복 추가 방지
    if (masterRules.some((r) => normalizeDescription(r.description) === newKey)) {
      setLastActionMessage("Same rule already exists.");
      setRuleText("");
      return;
    }

    commitPrefs({
      ...prefs,
      customRules: [...masterRules, parsedRule],
    });
    setRuleText("");
  };

  /**
   * 목적: 특정 클러스터에 룰 할당
   */
  const assignRuleToCluster = (description: string, clusterId: string): void => {
    const group = deduplicatedRules.find(
      (g) => normalizeDescription(g.rule.description) === normalizeDescription(description),
    );
    if (!group) return;

    // 이미 할당된 클러스터면 스킵
    if (group.clusterAssignments.has(clusterId)) return;

    const ruleWithUniqueId: MonitorRule = { ...group.rule, id: generateRuleId() };

    commitPrefs({
      ...prefs,
      clusters: prefs.clusters.map((item) => {
        if (item.id !== clusterId) return item;
        return { ...item, customRules: [...(item.customRules ?? []), ruleWithUniqueId] };
      }),
    });
  };

  /**
   * 목적: 특정 클러스터에서 룰 제거 (마스터 룰은 유지)
   */
  const unassignRuleFromCluster = (description: string, clusterId: string): void => {
    const key = normalizeDescription(description);

    commitPrefs({
      ...prefs,
      clusters: prefs.clusters.map((item) => {
        if (item.id !== clusterId) return item;
        return {
          ...item,
          customRules: (item.customRules ?? []).filter((r) => normalizeDescription(r.description) !== key),
        };
      }),
    });
  };

  /**
   * 목적: 모든 활성 클러스터에 룰 할당
   */
  const assignRuleToAll = (description: string): void => {
    const group = deduplicatedRules.find(
      (g) => normalizeDescription(g.rule.description) === normalizeDescription(description),
    );
    if (!group) return;

    const key = normalizeDescription(description);

    commitPrefs({
      ...prefs,
      clusters: prefs.clusters.map((item) => {
        if (!item.enabled) return item;
        const alreadyHas = (item.customRules ?? []).some((r) => normalizeDescription(r.description) === key);
        if (alreadyHas) return item;
        const ruleWithUniqueId: MonitorRule = { ...group.rule, id: generateRuleId() };
        return { ...item, customRules: [...(item.customRules ?? []), ruleWithUniqueId] };
      }),
    });
  };

  /**
   * 목적: 모든 클러스터에서 룰 할당 해제 (마스터 룰은 유지)
   */
  const unassignRuleFromAll = (description: string): void => {
    const key = normalizeDescription(description);

    commitPrefs({
      ...prefs,
      clusters: prefs.clusters.map((item) => ({
        ...item,
        customRules: (item.customRules ?? []).filter((r) => normalizeDescription(r.description) !== key),
      })),
    });
  };

  /**
   * 목적: 커스텀 룰 삭제 (마스터 룰 + 모든 클러스터에서 완전 제거)
   */
  const removeRule = (description: string): void => {
    const key = normalizeDescription(description);

    commitPrefs({
      ...prefs,
      customRules: masterRules.filter((r) => normalizeDescription(r.description) !== key),
      clusters: prefs.clusters.map((item) => ({
        ...item,
        customRules: (item.customRules ?? []).filter((r) => normalizeDescription(r.description) !== key),
      })),
    });
  };

  /**
   * 목적: 룰별 interval 업데이트 (마스터 + 모든 클러스터 할당)
   */
  const updateRuleInterval = (description: string, intervalMs?: number): void => {
    const key = normalizeDescription(description);
    commitPrefs({
      ...prefs,
      customRules: masterRules.map((r) => (normalizeDescription(r.description) === key ? { ...r, intervalMs } : r)),
      clusters: prefs.clusters.map((c) => ({
        ...c,
        customRules: (c.customRules ?? []).map((r) =>
          normalizeDescription(r.description) === key ? { ...r, intervalMs } : r,
        ),
      })),
    });
  };

  /**
   * 목적: 최근 모니터 상태 요약 갱신
   */
  const refreshStatuses = React.useCallback(async (): Promise<void> => {
    const statuses = await agentIPCClient.monitorGetStatuses();

    if (!statuses.length) {
      setStatusSummary("No status reported yet.");
      return;
    }

    const latest = [...statuses].sort((a, b) => (b.lastChecked ?? 0) - (a.lastChecked ?? 0))[0];
    const checkedAt = latest.lastChecked ? new Date(latest.lastChecked).toLocaleTimeString() : "unknown";
    const findings = latest.findingCount ?? 0;
    const errorInfo = latest.error ? ` — ${latest.error}` : "";
    setStatusSummary(
      `${latest.clusterId}: ${latest.health} (findings: ${findings}, last check: ${checkedAt})${errorInfo}`,
    );
  }, [agentIPCClient]);

  React.useEffect(() => {
    refreshStatuses().catch(() => {
      setStatusSummary("Unable to load monitor status.");
    });

    const timer = window.setInterval(() => {
      refreshStatuses().catch(() => {
        setStatusSummary("Unable to load monitor status.");
      });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshStatuses]);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-foreground text-sm font-medium">Runtime</Label>
            <span
              className={`text-xs font-semibold ${runtimeState === "running" ? "text-status-success" : "text-muted-foreground"}`}
            >
              {runtimeState === "running" ? "RUNNING" : "STOPPED"}
            </span>
          </div>
          {runtimeState === "running" ? (
            <Button variant="outline" size="sm" onClick={stopMonitor} disabled={isStopping || isStarting}>
              {isStopping ? "Stopping..." : "Stop"}
            </Button>
          ) : (
            <Button size="sm" onClick={startMonitor} disabled={isStarting || isStopping}>
              {isStarting ? "Starting..." : "Start"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{statusSummary}</p>
        {lastActionMessage ? <p className="mt-2 text-xs text-foreground">{lastActionMessage}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-foreground flex-1 text-sm font-medium">Enable Cluster Monitor</Label>
        <Switch checked={prefs.enabled} onCheckedChange={(checked) => commitPrefs({ ...prefs, enabled: checked })} />
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Scan interval (min)</Label>
        <Input
          type="number"
          min={1}
          step={1}
          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={String(Math.round(prefs.intervalMs / 60_000))}
          onChange={(event) => {
            const minutes = Math.max(1, Math.round(Number(event.target.value) || 5));
            commitPrefs({ ...prefs, intervalMs: minutes * 60_000 });
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Provider</Label>
        <Select
          value={provider}
          onValueChange={(value) =>
            commitPrefs({
              ...prefs,
              provider: value as AIProvider,
              modelId: undefined,
            })
          }
        >
          <SelectTrigger className="bg-input/30 border-border w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="openrouter">OpenRouter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Model</Label>
        <Select value={prefs.modelId ?? ""} onValueChange={(value) => commitPrefs({ ...prefs, modelId: value })}>
          <SelectTrigger className="bg-input/30 border-border w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((modelId) => (
              <SelectItem key={modelId} value={modelId}>
                {modelId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Clusters</Label>
        {clusters.map((cluster) => {
          const clusterState = prefs.clusters.find((item) => item.id === cluster.id);
          return (
            <div key={cluster.id} className="flex items-center gap-3 rounded border p-2">
              <Switch
                checked={clusterState?.enabled ?? false}
                onCheckedChange={(checked) => toggleCluster(cluster.id, checked)}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{cluster.name}</span>
                <span className="text-xs text-gray-500">{cluster.kubeconfigPath}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Custom rule (natural language)</Label>
        <div className="flex gap-2">
          <Input
            value={ruleText}
            onChange={(event) => setRuleText(event.target.value)}
            placeholder="e.g., Alert me when node memory usage exceeds 90%"
            onKeyDown={(event) => {
              if (event.key === "Enter") addRule();
            }}
          />
          <Button variant="outline" onClick={addRule}>
            Add
          </Button>
        </div>
        {deduplicatedRules.length > 0 && (
          <div className="flex flex-col gap-1">
            {deduplicatedRules.map(({ rule, clusterAssignments }) => {
              const assignedClusters = enabledClusters.filter((c) => clusterAssignments.has(c.id));

              return (
                <div
                  key={normalizeDescription(rule.description)}
                  className="flex flex-col gap-1.5 rounded border px-3 py-2"
                >
                  {/* Row 1: description + severity + delete */}
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1 truncate">{rule.description}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        rule.severity === "critical"
                          ? "bg-red-500/20 text-red-400"
                          : rule.severity === "warning"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {rule.severity}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 text-xs">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className="h-5 w-14 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder={String(Math.round(prefs.intervalMs / 60_000))}
                        value={rule.intervalMs ? String(Math.round(rule.intervalMs / 60_000)) : ""}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === "") {
                            updateRuleInterval(rule.description, undefined);
                          } else {
                            const mins = Math.max(1, Math.round(Number(val) || 1));
                            updateRuleInterval(rule.description, mins * 60_000);
                          }
                        }}
                      />
                      <span className="text-muted-foreground">min</span>
                    </div>
                    <Button
                      variant="ghost"
                      className="h-6 w-6 shrink-0 p-0 text-gray-400 hover:text-red-400"
                      onClick={() => removeRule(rule.description)}
                    >
                      x
                    </Button>
                  </div>

                  {/* Row 2: cluster chips + add dropdown */}
                  {enabledClusters.length > 0 && (
                    <div className="flex items-start gap-2">
                      <div className="flex flex-1 flex-wrap items-center gap-1 min-h-[22px]">
                        {assignedClusters.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                          >
                            {c.name}
                            <button
                              className="ml-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() => unassignRuleFromCluster(rule.description, c.id)}
                            >
                              x
                            </button>
                          </span>
                        ))}
                        {assignedClusters.length === 0 && (
                          <span className="text-xs text-muted-foreground">No clusters assigned</span>
                        )}
                      </div>
                      <ClusterAssignDropdown
                        clusters={enabledClusters}
                        assignedIds={clusterAssignments}
                        onToggle={(clusterId, assigned) => {
                          if (assigned) {
                            assignRuleToCluster(rule.description, clusterId);
                          } else {
                            unassignRuleFromCluster(rule.description, clusterId);
                          }
                        }}
                        onAll={() => assignRuleToAll(rule.description)}
                        onNone={() => unassignRuleFromAll(rule.description)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * 목적: 클러스터 할당 토글 드롭다운 (체크박스 방식)
 */
function ClusterAssignDropdown({
  clusters,
  assignedIds,
  onToggle,
  onAll,
  onNone,
}: {
  clusters: MonitorClusterOption[];
  assignedIds: Map<string, string>;
  onToggle: (clusterId: string, assigned: boolean) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex cursor-pointer items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent">
          + Add
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-2">
        <div className="flex flex-col gap-1">
          {clusters.map((c) => {
            const isAssigned = assignedIds.has(c.id);
            return (
              <button
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => onToggle(c.id, !isAssigned)}
              >
                <span className="w-3.5">{isAssigned ? "\u2611" : "\u2610"}</span>
                {c.name}
              </button>
            );
          })}
          <div className="mt-1 flex gap-2 border-t pt-1">
            <button className="cursor-pointer text-xs text-muted-foreground hover:text-foreground" onClick={onAll}>
              All
            </button>
            <button className="cursor-pointer text-xs text-muted-foreground hover:text-foreground" onClick={onNone}>
              None
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
