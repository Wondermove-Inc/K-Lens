---
id: logs
name: Pod Logs
description: View and analyze pod/container logs
category: kubernetes
type: react
---

## Command: /logs
You are executing the "/logs" command.

### Purpose:
View pod logs with intelligent error pattern detection, severity classification, and root cause hints.

### When to Apply:
- User wants to see logs for a specific pod or container
- Debugging application errors, crashes, or unexpected behavior
- Investigating why a pod is in CrashLoopBackOff or restarting
- Looking for specific error messages or patterns in output

### Why This Matters:
Raw logs are noisy. Without pattern detection, users miss critical errors buried in verbose output. This skill surfaces the signal from the noise — highlighting errors, grouping repeated patterns, and suggesting next diagnostic steps based on what the logs reveal.

### Workflow Steps:
Step 1 - Target Resolution: Identify the pod and container to query
Step 2 - Log Retrieval: Execute kubectl logs with appropriate flags
Step 3 - Pattern Detection: Scan for error/warning patterns and classify severity
Step 4 - Analysis: Correlate errors, identify root cause hints
Step 5 - Report: Format output with actionable next steps

### Required Actions:
- Resolve target pod (if partial name given, find the match)
- Query logs with kubectl (respect --tail, --since, --previous flags)
- Classify log lines by severity (ERROR, WARN, INFO)
- Group repeated error patterns (show count instead of duplicates)
- Provide root cause hints based on detected patterns

### Error Pattern Recognition:
When you detect these patterns, classify and provide context:

| Pattern | Severity | Likely Cause |
|---------|----------|-------------|
| `OOMKilled`, `memory limit exceeded` | 🔴 CRITICAL | Container exceeding memory limit → suggest `/metrics` |
| `connection refused`, `ECONNREFUSED` | 🔴 ERROR | Downstream service unavailable → check target service |
| `timeout`, `deadline exceeded` | 🟡 WARNING | Network latency or overloaded service |
| `permission denied`, `403`, `401` | 🔴 ERROR | RBAC or auth configuration issue |
| `no such file`, `FileNotFoundError` | 🔴 ERROR | Missing config/secret mount or wrong path |
| `CrashLoopBackOff` in events | 🔴 CRITICAL | App crash on startup → check with `--previous` flag |
| `readiness probe failed` | 🟡 WARNING | App not ready → check health endpoint and startup time |
| `liveness probe failed` | 🔴 ERROR | App hung → check for deadlocks or resource exhaustion |
| Stack traces (Java/Python/Node) | 🔴 ERROR | Unhandled exception → extract exception type and message |

### Decision Points:
- If pod has multiple containers → ask which container, or show logs from all with `-c` flag
- If pod is in CrashLoopBackOff → automatically use `--previous` to get pre-crash logs
- If logs are empty → check if container has started, suggest `/events --for pod/[name]`
- If error pattern repeats > 5 times → group and show count instead of listing all
- If stack trace detected → extract the root exception (last Caused-by in Java, bottom of traceback in Python)

### Output Format:
## Log Analysis: [pod-name]

### Summary
| Item | Value |
|------|-------|
| Total Lines | N |
| 🔴 Errors | N |
| 🟡 Warnings | N |
| Period | Last Xm |

### Errors (grouped by pattern)
Show unique error patterns with count and first/last occurrence timestamp.

### Warnings
Show warning lines with timestamps (deduplicated).

### Root Cause Analysis
Based on detected patterns, provide:
- Most likely cause
- Supporting evidence from logs
- Confidence level (high/medium/low)

### Next Steps
Specific commands based on what was found:
- `/diagnose pod/[pod-name]` - If errors suggest infrastructure issue
- `/events --for pod/[pod-name]` - If logs show scheduling or probe failures
- `/metrics` - If OOM or resource pressure detected

### Boundary:
This skill does NOT cover:
- Log aggregation across multiple pods (use centralized logging)
- Real-time log streaming for extended periods
- Log modification or cleanup

### Available Options:
- --tail: Show last N lines (default: 100)
- --since: Logs since specific time (e.g., 1h, 30m)
- --previous: View previous (pre-restart) container logs (default: false)
- --container: Specify container (multi-container pod)
- --follow: Stream logs in real-time (default: false)

### Usage Examples:
- /logs api-server-abc123
- /logs api-server --tail 50
- /logs worker-xyz --previous
- /logs multi-container-pod -c sidecar

### Related Commands:
After completing this task, you may suggest: /diagnose, /events, /solve

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
