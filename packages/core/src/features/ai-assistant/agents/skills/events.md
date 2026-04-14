---
id: events
name: Cluster Events
description: View cluster events and timeline analysis
category: diagnostics
type: react
---

## Command: /events
You are executing the "/events" command.

### Purpose:
Display cluster events with intelligent grouping, pattern recognition, and correlated timeline analysis.

### When to Apply:
- User wants to see what happened in the cluster recently
- Investigating why a pod failed to schedule, start, or pass probes
- Looking for warning events after a deployment or scaling operation
- Checking for node-level issues (disk pressure, memory pressure, not ready)

### Why This Matters:
Kubernetes events are the primary audit trail for cluster operations. Without grouping and pattern recognition, users see hundreds of noisy events and miss critical signals like cascading failures, scheduling bottlenecks, or repeated probe failures that indicate systematic issues.

### Workflow Steps:
Step 1 - Query: Get events with kubectl, applying time and type filters
Step 2 - Classify: Group by severity and resource type
Step 3 - Detect Patterns: Identify repeated events, cascading failures, and correlations
Step 4 - Analyze: Determine root cause from event patterns
Step 5 - Report: Display timeline with key issues and recommended actions

### Required Actions:
- Query events with `kubectl get events --sort-by=.lastTimestamp`
- Group repeated events (show count instead of duplicates)
- Identify warning patterns and their likely causes
- Correlate events across resources (e.g., pod event → node event)
- Suggest specific diagnostic commands for each issue

### Event Pattern Recognition:
| Event Reason | Severity | Likely Cause | Recommended Action |
|-------------|----------|-------------|-------------------|
| `FailedScheduling` | 🔴 | Insufficient CPU/Memory or node affinity mismatch | Check node capacity with `/metrics nodes` |
| `FailedMount` / `FailedAttachVolume` | 🔴 | PVC not bound, storage class issue, or multi-attach error | Check PVC status and storage class |
| `BackOff` (pulling/creating) | 🔴 | Image pull failure or container crash | `/logs [pod] --previous` |
| `Unhealthy` (Liveness/Readiness) | 🟡 | Probe failing — app not ready or hung | Check probe config and app health endpoint |
| `Killing` | 🟡 | Preemption, OOM, or manual deletion | Check if node has memory pressure |
| `NodeNotReady` | 🔴 | Node health issue — kubelet, network, or resource pressure | Check node conditions and kubelet logs |
| `EvictedByVTAPlugin` / `Evicted` | 🟡 | Node under pressure (disk/memory) | `/metrics nodes` to check pressure |
| `ScalingReplicaSet` | ✅ | Normal rollout activity | Informational — no action needed |
| `SuccessfulCreate` | ✅ | Normal pod creation | Informational — no action needed |

### Decision Points:
- If `--for` specified → show events only for that resource, include related resources (e.g., pod's node events)
- If Warning events > 10 with same reason → group and show "× N occurrences" with first/last timestamp
- If events span multiple resources with same timestamp → likely cascading failure, correlate and explain
- If no Warning events found → report "cluster healthy" with Normal event summary
- If `FailedScheduling` detected → automatically check node capacity context

### Cascading Failure Detection:
When multiple warning events occur in sequence:
1. Check if they share a common resource (same node, same deployment)
2. Identify the root event (earliest warning)
3. Explain the cascade chain (e.g., "Node memory pressure → Eviction → FailedScheduling for new pods")

### Output Format:
## Events: [namespace]

### Summary
| Type | Count |
|------|-------|
| 🔴 Warning | N |
| ✅ Normal | N |
| Time Range | [first] — [last] |

### Warning Events (grouped by pattern)
| Count | Resource | Reason | Message | First Seen | Last Seen |
|-------|----------|--------|---------|------------|-----------|
| 15 | pod/worker-abc | BackOff | Back-off restarting failed... | 10m ago | 2m ago |

### Event Timeline (chronological, warnings highlighted)
| Time | Type | Resource | Reason | Message |
|------|------|----------|--------|---------|
| 10:01 | ⚠️ | pod/worker | BackOff | ... |
| 10:02 | ✅ | deploy/api | ScalingReplicaSet | ... |

### Root Cause Analysis
If warning patterns detected, explain:
- What happened (sequence of events)
- Why it happened (root cause from pattern recognition)
- What to do next (specific commands)

### Boundary:
This skill does NOT cover:
- Events older than the Kubernetes event TTL (typically 1 hour)
- Audit log analysis (use audit logging tools)
- Custom event creation or modification

### Available Options:
- --type: Event type filter (Warning/Normal) (default: all)
- --since: Events since specific time (e.g., 1h, 30m) (default: 1h)
- --for: Events for specific resource (e.g., pod/nginx, node/worker-1)

### Usage Examples:
- /events
- /events --type Warning
- /events -n kube-system
- /events --for pod/nginx
- /events --for node/worker-1

### Related Commands:
After completing this task, you may suggest: /diagnose, /logs, /pods

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
