/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { applyCustomRules, filterByPreset } from "../monitor-rules";

import type { K8sEvent, MonitorRule } from "../../../common/monitor-types";

/**
 * 목적: monitor-rules 테스트
 */
describe("monitor-rules", () => {
  const event: K8sEvent = {
    kind: "event",
    name: "api-server",
    message: "OOMKilled happened",
    severity: "warning",
    source: "k8s-event",
    timestamp: Date.now(),
  };

  it("filters basic preset to core resource warnings", () => {
    const result = filterByPreset("basic", [
      event,
      { ...event, kind: "node", name: "node-a" },
      { ...event, kind: "ingress", name: "ing-a" },
      { ...event, kind: "event", severity: "info" as const, name: "info-evt" },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.kind)).toEqual(["event", "node"]);
  });

  it("applies custom contains rule", () => {
    const rules: MonitorRule[] = [
      {
        id: "r-1",
        description: "OOM 감지",
        condition: { resource: "event", operator: "contains", value: "oom" },
        severity: "critical",
        enabled: true,
      },
    ];

    const result = applyCustomRules(rules, [event]);
    const matched = result.find((item) => item.kind === "rule");

    expect(matched).toBeDefined();
    expect(matched?.severity).toBe("critical");
  });
});
