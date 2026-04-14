/**
 * DAIVE AI 컨텍스트 생성 유틸
 *
 * 그룹 선택 후 "Ask DAIVE about this group" 클릭 시 AI에게 주입할 시스템 프롬프트 생성.
 * Review Results 시 보고서 생성 프롬프트 생성.
 *
 * @packageDocumentation
 */

import type { DaiveFixFindingSummary } from "../../../features/security/common/daive-fix-channel";

// ── Issue Ownership 분류 ─────────────────────────────────

/**
 * DAIVE 이슈 소유권 — Ops(인프라/보안 설정) vs Dev(앱 코드 변경)
 *
 * 분류 기준:
 * - KSV-* (SecurityContext, NetworkPolicy, RBAC) → Ops
 * - CVE + fixedVersion 있음 → Dev (패키지 업그레이드 필요)
 * - CVE + fixedVersion 없음 → Ops (환경 레벨 완화 = 인프라 팀)
 * - RBAC / Resource Limits → Ops
 */
export type IssueOwnership = "ops" | "dev" | "unknown";

/**
 * finding을 Ops/Dev로 분류
 */
export function classifyIssueOwnership(
  finding: Pick<DaiveFixFindingSummary, "checkId" | "cveId" | "fixedVersion" | "type">,
): IssueOwnership {
  const checkId = (finding.checkId ?? "").replace(/^AVD-/, "").toUpperCase();
  const cveId = finding.cveId ?? "";

  if (checkId.startsWith("KSV-")) return "ops";
  if (checkId.startsWith("RBAC-") || checkId.startsWith("AVD-RBAC")) return "ops";

  if (cveId.startsWith("CVE-")) {
    return finding.fixedVersion ? "dev" : "ops";
  }

  const type = String(finding.type ?? "").toLowerCase();
  if (type.includes("cve") || type.includes("vulnerability")) {
    return finding.fixedVersion ? "dev" : "ops";
  }
  if (type.includes("misconfig") || type.includes("rbac") || type.includes("network")) {
    return "ops";
  }

  return "unknown";
}

// ── AI Assistant 그룹 컨텍스트 ─────────────────────────────────────

import type { DaiveGroup } from "../../../renderer/components/security/daive-group-types";

/**
 * 그룹 선택 후 "Ask DAIVE about this group" 클릭 시 주입할 AI 시스템 컨텍스트.
 *
 * DAIVE의 행동 규칙:
 * 1. 사용자가 쓰는 언어로 답변
 * 2. 취약점 설명 + 클러스터 관리자가 직접 조치 가능한지 vs 서드파티(업스트림) 조치가 필요한지 안내
 * 3. kubectl 명령어/클러스터 변경은 사용자 Accept 확인 후에만 실행
 * 4. 자율 조치 금지
 */
export function buildGroupAssistantContext(group: DaiveGroup): string {
  const lines: string[] = [];

  // 행동 규칙
  lines.push(
    "You are DAIVE, a Kubernetes security assistant helping a cluster administrator.",
    "",
    "=== BEHAVIOR RULES ===",
    "1. Always answer in the same language the user writes in.",
    "2. When asked about a vulnerability, explain:",
    "   - What the vulnerability is and its CVE/check details",
    "   - Severity and potential impact on the cluster",
    "   - Whether it can be resolved by upgrading the image/registry version",
    "     (e.g., a newer tag already fixes this CVE → suggest the upgrade command)",
    "   - OR if the cluster admin can fix it with config changes",
    "     (e.g., update securityContext, RBAC policy, apply a patch via kubectl)",
    "   - OR if it requires a third-party upstream fix that only the vendor can resolve",
    "     (e.g., the base image itself contains the vulnerability — no fix available yet)",
    "3. Command execution policy:",
    "   READ-ONLY commands (kubectl get, describe, logs, top, diff, etc.)",
    "     → You MAY run these automatically to gather information.",
    "   WRITE commands (kubectl apply, patch, delete, create, scale, rollout, edit, label, etc.)",
    "     → You MUST ALWAYS present the exact command to the user first.",
    "     → Wait for explicit Accept or Reject. NEVER execute without approval.",
    "     → Helm install/upgrade/uninstall and any file writes also require approval.",
    "4. Do not autonomously modify cluster resources.",
    "5. When you want to help fix an issue, first ask: 'Would you like me to help fix this?'",
    "   Only proceed with fix commands after the user says yes AND approves each individual command.",
    "6. Before suggesting a fix, first run kubectl to check the current state of the affected resource.",
    "   The scan result may be outdated — the issue might already be resolved.",
    "",
  );

  // 그룹 정보
  lines.push("=== CURRENT VULNERABILITY GROUP ===");
  lines.push(`Group: ${group.label}`);
  lines.push(`Category: ${group.category.toUpperCase()} (${group.findings.length} findings)`);
  lines.push(`Action type: ${group.actionType}`);

  if (group.namespaces.length > 0) {
    lines.push(`Namespaces: ${group.namespaces.join(", ")}`);
  }

  // 취약점 샘플 (최대 5개)
  const sample = group.findings.slice(0, 5);
  if (sample.length > 0) {
    lines.push("", "=== SAMPLE FINDINGS ===");
    sample.forEach((f, i) => {
      const id = f.cveId ?? f.checkId ?? "unknown";
      lines.push(`${i + 1}. [${f.severity}] ${id} — ${f.title}`);
      if (f.resource) {
        lines.push(
          `   Resource: ${f.resource.kind}/${f.resource.name}${f.resource.namespace ? ` (${f.resource.namespace})` : ""}`,
        );
      }
      if (f.fixedVersion) lines.push(`   Fix available: ${f.fixedVersion}`);
      if (f.imageUri) lines.push(`   Image: ${f.imageUri}`);
    });
    if (group.findings.length > 5) {
      lines.push(`... and ${group.findings.length - 5} more findings in this group.`);
    }
  }

  lines.push("", "Please wait for the user's question and respond according to the behavior rules above.");

  return lines.join("\n");
}

// ── Review Results 보고서 컨텍스트 ─────────────────────────────────

/**
 * "Review Results" 클릭 시 DAIVE에게 주입하는 보고서 생성 프롬프트.
 * 현재 세션에서 처리한 그룹 상태를 기반으로 종합 보안 현황 보고서 요청.
 */
export function buildReviewResultsContext(groups: DaiveGroup[], totalFindings: number): string {
  const applied = groups.filter((g) => g.status === "applied");
  const reviewed = groups.filter((g) => g.status === "conversing");
  const pending = groups.filter((g) => g.status === "pending");

  const lines: string[] = [
    "You are DAIVE, a Kubernetes security assistant.",
    "",
    "The administrator has finished reviewing vulnerabilities.",
    "Please generate a comprehensive security remediation report.",
    "",
    "=== LANGUAGE RULE ===",
    "Detect the language from the conversation history below.",
    "If the user wrote in Korean, write the ENTIRE report in Korean.",
    "If the user wrote in Japanese, write the ENTIRE report in Japanese.",
    "If no conversation history exists or language is unclear, write in English by default.",
    "",
    "=== SESSION SUMMARY ===",
    `Total vulnerability groups: ${groups.length}`,
    `Total individual findings:  ${totalFindings}`,
    `Applied / Fixed:             ${applied.length} groups`,
    `Reviewed / Discussed:        ${reviewed.length} groups`,
    `Still pending (not reviewed): ${pending.length} groups`,
    "",
  ];

  if (applied.length > 0) {
    lines.push("=== APPLIED FIXES ===");
    applied.forEach((g) => {
      lines.push(`✓ ${g.label}  [${g.actionType}]  ${g.findings.length} findings`);
      if (g.namespaces.length > 0) lines.push(`  Namespaces: ${g.namespaces.join(", ")}`);
    });
    lines.push("");
  }

  if (reviewed.length > 0) {
    lines.push("=== DISCUSSED (not yet applied) ===");
    reviewed.forEach((g) => {
      lines.push(`○ ${g.label}  [${g.actionType}]  ${g.findings.length} findings`);
    });
    lines.push("");
  }

  if (pending.length > 0) {
    lines.push("=== STILL PENDING (not reviewed) ===");
    const byCat = (cat: "critical" | "warning" | "info", limit = 5) => {
      const list = pending.filter((g) => g.category === cat);
      if (list.length === 0) return;
      lines.push(`${cat.toUpperCase()} (${list.length} groups):`);
      list.slice(0, limit).forEach((g) => lines.push(`  • ${g.label} — ${g.findings.length} findings`));
      if (list.length > limit) lines.push(`  ... and ${list.length - limit} more`);
    };
    byCat("critical");
    byCat("warning", 3);
    byCat("info", 2);
    lines.push("");
  }

  lines.push(
    "=== REPORT TASK ===",
    "Generate a clear remediation report that includes:",
    "1. What was fixed in this session (if any)",
    "2. Remaining vulnerabilities — prioritized by severity",
    "3. For each CRITICAL/HIGH remaining group: explain whether the cluster admin",
    "   can fix it directly, OR if it requires upstream vendor action (e.g., base image upgrade)",
    "4. Recommended next steps for the cluster administrator",
    "5. Overall security posture assessment",
    "6. Include the scan date and report generation timestamp at the top of the report.",
    "",
    "=== FORMATTING RULES ===",
    "The chat UI has LIMITED markdown support. Follow these rules strictly:",
    "- Do NOT use ** for bold. Use CAPS or plain text instead.",
    "- Do NOT use ### or any heading syntax. Use 'SECTION NAME' on its own line.",
    "- Do NOT use markdown tables (| --- |). Use bullet lists instead.",
    "- You MAY use: inline `code`, ```code blocks```, and bullet lists (- or numbered).",
    "- Add TWO blank lines between major sections for clear visual separation.",
    "- Use indentation (2 spaces) for sub-items.",
    "- Keep each section concise — prioritize readability over completeness.",
    "- Use numbered lists for action items, bullet lists for information.",
    "",
    "=== IMPORTANT: OUTPUT ORDER ===",
    "You MUST follow this order strictly:",
    "1. FIRST, write the full report directly in the chat so the user can read it immediately.",
    "2. THEN, at the very end, ask: 'Would you like me to save this report as a file?'",
    "3. Only if the user agrees, save it as a Markdown file (.md).",
    `   Suggested path: ~/security-reports/security-report-${new Date().toISOString().slice(0, 10)}.md`,
    "   If the directory does not exist, create it first.",
    "   After saving, tell the user the exact file path.",
    "Do NOT save the file before showing the report in chat. Do NOT skip the chat explanation.",
  );

  return lines.join("\n");
}
