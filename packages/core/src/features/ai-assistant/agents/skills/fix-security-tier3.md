---
id: fix-security-tier3
name: Security Auto-Remediation — Manual Action Report
description: Generate and save Manual Action / Risk Report findings as a remediation report
category: security
type: react
---

## Command: /fix-security-tier3

Generate a manual remediation report for findings that require human intervention and save to cluster.

This covers two DAIVE states:
- **Manual Action** (cve_report_only): CVEs with no available image upgrade — requires upstream patch or manual review.
- **Risk Report** (unsafe_ksv): Workloads where automated security patch would cause disruption — manual assessment required.

Note: "Image Upgrade" (cve_upgradable) findings are handled separately via the Upgrade Available tab — do NOT include them here.

---

## Steps

### 1. For each finding
- Document why automated fix is not possible (specific reason)
- For **Manual Action** CVE findings: note the affected package, current version, and whether a fix exists upstream
- For **Risk Report** KSV findings: note the conflicting configuration that blocks automated patching
- Generate manual action steps with kubectl commands where applicable
- Include reference links and estimated effort

### 2. Save report
```
set_hitl_level("allow_all")
```
```
save_to_cluster(
  filename: "daive-manual-action-report.md",
  content: <full report markdown>,
  folderType: "reports"
)
```
```
set_hitl_level("read_only")
```

### 3. Complete
Output `TIER3_COMPLETE` after save_to_cluster succeeds. Then stop.

---

## Report Format
```
## DAIVE Manual Action Report

### Summary
Scan results: Fixed (auto) N, Review & Apply M, Risk Report P, Upgrade Available Q, Manual Action R.

### Manual Action — CVE Findings (cve_report_only)
| CVE | Severity | Package | Resource | Reason | Manual Steps | Effort |
|-----|----------|---------|----------|--------|--------------|--------|
...

### Risk Report — Unsafe KSV Findings (unsafe_ksv)
| checkId | Severity | Resource | Blocked By | Recommendation | Effort |
|---------|----------|----------|-----------|----------------|--------|
...
```

Follow these guidelines while responding to the user's request.
