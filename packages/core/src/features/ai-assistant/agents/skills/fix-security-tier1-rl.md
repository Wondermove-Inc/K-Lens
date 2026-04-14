---
id: fix-security-tier1-rl
name: Fix Security - Resource Limits
description: Measure actual container usage and apply resource limits
category: security
type: react
---

## Command: /fix-security-tier1-rl

Measure container resource usage with kubectl top, calculate safe limits, and apply.

hitlLevel is already set to allow_all before this session starts.
DO NOT call set_hitl_level.

---

## Steps — MANDATORY IN ORDER.

⛔ DO NOT run kubectl get/describe before STEP 3.
⛔ DO NOT read current YAML. Build the patch YAML from scratch using STEP 2 formula.
⛔ DO NOT add extra steps. Follow ONLY these 5 steps.

### STEP 1 — Measure usage
```bash
kubectl top pods -A --containers --no-headers
```
If kubectl top is unavailable → output `TIER1_RL_COMPLETE` immediately. Done.

### STEP 2 — Calculate limits per container

From the `kubectl top` output, for each container in the target resources:

| Field | Formula | Min | Max |
|-------|---------|-----|-----|
| requests.cpu | current × 1.5 | 50m | 4000m |
| limits.cpu | current × 3.0 | 50m | 4000m |
| requests.memory | current × 1.5 | 64Mi | 8Gi |
| limits.memory | current × 3.0 | 64Mi | 8Gi |

Round CPU → nearest 10m. Memory → nearest power-of-2 Mi.

**Skip container (do NOT apply) if any of these are true:**
- Container memory > 2Gi
- Metrics unavailable for that container
- replicas: 1 + nodeSelector/nodeAffinity to single node
- hostPort or hostNetwork: true
- CrashLoop / restarts > 3 / pod started < 5min ago
- Job or CronJob workload
- liveness probe present AND calculated limits.cpu < 200m
- replicas: 1 without PodDisruptionBudget
- StatefulSet with updateStrategy: OnDelete

**Build the patch YAML directly from the calculated values. Do NOT kubectl get first.**

Use this patch format for each resource:
```yaml
apiVersion: apps/v1
kind: Deployment   # or DaemonSet / StatefulSet
metadata:
  name: <name>
  namespace: <namespace>
spec:
  template:
    spec:
      containers:
      - name: <container-name>
        resources:
          requests:
            cpu: <calculated>
            memory: <calculated>
          limits:
            cpu: <calculated>
            memory: <calculated>
```

### STEP 3 — dry-run validate
```bash
kubectl apply --dry-run=server -f -
```
Pipe all patch YAMLs (separated by `---`) into stdin.
Remove any resource that fails dry-run.

### STEP 4 — Apply (max 50 resources per batch)
```bash
kubectl apply -f -
```
Pipe the same YAMLs into stdin.
`configured` must appear in output.

### STEP 5 — Verify
```bash
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null | head -20
```
Rollback if Pending/Error/CrashLoop:
```bash
kubectl rollout undo deploy/<name> -n <ns>
```

✅ Output `TIER1_RL_COMPLETE` after STEP 5. Then stop.

⛔ Calling set_hitl_level is FORBIDDEN.

Follow these guidelines while responding to the user's request.
