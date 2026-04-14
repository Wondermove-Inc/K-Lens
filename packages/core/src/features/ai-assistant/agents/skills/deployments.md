---
id: deployments
name: Deployment List
description: List deployments with rollout status
category: kubernetes
type: react
---

## Command: /deployments
You are executing the "/deployments" command.

### Purpose:
Display Deployment list with rollout status classification, replica health analysis, and actionable recommendations.

### Workflow Steps:
Step 1 - Query: Get deployments from cluster using kubectl
Step 2 - Classify: Categorize each deployment by health status
Step 3 - Detect Issues: Identify stuck rollouts, replica mismatches, and scaling problems
Step 4 - Report: Format output with status icons and next-step recommendations

### Required Actions:
- Query deployment list with kubectl (`kubectl get deployments -o wide`)
- Classify each deployment into health tiers (see Status Classification below)
- Detect rollout issues and replica anomalies
- Suggest specific next commands for problematic deployments

### Status Classification:
Classify deployments using these rules:

| Icon | Status | Condition |
|------|--------|-----------|
| ✅ | Healthy | desired = ready = updated = available, no ongoing rollout |
| 🔄 | Rolling | updated < desired OR unavailable > 0 (rollout in progress) |
| ⚠️ | Degraded | ready < desired but > 0 (partially available) |
| 🔴 | Unhealthy | ready = 0 OR available = 0 (complete outage) |
| ⏸️ | Paused | Rollout paused (`.spec.paused = true`) |
| 📉 | Scaled Down | desired = 0 (intentionally scaled to zero) |

### Common Issues:
When you detect these patterns, include the cause and recommended action:

- **Stuck Rollout**: updated ≠ desired for > 10 minutes → likely image pull failure, resource limits, or crashloop in new pods. Suggest: `/pods -l app=[name]` to check new ReplicaSet pods
- **Replica Mismatch (ready < desired)**: Not enough pods running → node capacity, PDB blocking, or scheduling failure. Suggest: `/events` to check scheduler events
- **Available = 0**: Complete service outage → check if old ReplicaSet was scaled down before new one is ready. Suggest: `/diagnose deployment/[name]`
- **High Unavailable Count**: `maxUnavailable` setting causing too many pods down during rollout → check rollout strategy
- **Scaled to Zero**: May be intentional (off-hours) or accidental. Flag but don't alarm

### Rollout Health Indicators:
- `READY` column: `ready/desired` — should match
- `UP-TO-DATE`: Pods with latest template — should equal `desired`
- `AVAILABLE`: Pods passing readiness probe — should equal `desired`
- If `UP-TO-DATE < desired`: rollout is in progress or stuck
- If `AVAILABLE < READY`: readiness probe failing on some pods

### Output Format:
## Deployment List: [namespace]

### Status Summary
| Status | Count |
|--------|-------|
| ✅ Healthy | N |
| 🔄 Rolling | N |
| ⚠️ Degraded | N |
| 🔴 Unhealthy | N |

### Deployment List
| Status | NAME | READY | UP-TO-DATE | AVAILABLE | STRATEGY | AGE |
|--------|------|-------|------------|-----------|----------|-----|
| ✅ | api-server | 3/3 | 3 | 3 | RollingUpdate | 5d |
| 🔴 | worker | 0/2 | 1 | 0 | RollingUpdate | 1h |

### Attention Required
For each problematic deployment, show:
- Deployment name and current status
- Specific issue detected (from Common Issues above)
- Recommended command (e.g., `/pods -l app=worker`, `/diagnose deployment/worker`)

### Available Options:
- --namespace: Target specific namespace
- --all-namespaces: Query all namespaces (default: false)
- --selector: Filter by label selector

### Usage Examples:
- /deployments
- /deployments -n production
- /deployments -A
- /deployments -l tier=frontend

### Related Commands:
After completing this task, you may suggest: /pods, /diagnose, /events, /metrics

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
