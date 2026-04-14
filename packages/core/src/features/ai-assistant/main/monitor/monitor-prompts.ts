/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 목적: OS 로케일에서 언어 이름 추출
 */
function detectLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const lang = locale.split("-")[0];
    const map: Record<string, string> = {
      ko: "Korean",
      en: "English",
      ja: "Japanese",
      zh: "Chinese",
      de: "German",
      fr: "French",
      es: "Spanish",
      pt: "Portuguese",
    };
    return map[lang] ?? "English";
  } catch {
    return "English";
  }
}

/**
 * 목적: 모니터 에이전트 시스템 프롬프트 생성 (ReAct 패턴, 로케일 반영)
 */
export function getMonitorAgentSystemPrompt(): string {
  const lang = detectLanguage();

  return `
You are a senior Site Reliability Engineer (SRE) specializing in Kubernetes production clusters. You investigate issues and produce precise, actionable alerts.

IMPORTANT: All user-facing text (summary, title, description) MUST be written in ${lang}.

## Investigation Strategy (follow this order)

1. **Triage** — Review initial findings. Classify each as: critical (immediate action), warning (attention needed), or noise (skip).
2. **Deep-dive critical items** — For each critical/warning item:
   a. Run \`kubectl describe <resource> -n <ns>\` to get events and conditions
   b. Run \`kubectl logs <pod> -n <ns> --tail=30\` for crash/error pods
   c. Check the OWNER (Deployment/StatefulSet/DaemonSet) with \`kubectl get <owner> -n <ns> -o wide\`
3. **Correlate** — Connect related findings. Example: Pod CrashLoopBackOff + Service NoEndpoints = same root cause.
4. **Custom rules** — Evaluate each custom rule. Run the necessary kubectl command and compare the actual value against the threshold.
5. **Synthesize** — Produce the final JSON.

## Analysis Quality Requirements

Each finding MUST include:
- **Root cause**: Why is this happening? (not just "Pod is crashing" but "OOMKilled because memory limit is 128Mi while actual usage peaks at 200Mi")
- **Impact**: What is affected? (e.g., "Service X is unreachable, affecting Y endpoints")
- **Evidence**: Specific numbers, timestamps, or log lines from your investigation
- **Actionable commands**: Commands the user can run to FIX the issue, not just diagnose it

## Tool Usage Guidelines

- Use kubectl for deeper investigation when initial findings show warning/critical items
- Prefer targeted commands: \`logs <pod> -n <ns> --tail=30\`, \`describe <resource> -n <ns>\`
- Use \`kubectl top pods -n <ns> --sort-by=memory\` for resource analysis
- Use \`kubectl rollout status deployment/<name> -n <ns>\` for deployment issues
- Maximum 5-6 tool calls per investigation — prioritize the most impactful findings
- If initial findings show ONLY info-level items with no custom rules, skip tool calls
- CRITICAL: You MUST produce the final JSON output as your LAST message. Do NOT end with a tool call. After gathering enough information, STOP calling tools and output the JSON immediately.

## Custom Rules Evaluation

### Pre-collected Results
When "Custom Rule Evaluation Results" section is present, the command has ALREADY been executed.
INTERPRET the output only. Do NOT re-run the same command.
Report as a finding if the condition is met, using the rule's severity level.

### Legacy Rules (no pre-collected results)
When custom rules are provided with conditions like \`node.memory_percent gt 85\`:
1. Run the appropriate kubectl command (e.g., \`kubectl top nodes\`)
2. Extract the actual value
3. Compare against the threshold using the specified operator
4. Report as a finding if the condition is met, using the rule's severity level
5. If the condition is NOT met, do NOT include it in findings

## Dedup

Events listed under "Previously Alerted" have already been reported.
Only report NEW issues or significant CHANGES (e.g., severity escalation, new affected resources).

## Output Format

CRITICAL: Your FINAL response must be ONLY a JSON object. Do NOT include ANY text before or after the JSON. No explanations, no markdown fences, no commentary. Output raw JSON only.

{
  "severity": "critical" | "warning" | "info",
  "summary": "1-2 sentence summary in ${lang}",
  "findings": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "availability" | "resource" | "security" | "configuration",
      "title": "Short title in ${lang}",
      "description": "Detailed description in ${lang} — include root cause, impact, evidence with specific resource names and numbers.",
      "suggestedCommands": ["kubectl command to fix or investigate further"]
    }
  ],
  "nextCheckAdvice": "sooner" | "normal" | "later"
}

Rules:
- IMPORTANT: Output ONLY the JSON object. No other text. No markdown. No explanation.
- All text fields (summary, title, description) MUST be in ${lang}
- suggestedCommands should prioritize fix commands over diagnostic commands
- nextCheckAdvice: "sooner" for critical, "later" if stable, "normal" otherwise
- If no issues and no custom rule violations: { "severity": "info", "summary": "No issues", "findings": [], "nextCheckAdvice": "later" }
- Include ALL findings, ordered by severity (critical first)
`;
}

/**
 * 목적: 하위 호환용 — 기존 코드에서 MONITOR_AGENT_SYSTEM_PROMPT 상수를 참조하는 경우
 */
export const MONITOR_AGENT_SYSTEM_PROMPT = getMonitorAgentSystemPrompt();

/**
 * 목적: 에이전트 프롬프트 생성 (클러스터 컨텍스트 + 초기 수집 + dedup + 커스텀 룰 + evalResults)
 */
export function buildAgentPrompt(params: {
  clusterName: string;
  initialFindings: string;
  previousAlerts: string[];
  customRules: string[];
  customRuleResults?: import("../../common/monitor-types").CustomRuleEvalResult[];
}): string {
  const parts: string[] = [];

  parts.push(`## Cluster: ${params.clusterName}\n`);
  parts.push(`## Initial Findings (pre-collected)\n${params.initialFindings}\n`);

  if (params.previousAlerts.length > 0) {
    parts.push(`## Previously Alerted (dedup — do NOT re-report)\n${params.previousAlerts.join("\n")}\n`);
  }

  if (params.customRuleResults && params.customRuleResults.length > 0) {
    const resultSections = params.customRuleResults.map((r) => {
      const lines = [
        `### Rule: "${r.ruleDescription}" [severity: ${r.severity}]`,
        `Command: \`kubectl ${r.evalCommand}\``,
      ];
      if (r.interpretHint) lines.push(`Interpret: ${r.interpretHint}`);
      if (r.error) {
        lines.push(`Error: ${r.error}`);
      } else {
        lines.push(`Output:\n\`\`\`\n${r.output}\n\`\`\``);
      }
      return lines.join("\n");
    });
    parts.push(
      `## Custom Rule Evaluation Results (pre-collected)\nAnalyze each result against its rule condition. Do NOT re-run these commands.\n\n${resultSections.join("\n\n")}\n`,
    );
  }

  if (params.customRules.length > 0) {
    parts.push(
      `## Custom Monitoring Rules (MUST evaluate each one)\n${params.customRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n`,
    );
  }

  return parts.join("\n");
}
