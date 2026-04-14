---
id: pods
name: Pod List
description: List pods with status summary
category: kubernetes
type: react
---

## Command: /pods
You are executing the "/pods" command.

### Purpose:
Display Pod list with status classification, anomaly detection, and actionable recommendations.

### Workflow Steps:
Step 1 - Query: Get pods from cluster using kubectl
Step 2 - Classify: Categorize each pod by health status
Step 3 - Detect Anomalies: Flag pods with known failure patterns
Step 4 - Report: Format output with status icons and next-step recommendations

### Required Actions:
- Query pod list with kubectl (`kubectl get pods -o wide`)
- Classify each pod into health tiers (see Status Classification below)
- Detect anomaly patterns (high restarts, stuck states, resource pressure)
- Suggest specific next commands for each unhealthy pod

### Status Classification:
Classify pods using these rules:

| Icon | Status | Condition |
|------|--------|-----------|
| ✅ | Healthy | Running, all containers ready, restarts < 3 in last 1h |
| ⚠️ | Warning | Running but restarts ≥ 3, or not all containers ready |
| 🔴 | Error | CrashLoopBackOff, Error, OOMKilled, CreateContainerError |
| ⏳ | Pending | Pending, ContainerCreating, Init:* states |
| 🛑 | Failed | Failed, Evicted, Shutdown |
| ❓ | Unknown | Unknown or unrecognized status |

### Common Failure Patterns:
When you detect these patterns, include the cause and recommended action:

- **CrashLoopBackOff**: Container repeatedly crashing → suggest `/logs [pod] --previous` to see crash reason
- **ImagePullBackOff / ErrImagePull**: Image not found or auth failure → check image name and registry credentials
- **OOMKilled**: Container exceeded memory limit → suggest `/metrics` to check resource usage
- **Pending (no node)**: Insufficient resources or node affinity mismatch → suggest `kubectl describe pod` for events
- **Evicted**: Node under disk/memory pressure → suggest `/events` to check node conditions
- **Init:Error / Init:CrashLoopBackOff**: Init container failing → suggest `/logs [pod] -c [init-container] --previous`
- **Terminating (stuck)**: Finalizer or preStop hook blocking deletion → check finalizers

### Restart Anomaly Detection:
- Restarts ≥ 3 in the last hour → ⚠️ flag as "frequent restarts"
- Restarts ≥ 10 total → ⚠️ flag as "high restart count"
- If RESTARTS column shows high number but pod is Running → still flag, likely intermittent crash

### Output Format:
## Pod List: [namespace]

### Status Summary
| Status | Count |
|--------|-------|
| ✅ Healthy | N |
| ⚠️ Warning | N |
| 🔴 Error | N |
| ⏳ Pending | N |
| 🛑 Failed | N |

### Pod List
| Status | NAME | READY | STATUS | RESTARTS | AGE | NODE |
|--------|------|-------|--------|----------|-----|------|
| ✅ | api-server-abc | 1/1 | Running | 0 | 2d | node-1 |
| 🔴 | worker-xyz | 0/1 | CrashLoopBackOff | 15 | 1h | node-2 |

### Attention Required
For each unhealthy pod, show:
- Pod name and current status
- Likely cause (from Common Failure Patterns above)
- Specific recommended command (e.g., `/logs worker-xyz --previous`, `/diagnose pod/worker-xyz`)

### Available Options:
- --namespace: Target specific namespace
- --all-namespaces: Query all namespaces (default: false)
- --selector: Filter by label selector
- --wide: Show additional info (Node, IP) (default: false)

### Usage Examples:
- /pods
- /pods -n kube-system
- /pods -A
- /pods -l app=nginx
- /pods --wide

### Related Commands:
After completing this task, you may suggest: /diagnose, /logs, /events, /metrics

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
